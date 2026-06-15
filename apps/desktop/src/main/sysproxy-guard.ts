import type { SystemProxyController } from '@metacubexd/agent/types'

export interface SysproxyGuardOptions {
  /** The OS system-proxy controller to watch + re-assert. */
  controller: SystemProxyController
  /** Poll interval in ms; default 5000. */
  intervalMs?: number
  /** Injected recurring timer; defaults to setInterval. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>
  /** Injected timer clear; defaults to clearInterval. */
  clearTimer?: (handle: ReturnType<typeof setInterval>) => void
}

export interface SysproxyGuard {
  start: () => void
  stop: () => void
}

/**
 * Watch the OS system proxy and re-assert it when an external actor (another
 * app, the OS settings UI, a VPN client) turns it off. While started, every
 * `intervalMs` the guard reads {@link SystemProxyController.isEnabled}; if it
 * reports `false` the guard calls {@link SystemProxyController.enable} to put it
 * back. The timer is injected (defaults to setInterval/clearInterval) so tests
 * drive ticks deterministically without real time. The guard only runs between
 * start() and stop(); a tick whose isEnabled() resolves after stop() is ignored.
 */
export function createSysproxyGuard(opts: SysproxyGuardOptions): SysproxyGuard {
  const { controller } = opts
  const intervalMs = opts.intervalMs ?? 5000
  const setTimer = opts.setTimer ?? ((fn, ms) => setInterval(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearInterval(h))

  let handle: ReturnType<typeof setInterval> | undefined
  let running = false

  async function tick(): Promise<void> {
    if (!running) return
    // Surface re-assert failures rather than swallowing them — the caller
    // (index.ts) owns notification; rethrow so a real error isn't lost.
    const enabled = await controller.isEnabled()
    // The OS state may have been read before stop(); bail if we stopped meanwhile
    // so a stale tick never re-enables a proxy the user just turned off via us.
    if (!running) return
    if (!enabled) await controller.enable()
  }

  return {
    start() {
      if (running) return
      running = true
      handle = setTimer(() => {
        void tick()
      }, intervalMs)
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
