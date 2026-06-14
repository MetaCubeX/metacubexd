import type { ProfileStore } from './types'

export interface ProfileSchedulerDeps {
  profiles: ProfileStore
  tickMs?: number // default 60_000
  now?: () => number // default Date.now
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
}

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
  const { profiles } = deps
  const tickMs = deps.tickMs ?? 60_000
  const now = deps.now ?? Date.now
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h))

  let handle: ReturnType<typeof setTimeout> | undefined
  let running = false

  async function tick(): Promise<void> {
    if (!running) return
    const list = await profiles.list()
    for (const meta of list) {
      if (meta.type !== 'remote') continue
      const interval = meta.updateInterval ?? 0
      if (interval <= 0) continue
      if (now() - meta.updatedAt < interval * 60_000) continue
      // Best-effort: one failing refresh must not abort the rest.
      try {
        await profiles.refresh(meta.id)
      } catch {
        // swallow — next tick will retry
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
