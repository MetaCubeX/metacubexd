/**
 * Parsed subscription deep link: a remote config URL plus an optional display
 * name. Both `clash://install-config?...` and `clashmeta://install-config?...`
 * are accepted (the two schemes Clash-family clients register).
 */
export interface SubscriptionDeepLink {
  url: string
  name?: string
}

const SCHEMES = new Set(['clash:', 'clashmeta:'])
// Host slot of `scheme://install-config?...` (URL parses it as the hostname).
const ACTION = 'install-config'

/**
 * Pure parser for subscription import deep links. Returns `null` for any
 * unrecognized scheme, missing/empty `url` param, wrong action, or malformed
 * input — never throws. The `url` param is URL-decoded; `name` is included only
 * when present.
 */
export function parseSubscriptionDeepLink(
  raw: string,
): SubscriptionDeepLink | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (!SCHEMES.has(parsed.protocol)) return null
  if (parsed.hostname !== ACTION) return null

  // URL already percent-decodes search params via searchParams.get.
  const url = parsed.searchParams.get('url')
  if (!url) return null

  const name = parsed.searchParams.get('name')
  return name ? { url, name } : { url }
}
