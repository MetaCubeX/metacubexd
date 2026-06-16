import { describe, expect, it, vi } from 'vitest'
import { createShutdownOrchestrator } from '../shutdown-orchestrator'

describe('createShutdownOrchestrator', () => {
  it('runs the teardown once even across overlapping calls', async () => {
    const shutdown = vi.fn(() => Promise.resolve())
    const orch = createShutdownOrchestrator({ shutdown, hardCapMs: 1000 })

    await Promise.all([orch.runOnce(), orch.runOnce(), orch.runOnce()])
    await orch.runOnce()

    expect(shutdown).toHaveBeenCalledOnce()
  })

  it('makes a LATE caller await the in-flight teardown (not a decoupled fresh promise)', async () => {
    // Models overlapping exit paths: a 2nd signal arrives while the 1st
    // teardown is still mid-flight. Both callers' terminal actions (app.quit /
    // process.exit) must wait for the ONE teardown to settle — a fresh
    // already-resolved promise for the late caller would let it process.exit()
    // mid-teardown, before the anti-lockout proxy release.
    const order: string[] = []
    let releaseTeardown!: () => void
    const shutdown = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseTeardown = () => {
            order.push('teardown-done')
            resolve()
          }
        }),
    )
    const orch = createShutdownOrchestrator({
      shutdown,
      hardCapMs: 1_000_000,
      onFinally: () => order.push('finally'),
      // Cap never fires: only the real teardown can settle the race here.
      setTimer: () => ({ unref: vi.fn() }),
    })

    const first = orch.runOnce().then(() => order.push('first-exit'))
    const second = orch.runOnce().then(() => order.push('second-exit'))

    // Let microtasks flush: with the bug, the late caller would already have
    // resolved (and "exited") here, before the teardown finished.
    await Promise.resolve()
    await Promise.resolve()
    expect(order).toEqual([])

    releaseTeardown()
    await Promise.all([first, second])

    // Teardown completes -> onFinally -> THEN both callers' exit actions.
    expect(order[0]).toBe('teardown-done')
    expect(order[1]).toBe('finally')
    expect(order).toContain('first-exit')
    expect(order).toContain('second-exit')
    expect(shutdown).toHaveBeenCalledOnce()
  })

  it('reports hasRun() only after the first runOnce', () => {
    const orch = createShutdownOrchestrator({
      shutdown: () => Promise.resolve(),
      hardCapMs: 1000,
    })
    expect(orch.hasRun()).toBe(false)
    void orch.runOnce()
    expect(orch.hasRun()).toBe(true)
  })

  it('runs onFinally exactly once after the teardown settles', async () => {
    const onFinally = vi.fn()
    const orch = createShutdownOrchestrator({
      shutdown: () => Promise.resolve(),
      hardCapMs: 1000,
      onFinally,
    })
    await orch.runOnce()
    await orch.runOnce()
    expect(onFinally).toHaveBeenCalledOnce()
  })

  it('resolves via the hard cap when shutdown never settles, and still runs onFinally', async () => {
    const onFinally = vi.fn()
    // shutdown hangs forever.
    const shutdown = vi.fn(() => new Promise<void>(() => {}))
    // Fire the cap timer synchronously so the race resolves without real time.
    const setTimer = (fn: () => void) => {
      fn()
      return { unref: vi.fn() }
    }
    const orch = createShutdownOrchestrator({
      shutdown,
      hardCapMs: 5000,
      onFinally,
      setTimer,
    })

    await orch.runOnce()
    expect(shutdown).toHaveBeenCalledOnce()
    expect(onFinally).toHaveBeenCalledOnce()
  })

  it('unrefs the cap timer so it cannot keep the event loop alive', async () => {
    const unref = vi.fn()
    const setTimer = vi.fn(() => ({ unref }))
    const orch = createShutdownOrchestrator({
      shutdown: () => Promise.resolve(),
      hardCapMs: 5000,
      setTimer,
    })
    await orch.runOnce()
    expect(unref).toHaveBeenCalledOnce()
  })

  it('resolves (never rejects) when shutdown throws, routing the error to onError', async () => {
    const onFinally = vi.fn()
    const onError = vi.fn()
    const err = new Error('teardown blew up')
    const orch = createShutdownOrchestrator({
      shutdown: () => Promise.reject(err),
      hardCapMs: 1000,
      onFinally,
      onError,
      // Never fire the cap so the rejection path is what resolves the race.
      setTimer: () => ({ unref: vi.fn() }),
    })
    // An exit path must not see a rejection — runOnce always resolves.
    await expect(orch.runOnce()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith(err)
    expect(onFinally).toHaveBeenCalledOnce()
  })
})
