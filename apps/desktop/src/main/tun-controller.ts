import type { TunController } from '@metacubexd/agent/types'
import { buildTunConfig } from '@metacubexd/agent'

/**
 * Inject the mihomo `tun:` block into the active config. Real impl (B-2/B-3)
 * writes the section via ProfileStore.setSection; tests pass a recorder.
 */
export type InjectTunFn = (tun: Record<string, unknown>) => Promise<void>

/** Remove the `tun:` block from the active config (mirror of injectTun). */
export type RemoveTunFn = () => Promise<void>

/**
 * Relaunch the kernel as an UNPRIVILEGED sidecar (sidecar = the normal,
 * non-elevated supervisor process used outside TUN mode).
 */
export type StartSidecarFn = () => Promise<void>

/**
 * Relaunch the kernel WITH the privilege needed to build the virtual TUN
 * device. Real impl (B-2/B-3) goes through the privileged helper / elevation;
 * tests inject a recorder. NOTHING here elevates in B-1.
 */
export type StartPrivilegedFn = () => Promise<void>

/** Stop the running kernel before a relaunch (privileged or sidecar). */
export type StopKernelFn = () => Promise<void>

/** Persist the resolved TUN state so a cold start restores it (optional). */
export type PersistFn = (state: {
  enabled: boolean
  mode: 'sidecar' | 'tun'
  stack?: string
}) => Promise<void>

export interface TunControllerOptions {
  /** Inject the `tun:` block (setSection in the real impl). */
  injectTun: InjectTunFn
  /** Remove the `tun:` block. */
  removeTun: RemoveTunFn
  /** Relaunch as the unprivileged sidecar. */
  startSidecar: StartSidecarFn
  /** Relaunch with TUN privilege (helper / elevation in the real impl). */
  startPrivileged: StartPrivilegedFn
  /** Stop the kernel before any relaunch. */
  stopKernel: StopKernelFn
  /** Optional: persist the resolved state for cold-start restore. */
  persist?: PersistFn
  /**
   * Optional precondition gate for enable(), run BEFORE any destructive teardown.
   * Throwing here aborts the enable atomically — nothing is stopped or injected —
   * so a failed precondition (e.g. no active profile to write the `tun:` block
   * into) can never leave the kernel half torn-down. Reject with a
   * `TunPreconditionError` so the control router surfaces it as a clean 4xx.
   */
  precheck?: () => Promise<void>
  /**
   * Optional: unregister the privileged helper service (the installer's
   * uninstall). When provided, the controller exposes `uninstall()`; when
   * omitted, the capability is absent (the control router 404s `/tun/uninstall`).
   */
  uninstall?: () => Promise<void>
  /** Optional clock; defaults to Date.now (reserved for future timing). */
  now?: () => number
}

/**
 * Build the desktop TunController state machine. It sequences the safe teardown
 * + privileged relaunch entirely through INJECTED dependencies — in B-1 none of
 * injectTun / removeTun / startSidecar / startPrivileged / stopKernel performs
 * real elevation, builds a real TUN, or spawns a privileged process; the real
 * implementations (setSection / helper IPC / supervisor) arrive in B-2/B-3.
 *
 * enable:  stopKernel -> injectTun(buildTunConfig({ stack })) -> startPrivileged
 * disable: stopKernel -> removeTun -> startSidecar
 *
 * Both transitions are idempotent: a no-op when already in the target mode, so
 * we never redundantly stop/restart the kernel. Errors from the injected deps
 * propagate untouched (no silent swallowing).
 */
export function createTunController(opts: TunControllerOptions): TunController {
  const {
    injectTun,
    removeTun,
    startSidecar,
    startPrivileged,
    stopKernel,
    persist,
    precheck,
  } = opts

  let state: { enabled: boolean; mode: 'sidecar' | 'tun'; stack?: string } = {
    enabled: false,
    mode: 'sidecar',
  }

  // Shared teardown so uninstall() can reuse the exact disable sequence without
  // depending on `this` through the agent's controller delegate. Idempotent.
  async function disableImpl(): Promise<void> {
    if (state.mode === 'sidecar') return
    await stopKernel()
    await removeTun()
    await startSidecar()
    state = { enabled: false, mode: 'sidecar' }
    if (persist) await persist(state)
  }

  const controller: TunController = {
    async enable({ stack }) {
      // Idempotent: already in TUN -> no redundant stop/inject/relaunch.
      if (state.mode === 'tun') return

      // Validate preconditions BEFORE the destructive teardown. injectTun writes
      // the `tun:` block into the ACTIVE profile, so without one the enable was
      // doomed — but it used to fail mid-sequence (after stopKernel), leaving the
      // kernel down and TUN never up. Gate it up front so a failed enable is a
      // clean no-op the user can recover from.
      if (precheck) await precheck()

      await stopKernel()
      try {
        await injectTun(buildTunConfig({ stack }))
        await startPrivileged()
      } catch (err) {
        // startPrivileged (elevation / helper install / privileged spawn) or
        // injectTun failed AFTER the kernel was stopped — without this recovery
        // the kernel stayed down, so a failed TUN enable took the whole backend
        // offline ("backend stops working"). Undo the injected `tun:` block and
        // relaunch the unprivileged sidecar so traffic flows again. Best-effort:
        // a recovery failure must never mask the original error. (#2149)
        await removeTun().catch(() => {})
        await startSidecar().catch(() => {})
        throw err
      }

      state = { enabled: true, mode: 'tun', stack }
      if (persist) await persist(state)
    },
    disable: disableImpl,
    async status() {
      return { ...state }
    },
  }

  // Expose uninstall ONLY when the dep is wired, so the capability accurately
  // reflects whether the service can actually be removed. It first drops to the
  // sidecar (disableImpl is a no-op when already there) so we never unregister a
  // service that is still owning the kernel, then removes it.
  if (opts.uninstall) {
    const removeService = opts.uninstall
    controller.uninstall = async () => {
      await disableImpl()
      await removeService()
    }
  }

  return controller
}
