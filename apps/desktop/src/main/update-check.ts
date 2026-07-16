/**
 * Manual update check against GitHub Releases. The app ships without an
 * auto-updater (electron-builder `publish: null` — updates are manual by
 * design), so "Check for Updates…" fetches the latest release tag, compares it
 * to the running version, and the caller routes the user to the download page.
 * No downloading, no self-mutation — just an answer.
 */

const RELEASES_LATEST_API =
  'https://api.github.com/repos/MetaCubeX/metacubexd/releases/latest'
const RELEASES_PAGE = 'https://github.com/MetaCubeX/metacubexd/releases/latest'

/** A wedged network must not hang the menu action; bound the request. */
const CHECK_TIMEOUT_MS = 10_000

export interface UpdateCheckResult {
  current: string
  latest: string
  hasUpdate: boolean
  /** The page to send the user to when an update exists. */
  releaseUrl: string
}

export interface UpdateCheckOptions {
  apiUrl?: string
  githubToken?: string
}

/**
 * Parse a release/package version into numeric segments. Accepts an optional
 * leading `v` and ignores any pre-release/build suffix on a segment. Returns
 * null when nothing numeric is parseable (never throws).
 */
export function parseVersion(version: string): number[] | null {
  const trimmed = version.trim()
  const cleaned = trimmed[0]?.toLowerCase() === 'v' ? trimmed.slice(1) : trimmed
  if (!cleaned) return null
  const segments = cleaned.split('.').map((s) => Number.parseInt(s, 10))
  if (segments.length === 0 || segments.some((n) => Number.isNaN(n))) {
    return null
  }
  return segments
}

/**
 * Segment-wise numeric comparison: is `latest` strictly newer than `current`?
 * Missing segments count as 0 (1.2 == 1.2.0). Unparseable input resolves false
 * — "can't tell" must never nag the user with a phantom update.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return false
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

/**
 * Fetch the latest release tag and compare against `currentVersion`. Network /
 * HTTP / shape errors reject (the caller notifies); a malformed tag resolves
 * as "no update". `releaseUrl` prefers the release's own page and falls back
 * to the stable /releases/latest URL.
 */
export async function checkForUpdates(
  fetchImpl: typeof fetch,
  currentVersion: string,
  apiUrlOrOptions: string | UpdateCheckOptions = {},
): Promise<UpdateCheckResult> {
  // Preserve the original third-argument API URL form for existing callers.
  const options =
    typeof apiUrlOrOptions === 'string'
      ? { apiUrl: apiUrlOrOptions }
      : apiUrlOrOptions
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  }
  if (options.githubToken) {
    headers.Authorization = `Bearer ${options.githubToken}`
  }
  const apiUrl = options.apiUrl ?? RELEASES_LATEST_API
  const res = await fetchImpl(apiUrl, {
    headers,
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status}`)
  }
  const body = (await res.json()) as { tag_name?: string; html_url?: string }
  const latest = body.tag_name?.trim()
  if (!latest) {
    throw new Error('GitHub API response carried no tag_name')
  }
  return {
    current: currentVersion,
    latest,
    hasUpdate: isNewerVersion(latest, currentVersion),
    releaseUrl: body.html_url || RELEASES_PAGE,
  }
}
