import type { ProfileStore } from './types'

// Outcome of a single subscription refresh attempt; surfaced to onResult so
// consumers (e.g. the desktop) can notify success/failure.
export interface ProfileRefreshResult {
  id: string
  ok: boolean
  error?: string
}

export interface ProfileSchedulerDeps {
  profiles: ProfileStore
  tickMs?: number // default 60_000
  now?: () => number // default Date.now
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
  // Optional validated application after a refresh. Its failure belongs to the
  // same result, and the next tick must not overlap it.
  apply?: (id: string) => Promise<void>
  // Optional: called after each refresh attempt with its outcome. Must not break
  // existing consumers — absence simply skips the notification.
  onResult?: (result: ProfileRefreshResult) => void | Promise<void>
}

// Waits before retrying a profile whose refresh failed, by consecutive failure
// count. Each wait is capped at the profile's own updateInterval, so a failing
// subscription is never fetched more often than a working one would be.
export const REFRESH_FAILURE_BACKOFF_MS = [
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
] as const

export interface ProfileScheduler {
  start: () => void
  stop: () => void
}

// Drives subscription auto-update: on every tick, refresh remote profiles whose
// updateInterval (minutes) has elapsed since updatedAt. Timer + now() are
// injectable so tests can drive ticks deterministically (mirrors supervisor.ts).
export function createProfileScheduler(
  deps: ProfileSchedulerDeps,
): ProfileScheduler {
  const { profiles, apply, onResult } = deps
  const tickMs = deps.tickMs ?? 60_000
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h))

  let handle: ReturnType<typeof setTimeout> | undefined
  let running = false
  // Per-profile retry state after failed refreshes. In memory only: a restart
  // retries once, then backs off again.
  const failures = new Map<string, { count: number; retryAt: number }>()

  async function tick(): Promise<void> {
    if (!running) return
    const list = await profiles.list()
    for (const id of failures.keys()) {
      if (!list.some((meta) => meta.id === id)) failures.delete(id)
    }
    for (const meta of list) {
      if (meta.type !== 'remote') continue
      const interval = meta.updateInterval ?? 0
      if (interval <= 0) continue
      if (now() - meta.updatedAt < interval * 60_000) continue
      const failure = failures.get(meta.id)
      if (failure && now() < failure.retryAt) continue
      // Best-effort: one failing refresh must not abort the rest. The outcome
      // (success/failure) is surfaced to onResult when provided.
      let result: ProfileRefreshResult
      try {
        await profiles.refresh(meta.id)
        await apply?.(meta.id)
        failures.delete(meta.id)
        result = { id: meta.id, ok: true }
      } catch (err) {
        const count = (failure?.count ?? 0) + 1
        const step =
          REFRESH_FAILURE_BACKOFF_MS[
            Math.min(count, REFRESH_FAILURE_BACKOFF_MS.length) - 1
          ]!
        failures.set(meta.id, {
          count,
          retryAt: now() + Math.min(step, interval * 60_000),
        })
        result = {
          id: meta.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
      // A broken notification consumer must not abort remaining subscriptions
      // or report the same outcome a second time.
      try {
        await onResult?.(result)
      } catch {
        /* best-effort notification */
      }
    }
  }

  function arm(): void {
    if (!running) return
    handle = setTimer(() => {
      void tick().finally(() => arm())
    }, tickMs)
  }

  return {
    start() {
      if (running) return
      running = true
      arm()
    },
    stop() {
      running = false
      if (handle !== undefined) {
        clearTimer(handle)
        handle = undefined
      }
    },
  }
}
