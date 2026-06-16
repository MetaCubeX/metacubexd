/**
 * Tiny shared client for the Clash `/configs` endpoint — the proxy-mode read +
 * switch that BOTH the tray submenu and the global-hotkey cycler need. Factored
 * out of tray.ts (switchMode/refreshMode) and index.ts (cycleProxyMode) so the
 * auth header, the `/configs` shape, the bounded timeout and the mode parsing
 * live in exactly one place. Every call is best-effort and never throws: a read
 * resolves null and a write resolves false on any failure, so callers keep their
 * last-known state instead of flickering.
 */

/** mihomo proxy modes (the Clash `/configs` `mode` field). */
export type ProxyMode = 'rule' | 'global' | 'direct'

/** The rule → global → direct → rule order the tray/hotkey cycle through. */
const PROXY_MODE_CYCLE: readonly ProxyMode[] = ['rule', 'global', 'direct']

/** A wedged/half-open kernel makes fetch hang forever; bound every request. */
const DEFAULT_TIMEOUT_MS = 3000

export interface ClashEndpoint {
  /** Clash external-controller base URL, e.g. http://127.0.0.1:9090 (no trailing /). */
  url: string
  /** Bearer secret; empty string when the kernel runs without one. */
  secret: string
}

function authHeaders(secret: string): Record<string, string> {
  return secret ? { Authorization: `Bearer ${secret}` } : {}
}

/**
 * GET the current proxy mode. Returns null on any failure (network error,
 * non-ok, unparseable body, unknown mode) so callers keep a cached value rather
 * than flicker to "unknown". Bounded by `timeoutMs` (default 3s).
 */
export async function getProxyMode(
  fetchImpl: typeof fetch,
  { url, secret }: ClashEndpoint,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProxyMode | null> {
  try {
    const res = await fetchImpl(`${url}/configs`, {
      headers: authHeaders(secret),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const cfg = (await res.json()) as { mode?: string }
    const mode = cfg.mode?.toLowerCase()
    return mode === 'rule' || mode === 'global' || mode === 'direct'
      ? mode
      : null
  } catch {
    return null
  }
}

/**
 * PATCH the proxy mode. Resolves whether the kernel accepted it (res.ok); never
 * throws — a wedged kernel resolves false. Bounded by `timeoutMs` (default 3s).
 */
export async function setProxyMode(
  fetchImpl: typeof fetch,
  { url, secret }: ClashEndpoint,
  mode: ProxyMode,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${url}/configs`, {
      method: 'PATCH',
      headers: { ...authHeaders(secret), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Next mode in the rule → global → direct → rule cycle; unknown current → rule. */
export function nextProxyMode(current: ProxyMode | null): ProxyMode {
  const idx = current ? PROXY_MODE_CYCLE.indexOf(current) : -1
  return PROXY_MODE_CYCLE[(idx + 1) % PROXY_MODE_CYCLE.length]!
}
