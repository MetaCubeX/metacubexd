import type { DNSQuery } from '~/types'

// Reverse-DNS (PTR) resolver for IPs, via mihomo's dns/query endpoint so lookups
// never leave the backend. Supports IPv4 and IPv6. Caches positives and
// negatives with separate TTLs.

interface HostnameEntry {
  // null = resolved to "no hostname" (negative result).
  name: string | null
  ts: number
}

// Positives live ~45 min and persist across reloads. Negatives live ~10 min
// and are NOT persisted, so a device that gets a name on its next DHCP lease
// is re-checked after a reload instead of staying nameless.
const POSITIVE_TTL = 45 * 60 * 1000
const NEGATIVE_TTL = 10 * 60 * 1000
const CACHE_KEY = 'reverseDnsCache'
const CACHE_CAP = 200

// Module-level singletons shared across all callers.
const memoryCache = new Map<string, HostnameEntry>()
const inflight = new Map<string, Promise<string | null>>()
// Reactive registry of resolved names, keyed by IP. A lookup writes here once
// resolved so every consumer re-renders.
const hostnameState = reactive<Record<string, string>>({})

// Writes into hostnameState are deferred to a microtask (deduped per IP) so they
// never run synchronously during a render/computed.
const pendingPromotions = new Set<string>()
function promote(ip: string, name: string): void {
  if (hostnameState[ip] === name || pendingPromotions.has(ip)) return
  pendingPromotions.add(ip)
  queueMicrotask(() => {
    pendingPromotions.delete(ip)
    if (hostnameState[ip] !== name) hostnameState[ip] = name
  })
}

// Whether an IP is worth a PTR lookup at all. Skips empty, loopback,
// unspecified and link-local addresses (no useful reverse record); everything
// else — private LAN or public, IPv4 or IPv6 — is allowed.
export function isResolvableIP(ip: string | undefined): boolean {
  if (!ip) return false

  if (ip.includes(':')) {
    const lower = ip.split('%')[0]!.toLowerCase()
    if (lower === '::' || lower === '::1') return false
    if (/^fe[89ab]/.test(lower)) return false // fe80::/10 link-local
    return true
  }

  const parts = ip.split('.')
  if (parts.length !== 4) return false
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return false
  }
  const a = Number(parts[0])
  const b = Number(parts[1])
  if (a === 127 || a === 0) return false // loopback / unspecified
  if (a === 169 && b === 254) return false // 169.254.0.0/16 link-local
  return true
}

// 192.168.50.62 -> 62.50.168.192.in-addr.arpa
function reverseNameV4(ip: string): string | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null
  }
  return `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`
}

// Expand to 32 nibbles, reverse, dot-join -> <nibbles>.ip6.arpa
function reverseNameV6(ip: string): string | null {
  const noZone = ip.split('%')[0]!
  const halves = noZone.split('::')
  if (halves.length > 2) return null

  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []

  let groups: string[]
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 0) return null
    const pad: string[] = []
    for (let i = 0; i < missing; i++) pad.push('0')
    groups = [...head, ...pad, ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null

  let nibbles = ''
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null
    nibbles += group.padStart(4, '0').toLowerCase()
  }
  return `${nibbles.split('').reverse().join('.')}.ip6.arpa`
}

export function reverseName(ip: string): string | null {
  return ip.includes(':') ? reverseNameV6(ip) : reverseNameV4(ip)
}

function isExpired(entry: HostnameEntry, now: number): boolean {
  const ttl = entry.name === null ? NEGATIVE_TTL : POSITIVE_TTL
  return now - entry.ts > ttl
}

type PersistedCache = Record<string, HostnameEntry>

function readPersistedCache(): PersistedCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object'
      ? (parsed as PersistedCache)
      : {}
  } catch {
    return {}
  }
}

function writePersistedCache(cache: PersistedCache): void {
  try {
    const keys = Object.keys(cache)
    if (keys.length > CACHE_CAP) {
      const trimmed: PersistedCache = {}
      for (const key of keys.slice(keys.length - CACHE_CAP)) {
        const value = cache[key]
        if (value) trimmed[key] = value
      }
      cache = trimmed
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Quota / serialization failures are non-fatal — resolution is best-effort.
  }
}

// Only positives are persisted (negatives must be re-checked next session).
function persistPositive(ip: string, entry: HostnameEntry): void {
  const cache = readPersistedCache()
  delete cache[ip]
  cache[ip] = entry
  writePersistedCache(cache)
}

let hydrated = false

function hydrateMemoryFromPersisted(): void {
  if (hydrated) return
  hydrated = true
  const now = Date.now()
  for (const [ip, entry] of Object.entries(readPersistedCache())) {
    if (
      entry &&
      typeof entry.name === 'string' &&
      typeof entry.ts === 'number' &&
      !isExpired(entry, now) &&
      !memoryCache.has(ip)
    ) {
      memoryCache.set(ip, entry)
    }
  }
}

// Warm the in-memory cache from localStorage on module load.
hydrateMemoryFromPersisted()

export function useReverseDns() {
  const configStore = useConfigStore()

  async function fetchHostname(ip: string): Promise<string | null> {
    const name = reverseName(ip)
    if (!name) return null
    try {
      const request = useRequest()
      const result = await request
        .get('dns/query', { searchParams: { name, type: 'PTR' } })
        .json<DNSQuery>()
      // An answer record IS the hostname; its absence (NXDOMAIN or empty
      // response) is a negative result. Strip the trailing dot mihomo appends
      // (e.g. "iPhone." -> "iPhone").
      const data = result.Answer?.[0]?.data
      return data ? data.replace(/\.$/, '') : null
    } catch {
      return null
    }
  }

  // Idempotent: kicks off (or reuses) a lookup. No-op when disabled or the IP
  // isn't resolvable.
  function lookup(ip: string | undefined): void {
    if (!configStore.resolveClientHostname) return
    if (!ip || !isResolvableIP(ip)) return

    const now = Date.now()
    const cached = memoryCache.get(ip)
    if (cached) {
      if (!isExpired(cached, now)) {
        if (cached.name) promote(ip, cached.name)
        return
      }
      // Expired: drop from both caches so a stale name can't linger.
      memoryCache.delete(ip)
      if (hostnameState[ip]) delete hostnameState[ip]
    }

    if (inflight.has(ip)) return

    // Cache before freeing the inflight slot so a concurrent call can't race in.
    const promise = fetchHostname(ip)
    inflight.set(ip, promise)
    promise
      .then((name) => {
        const entry: HostnameEntry = { name, ts: Date.now() }
        memoryCache.set(ip, entry)
        if (name) {
          hostnameState[ip] = name
          persistPositive(ip, entry)
        }
      })
      .finally(() => inflight.delete(ip))
  }

  // Reactive getter — triggers a lookup and returns the resolved hostname, or
  // undefined until resolved (or for skipped / negative IPs).
  function get(ip: string | undefined): string | undefined {
    if (!ip) return undefined
    lookup(ip)
    return hostnameState[ip]
  }

  // Display label: resolved hostname if available, otherwise the raw IP.
  // Returns '' for an empty IP.
  function label(ip: string | undefined): string {
    if (!ip) return ''
    if (!configStore.resolveClientHostname) return ip
    return get(ip) || ip
  }

  return { lookup, get, label }
}
