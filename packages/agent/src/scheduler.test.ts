import type { ProfileMeta, ProfileStore } from './types'
import { describe, expect, it, vi } from 'vitest'
import { createProfileScheduler } from './scheduler'

// Minimal fake timer: capture the registered callback so the test can drive
// ticks manually (mirrors supervisor.ts's injectable now()/deps style).
function fakeTimers() {
  let cb: (() => void) | undefined
  let cleared = false
  const setTimer = vi.fn((fn: () => void, _ms: number) => {
    cb = fn
    return 1 as unknown as ReturnType<typeof setTimeout>
  })
  const clearTimer = vi.fn((_handle: ReturnType<typeof setTimeout>) => {
    cleared = true
  })
  return {
    setTimer,
    clearTimer,
    tick: () => cb?.(),
    get cleared() {
      return cleared
    },
  }
}

// In-memory ProfileStore double — only list/refresh matter to the scheduler.
function fakeProfiles(
  list: ProfileMeta[],
  refreshImpl?: (id: string) => Promise<ProfileMeta>,
) {
  const refresh = vi.fn(
    refreshImpl ??
      (async (id: string) => {
        const m = list.find((x) => x.id === id)
        if (!m) throw new Error(`not found: ${id}`)
        return m
      }),
  )
  const store = {
    list: vi.fn(async () => list),
    refresh,
  } as unknown as ProfileStore
  return { store, refresh }
}

function meta(p: Partial<ProfileMeta> & { id: string }): ProfileMeta {
  return {
    name: p.id,
    type: 'remote',
    updatedAt: 0,
    ...p,
  } as ProfileMeta
}

describe('createProfileScheduler', () => {
  it('refreshes a due remote profile on tick', async () => {
    const { store, refresh } = fakeProfiles([
      meta({ id: 'a', type: 'remote', updateInterval: 60, updatedAt: 0 }),
    ])
    const timers = fakeTimers()
    const sched = createProfileScheduler({
      profiles: store,
      tickMs: 1000,
      // 60min interval => 3_600_000ms; now far past that
      now: () => 10_000_000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    sched.start()
    await timers.tick()
    await Promise.resolve()
    expect(refresh).toHaveBeenCalledWith('a')
    sched.stop()
  })

  it('skips local profiles, zero/absent interval, and not-yet-due', async () => {
    const { store, refresh } = fakeProfiles([
      meta({ id: 'local', type: 'local', updateInterval: 60, updatedAt: 0 }),
      meta({ id: 'no-interval', type: 'remote', updatedAt: 0 }),
      meta({ id: 'zero', type: 'remote', updateInterval: 0, updatedAt: 0 }),
      // due at 60min = 3_600_000; updatedAt close to now => not yet due
      meta({
        id: 'fresh',
        type: 'remote',
        updateInterval: 60,
        updatedAt: 9_999_999,
      }),
    ])
    const timers = fakeTimers()
    const sched = createProfileScheduler({
      profiles: store,
      now: () => 10_000_000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    sched.start()
    await timers.tick()
    await Promise.resolve()
    expect(refresh).not.toHaveBeenCalled()
    sched.stop()
  })

  it('keeps refreshing the rest when one refresh throws (best-effort)', async () => {
    const list = [
      meta({ id: 'bad', type: 'remote', updateInterval: 60, updatedAt: 0 }),
      meta({ id: 'good', type: 'remote', updateInterval: 60, updatedAt: 0 }),
    ]
    const { store, refresh } = fakeProfiles(list, async (id: string) => {
      if (id === 'bad') throw new Error('boom')
      return list.find((x) => x.id === id)!
    })
    const timers = fakeTimers()
    const sched = createProfileScheduler({
      profiles: store,
      now: () => 10_000_000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    sched.start()
    await timers.tick()
    // allow the per-item async refreshes to settle
    await new Promise((r) => setImmediate(r))
    expect(refresh).toHaveBeenCalledWith('bad')
    expect(refresh).toHaveBeenCalledWith('good')
    sched.stop()
  })

  it('start() schedules a timer and stop() clears it / halts ticking', async () => {
    const { store, refresh } = fakeProfiles([
      meta({ id: 'a', type: 'remote', updateInterval: 60, updatedAt: 0 }),
    ])
    const timers = fakeTimers()
    const sched = createProfileScheduler({
      profiles: store,
      now: () => 10_000_000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    sched.start()
    expect(timers.setTimer).toHaveBeenCalledTimes(1)
    sched.stop()
    expect(timers.clearTimer).toHaveBeenCalledTimes(1)
    expect(timers.cleared).toBe(true)
    // ticking after stop must not refresh
    refresh.mockClear()
    await timers.tick()
    await Promise.resolve()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('uses default tickMs of 60_000 when not provided', () => {
    const { store } = fakeProfiles([])
    const timers = fakeTimers()
    const sched = createProfileScheduler({
      profiles: store,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })
    sched.start()
    expect(timers.setTimer).toHaveBeenCalledWith(expect.any(Function), 60_000)
    sched.stop()
  })
})
