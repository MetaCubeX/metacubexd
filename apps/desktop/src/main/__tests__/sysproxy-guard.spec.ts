import type { SystemProxyController } from '@metacubexd/agent/types'
import { describe, expect, it, vi } from 'vitest'
import { createSysproxyGuard } from '../sysproxy-guard'

// Minimal fake interval timer: capture the registered callback so the test can
// drive ticks manually (mirrors scheduler.test.ts's injectable timer style).
function fakeTimers() {
  let cb: (() => void) | undefined
  const handle = 1 as unknown as ReturnType<typeof setInterval>
  const setTimer = vi.fn((fn: () => void, _ms: number) => {
    cb = fn
    return handle
  })
  const clearTimer = vi.fn((_handle: ReturnType<typeof setInterval>) => {
    cb = undefined
  })
  return {
    setTimer,
    clearTimer,
    handle,
    tick: () => cb?.(),
    get armed() {
      return cb !== undefined
    },
  }
}

// Fake SystemProxyController: only isEnabled/enable matter to the guard; the
// rest are stubbed so the controller shape type-checks.
function fakeController(isEnabledImpl: () => Promise<boolean>) {
  const isEnabled = vi.fn(isEnabledImpl)
  const enable = vi.fn(async (_bypass?: string[]) => {})
  const disable = vi.fn(async () => {})
  const describe = vi.fn(() => ({ port: 7890, bypass: [] as string[] }))
  const controller: SystemProxyController = {
    isEnabled,
    enable,
    disable,
    describe,
  }
  return { controller, isEnabled, enable, disable }
}

describe('createSysproxyGuard', () => {
  it('re-asserts the proxy when a tick sees it disabled externally', async () => {
    const timers = fakeTimers()
    const { controller, isEnabled, enable } = fakeController(async () => false)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 1000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()
    await timers.tick()
    await Promise.resolve()

    expect(isEnabled).toHaveBeenCalledTimes(1)
    expect(enable).toHaveBeenCalledTimes(1)
    guard.stop()
  })

  it('does nothing when a tick sees the proxy still enabled', async () => {
    const timers = fakeTimers()
    const { controller, isEnabled, enable } = fakeController(async () => true)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 1000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()
    await timers.tick()
    await Promise.resolve()

    expect(isEnabled).toHaveBeenCalledTimes(1)
    expect(enable).not.toHaveBeenCalled()
    guard.stop()
  })

  it('arms the timer on start() with the configured interval', () => {
    const timers = fakeTimers()
    const { controller } = fakeController(async () => true)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 5000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()

    expect(timers.setTimer).toHaveBeenCalledTimes(1)
    expect(timers.setTimer).toHaveBeenCalledWith(expect.any(Function), 5000)
    guard.stop()
  })

  it('stop() clears the timer so no further ticks fire', async () => {
    const timers = fakeTimers()
    const { controller, isEnabled } = fakeController(async () => false)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 1000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()
    guard.stop()

    expect(timers.clearTimer).toHaveBeenCalledWith(timers.handle)
    expect(timers.armed).toBe(false)
    // A stale tick after stop() must not re-assert.
    await timers.tick()
    await Promise.resolve()
    expect(isEnabled).not.toHaveBeenCalled()
  })

  it('start() is idempotent — a second start() does not double-arm', () => {
    const timers = fakeTimers()
    const { controller } = fakeController(async () => true)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 1000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()
    guard.start()

    expect(timers.setTimer).toHaveBeenCalledTimes(1)
    guard.stop()
  })

  it('does not re-assert on a tick that lands after stop()', async () => {
    const timers = fakeTimers()
    let resolveIsEnabled: (v: boolean) => void = () => {}
    const isEnabledImpl = () =>
      new Promise<boolean>((resolve) => {
        resolveIsEnabled = resolve
      })
    const { controller, enable } = fakeController(isEnabledImpl)
    const guard = createSysproxyGuard({
      controller,
      intervalMs: 1000,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
    })

    guard.start()
    timers.tick() // fires isEnabled() but its promise is still pending
    guard.stop() // stop before isEnabled resolves
    resolveIsEnabled(false) // OS reports disabled — but guard was stopped
    await Promise.resolve()
    await Promise.resolve()

    expect(enable).not.toHaveBeenCalled()
  })
})
