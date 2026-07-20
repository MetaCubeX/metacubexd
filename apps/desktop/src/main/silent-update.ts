import type { FsLike } from './paths'
import type { UpdateCheckResult } from './update-check'

/**
 * Silent (boot-time) update check policy. The app still ships without an
 * auto-updater — this only NOTIFIES when a newer release exists, throttled so
 * a frequently relaunched app neither hammers the GitHub API nor nags:
 *
 *   - at most one check per {@link CHECK_INTERVAL_MS} (24h), persisted across
 *     launches in `<userData>/update-check-state.json`;
 *   - each release version notifies exactly ONCE (lastNotifiedVersion).
 *
 * Every failure is swallowed — a silent check must never surface an error.
 */

export interface SilentUpdateState {
  lastCheckedAt?: number
  lastNotifiedVersion?: string
}

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Read the persisted throttle state; missing/corrupt file → empty state. */
export function loadSilentUpdateState(
  path: string,
  fs: FsLike,
): SilentUpdateState {
  if (!fs.existsSync(path)) return {}
  try {
    const parsed = JSON.parse(fs.readFileSync(path)) as unknown
    if (parsed && typeof parsed === 'object') {
      const raw = parsed as Record<string, unknown>
      return {
        ...(typeof raw.lastCheckedAt === 'number'
          ? { lastCheckedAt: raw.lastCheckedAt }
          : {}),
        ...(typeof raw.lastNotifiedVersion === 'string'
          ? { lastNotifiedVersion: raw.lastNotifiedVersion }
          : {}),
      }
    }
  } catch {
    /* fall through to empty state */
  }
  return {}
}

export interface SilentUpdateCheckOptions {
  /** The real check (checkForUpdates closed over fetch/version/token). */
  check: () => Promise<UpdateCheckResult>
  /** Throttle-state file path (`<userData>/update-check-state.json`). */
  statePath: string
  fs: FsLike
  /** Surface the available update (a notification in the real wiring). */
  notifyUpdate: (result: UpdateCheckResult) => void
  /** Injectable clock for tests; defaults to Date.now. */
  now?: () => number
}

/**
 * Run one throttled silent check. Returns what happened (for tests/logging):
 * 'throttled' (within 24h of the last check), 'no-update', 'notified',
 * 'already-notified' (newer version exists but was announced before), or
 * 'failed' (network/API error — swallowed).
 */
export async function runSilentUpdateCheck(
  opts: SilentUpdateCheckOptions,
): Promise<
  'throttled' | 'no-update' | 'notified' | 'already-notified' | 'failed'
> {
  const now = opts.now ?? Date.now
  const state = loadSilentUpdateState(opts.statePath, opts.fs)
  if (
    state.lastCheckedAt !== undefined &&
    now() - state.lastCheckedAt < CHECK_INTERVAL_MS
  ) {
    return 'throttled'
  }
  let result: UpdateCheckResult
  try {
    result = await opts.check()
  } catch {
    // Silent by contract; do NOT advance lastCheckedAt so the next launch
    // retries instead of waiting out a 24h window on a transient failure.
    return 'failed'
  }
  const next: SilentUpdateState = { ...state, lastCheckedAt: now() }
  let outcome: 'no-update' | 'notified' | 'already-notified' = 'no-update'
  if (result.hasUpdate) {
    if (state.lastNotifiedVersion === result.latest) {
      outcome = 'already-notified'
    } else {
      next.lastNotifiedVersion = result.latest
      outcome = 'notified'
    }
  }
  try {
    opts.fs.writeFileSync(opts.statePath, `${JSON.stringify(next, null, 2)}\n`)
  } catch {
    /* best-effort; a failed persist just re-checks/re-notifies next launch */
  }
  if (outcome === 'notified') opts.notifyUpdate(result)
  return outcome
}
