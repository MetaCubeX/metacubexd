import type { IPProvider } from '~/types/network'
import ky from 'ky'

// Subset of IPInfo surfaced per-connection in the table / details modal.
export interface GeoInfo {
  countryCode?: string
  country?: string
  city?: string
  asn?: number
  org?: string
}

// Per-IP query endpoints. These differ from useIPInfo's "my own IP" endpoints
// in that they take a target IP as a path/query parameter.
const GEO_ENDPOINTS: Record<IPProvider, (ip: string) => string> = {
  'ip.sb': (ip) => `https://api.ip.sb/geoip/${ip}`,
  'ipwho.is': (ip) => `https://ipwho.is/${ip}`,
  'ipapi.is': (ip) => `https://api.ipapi.is/?q=${ip}`,
}

function isAsciiLetters(value: string): boolean {
  if (!value) return false
  for (const char of value.toLowerCase()) {
    if (char < 'a' || char > 'z') return false
  }
  return true
}

function isDecimalOctet(part: string): boolean {
  if (part.length < 1 || part.length > 3) return false
  for (const char of part) {
    if (char < '0' || char > '9') return false
  }
  return Number(part) <= 255
}

function isHexGroup(group: string): boolean {
  if (group.length < 1 || group.length > 4) return false
  for (const char of group.toLowerCase()) {
    const isDigit = char >= '0' && char <= '9'
    const isHexLetter = char >= 'a' && char <= 'f'
    if (!isDigit && !isHexLetter) return false
  }
  return true
}

function parseIPv6FirstGroup(ip: string): number | null {
  const noZone = ip.split('%')[0]!
  const halves = noZone.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  if (halves.length === 2) {
    if (8 - head.length - tail.length <= 0) return null
  } else if (head.length !== 8) {
    return null
  }
  if (![...head, ...tail].every(isHexGroup)) return null
  return head[0] ? Number.parseInt(head[0], 16) : 0
}

function parseIPSB(data: Record<string, unknown>): GeoInfo {
  return {
    countryCode: data.country_code as string | undefined,
    country: data.country as string | undefined,
    city: data.city as string | undefined,
    asn: data.asn as number | undefined,
    org: data.asn_organization as string | undefined,
  }
}

function parseIPWhoIs(data: Record<string, unknown>): GeoInfo {
  const connection = data.connection as
    { asn?: number; org?: string } | undefined
  return {
    countryCode: data.country_code as string | undefined,
    country: data.country as string | undefined,
    city: data.city as string | undefined,
    asn: connection?.asn,
    org: connection?.org,
  }
}

function parseIPAPI(data: Record<string, unknown>): GeoInfo {
  const location = data.location as
    { country_code?: string; country?: string; city?: string } | undefined
  const asn = data.asn as { asn?: number; org?: string } | undefined
  return {
    countryCode: location?.country_code,
    country: location?.country,
    city: location?.city,
    asn: asn?.asn,
    org: asn?.org,
  }
}

function parseGeoResponse(
  provider: IPProvider,
  data: Record<string, unknown>,
): GeoInfo {
  switch (provider) {
    case 'ip.sb':
      return parseIPSB(data)
    case 'ipwho.is':
      return parseIPWhoIs(data)
    case 'ipapi.is':
      return parseIPAPI(data)
  }
}

// Convert an ISO 3166-1 alpha-2 country code to its flag emoji using regional
// indicator symbols. Returns '' for invalid input.
export function countryCodeToFlagEmoji(code: string | undefined): string {
  if (!code || code.length !== 2 || !isAsciiLetters(code)) return ''
  const A = 0x1F1E6
  const base = 'A'.charCodeAt(0)
  const upper = code.toUpperCase()
  return (
    String.fromCodePoint(A + (upper.charCodeAt(0) - base)) +
    String.fromCodePoint(A + (upper.charCodeAt(1) - base))
  )
}

// IPv4 in dotted-decimal, then a few well-known reserved ranges that should
// never hit the network. IPv6 handling covers loopback / unique-local /
// link-local prefixes.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!isDecimalOctet(part)) return null
    const n = Number(part)
    value = value * 256 + n
  }
  return value >>> 0
}

function inRange(value: number, cidrBase: string, prefix: number): boolean {
  const base = ipv4ToInt(cidrBase)
  if (base === null) return false
  const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0
  return (value & mask) === (base & mask)
}

