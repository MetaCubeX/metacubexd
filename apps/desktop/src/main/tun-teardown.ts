import type { TunController } from '@metacubexd/agent/types'

export interface TunTeardownOptions {
  /**
   * The desktop TunController (Wave B-1). recoverNetwork() reads its status and,
   * when in TUN mode, drives disable() to force back to the unprivileged
   * sidecar. Every OS/privilege/process side effect lives behind this injected
   * interface — the real helper-disconnect linkage arrives in B-3.
   */
  tunController: TunController
  /**
   * Log a teardown failure. Injected so tests assert it without touching the
   * console; defaults to console.error. Errors are LOGGED, never silently
   * swallowed, and never rethrown out of recoverNetwork.
   */
  logError?: (err: unknown) => void
}

export interface TunTeardown {
  /**
   * Best-effort: if currently in TUN mode, disable() it (tear the TUN down and
   * fall back to the sidecar). Backs both the UI "recover network" action and
   * the quit/crash paths, so it must NEVER throw — a teardown failure may not
   * block shutdown or the crash watchdog (anti-lockout). Failures are logged.
   */
  recoverNetwork: () => Promise<void>
}

/**
 * Build the TUN safe-teardown helper. recoverNetwork() only disables when the
 * controller reports TUN mode (a no-op in sidecar mode, so it never redundantly
 * stops/relaunches the kernel). It is the single anti-lockout entry point shared
 * by the UI recover action and the quit/crash skeleton in index.ts.
 */
export function createTunTeardown(opts: TunTeardownOptions): TunTeardown {
  const { tunController } = opts
  const logError = opts.logError ?? ((err: unknown) => console.error(err))

  return {
    async recoverNetwork() {
      try {
        const status = await tunController.status()
        // Only tear down when actually in TUN mode — disabling in sidecar mode
        // would be a redundant kernel stop/relaunch.
        if (status.mode === 'tun') {
          await tunController.disable()
        }
      } catch (err) {
        // Best-effort: surface the failure (do not silently swallow) but never
        // let it propagate — the quit/crash paths must not be blocked.
        logError(err)
      }
    },
  }
}
