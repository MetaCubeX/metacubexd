/**
 * The run-ONCE-with-a-hard-cap wrapper around the anti-lockout teardown. Several
 * exit paths can fire (before-quit, SIGINT/SIGTERM/SIGHUP, uncaughtException) and
 * they can overlap (a signal during before-quit), so the actual shutdown must run
 * exactly once. It must also never hang the process: a wedged helper socket or a
 * stuck kernel could otherwise stall teardown forever, so the run is raced
 * against a hard cap. `finally` (tray.destroy) runs regardless of which side won.
 *
 * Extracted from index.ts so the once/hard-cap/finally semantics — the parts
 * that are easy to get subtly wrong — are unit-tested in isolation from the
 * module-level Electron singletons the real shutdown touches.
 */

export interface ShutdownOrchestratorDeps {
  /** The real teardown (shutdownKernel): release proxy, stop kernel/server, etc. */
  shutdown: () => Promise<void>
  /** Hard cap (ms) after which runOnce resolves even if shutdown hasn't settled. */
  hardCapMs: number
  /** Runs after the first runOnce settles or is capped (e.g. tray.destroy). */
  onFinally?: () => void
  /**
   * Surfaces a teardown failure. runOnce ALWAYS resolves (this is an exit path —
   * a rejecting teardown must never become an unhandled rejection that the
   * process notices on its way out), so a thrown teardown is routed here instead.
   */
  onError?: (err: unknown) => void
  /** Injectable timer (defaults to setTimeout); the handle is unref'd if possible. */
  setTimer?: (fn: () => void, ms: number) => { unref?: () => void } | unknown
}

export interface ShutdownOrchestrator {
  /**
   * Run the teardown the FIRST time; every later call resolves immediately
   * without re-running it. Resolves when the teardown settles OR the hard cap
   * elapses, whichever comes first; onFinally runs once after that.
   */
  runOnce: () => Promise<void>
  /** True once runOnce has been entered (so before-quit can stop re-preventing). */
  hasRun: () => boolean
}

export function createShutdownOrchestrator(
  deps: ShutdownOrchestratorDeps,
): ShutdownOrchestrator {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  // The ONE in-flight teardown promise. Cached (not a per-call fresh promise) so
  // every caller awaits the SAME race — see runOnce.
  let pending: Promise<void> | undefined

  return {
    hasRun: () => pending !== undefined,
    runOnce(): Promise<void> {
      // CRITICAL: every caller must await the SAME in-flight teardown. If a late
      // caller got back a fresh already-resolved promise (what an `if (started)
      // return` async guard does), its `.finally(process.exit)` would fire while
      // the FIRST teardown is still mid-flight — hard-killing the process before
      // the anti-lockout proxy release, the exact whole-machine-lockout this
      // orchestrator exists to prevent. Returning the cached promise makes
      // before-quit's app.quit() and every signal/crash path's process.exit()
      // wait for the one teardown (or its hard cap) to settle first.
      if (pending) return pending
      const capped = new Promise<void>((resolve) => {
        const handle = setTimer(() => resolve(), deps.hardCapMs) as {
          unref?: () => void
        }
        // Don't let the cap timer itself keep the event loop alive on exit.
        handle.unref?.()
      })
      // A rejecting teardown is routed to onError — never re-thrown — so this
      // exit path can't produce an unhandled rejection as the process winds down.
      const guarded = deps.shutdown().catch((err) => deps.onError?.(err))
      pending = (async () => {
        try {
          await Promise.race([guarded, capped])
        } finally {
          deps.onFinally?.()
        }
      })()
      return pending
    },
  }
}