// True for empty / private / reserved / non-globally-routable addresses, which
// we skip entirely (no cache entry, no network call).
export function isPrivateOrReservedIP(ip: string | undefined): boolean {
  if (!ip) return true

  const v4 = ipv4ToInt(ip)
  if (v4 !== null) {
    return (
      inRange(v4, '10.0.0.0', 8) ||
      inRange(v4, '172.16.0.0', 12) ||
      inRange(v4, '192.168.0.0', 16) ||
      inRange(v4, '127.0.0.0', 8) ||
      inRange(v4, '169.254.0.0', 16) ||
      inRange(v4, '100.64.0.0', 10) ||
      inRange(v4, '0.0.0.0', 8)
    )
  }

  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '::') return true
  const firstGroup = parseIPv6FirstGroup(lower)
  if (firstGroup === null) return true
  // fc00::/7 (unique local) -> first hextet fc.. or fd..
  if ((firstGroup & 0xFE00) === 0xFC00) return true
  // fe80::/10 (link local)
  if ((firstGroup & 0xFFC0) === 0xFE80) return true

  return false
}

// Module-level caches shared across all callers (singleton). The in-memory Map
// is the hot path; the localStorage layer is an LRU persisted across reloads.
const memoryCache = new Map<string, GeoInfo>()
const inflight = new Map<string, Promise<GeoInfo | null>>()

const GEO_CACHE_KEY = 'geoIPCache'
const GEO_CACHE_CAP = 500

type PersistedCache = Record<string, GeoInfo>

function readPersistedCache(): PersistedCache {
  try {
    const raw = localStorage.getItem(GEO_CACHE_KEY)
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
    // LRU: drop oldest insertion-order keys past the cap.
    if (keys.length > GEO_CACHE_CAP) {
      const trimmed: PersistedCache = {}
      for (const key of keys.slice(keys.length - GEO_CACHE_CAP)) {
        const value = cache[key]
        if (value) trimmed[key] = value
      }
      cache = trimmed
    }
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Quota / serialization failures are non-fatal — geo is best-effort.
  }
}

function persistGeo(ip: string, info: GeoInfo): void {
  const cache = readPersistedCache()
  // Re-insert at the end to mark as most-recently-used.
  delete cache[ip]
  cache[ip] = info
  writePersistedCache(cache)
}

let hydrated = false

function hydrateMemoryFromPersisted(): void {
  if (hydrated) return
  hydrated = true
  const cache = readPersistedCache()
  for (const [ip, info] of Object.entries(cache)) {
    if (!memoryCache.has(ip)) memoryCache.set(ip, info)
  }
}

async function fetchGeo(
  provider: IPProvider,
  ip: string,
): Promise<GeoInfo | null> {
  try {
    const url = GEO_ENDPOINTS[provider](ip)
    const data = await ky
      .get(url, { timeout: 10000 })
      .json<Record<string, unknown>>()
    return parseGeoResponse(provider, data)
  } catch {
    return null
  }
}

// Reactive registry of resolved geo info, keyed by IP. Triggering a lookup
// writes here once resolved so every consumer re-renders.
const geoState = reactive<Record<string, GeoInfo>>({})

export function useGeoLookup() {
  const configStore = useConfigStore()

  // Idempotent: kicks off (or reuses) a lookup for an IP. No-op when the geo
  // toggle is off or the IP is private/reserved/empty.
  function lookup(ip: string | undefined): void {
    if (!configStore.showConnectionGeoIP) return
    if (isPrivateOrReservedIP(ip)) return
    const key = ip as string

    if (geoState[key] || memoryCache.has(key)) {
      if (!geoState[key]) geoState[key] = memoryCache.get(key) as GeoInfo
      return
    }

    hydrateMemoryFromPersisted()
    if (memoryCache.has(key)) {
      geoState[key] = memoryCache.get(key) as GeoInfo
      return
    }

    if (inflight.has(key)) return

    const provider = configStore.connectionGeoIPProvider
    const promise = fetchGeo(provider, key).finally(() => {
      inflight.delete(key)
    })
    inflight.set(key, promise)

    promise.then((info) => {
      if (!info) return
      memoryCache.set(key, info)
      geoState[key] = info
      persistGeo(key, info)
    })
  }

  // Reactive getter — undefined until resolved (or for skipped IPs).
  function get(ip: string | undefined): GeoInfo | undefined {
    if (!ip) return undefined
    return geoState[ip]
  }

  function flagEmoji(ip: string | undefined): string {
    return countryCodeToFlagEmoji(get(ip)?.countryCode)
  }

  // "country · city · ASxxxx" for a tooltip, omitting missing parts.
  function tooltip(ip: string | undefined): string {
    const info = get(ip)
    if (!info) return ''
    const parts: string[] = []
    if (info.country) parts.push(info.country)
    if (info.city) parts.push(info.city)
    if (info.asn) parts.push(`AS${info.asn}${info.org ? ` ${info.org}` : ''}`)
    return parts.join(' · ')
  }

  return { lookup, get, flagEmoji, tooltip }
}
