import type { TunController } from '@metacubexd/agent/types'
import type { HelperClient } from './helper/client'
import type { HelperInstaller, HelperInstallOptions } from './helper/installer'
import type { HelperKernelStartOptions } from './helper/server'
import type { PersistFn } from './tun-controller'
import type { TunTeardown } from './tun-teardown'
import { createTunController } from './tun-controller'
import { createTunTeardown } from './tun-teardown'

/**
 * Stop the in-process supervisor (the unprivileged sidecar backend). Only
 * start/stop are exercised by the runtime — typed structurally so boot() can
 * pass `agent.supervisor` directly.
 */
export interface SidecarSupervisor {
  start: () => Promise<unknown>
  stop: () => Promise<unknown>
}

/**
 * Connect (construct) the app-side helper client (B-2). Injected as a factory so
 * the runtime can open the privileged-IPC connection lazily on the privileged
 * relaunch — `createHelperClient` connects at construction, so building it
 * eagerly in boot() would dial a socket that the helper hasn't been installed on
 * yet. Tests hand back an in-memory fake; no real socket is ever opened here.
 */
export type ConnectHelperClient = () => HelperClient

/**
 * Edit a top-level config section of the ACTIVE profile (the agent setSection
 * primitive, already closed over the active id). A null/undefined value deletes
 * the key. Real impl: `profiles.setSection(activeId, key, value)`.
 */
export type SetSectionFn = (key: string, value: unknown) => Promise<void>

export interface CreateTunRuntimeOptions {
  /** Per-OS privileged-helper installer (B3-T1); install runs ONE elevate. */
  installer: HelperInstaller
  /** Lazily connect the app-side helper IPC client (B-2). */
  connectClient: ConnectHelperClient
  /** The in-process supervisor backing the unprivileged sidecar mode. */
  supervisor: SidecarSupervisor
  /** Edit the active profile's `tun:` section (agent setSection primitive). */
  setSection: SetSectionFn
  /** Resolve the privileged-spawn paths at relaunch time (binary/home/config). */
  kernelOptions: () => HelperKernelStartOptions
  /** Resolve the install options at install time (electron bin/entry/socket/secret). */
  installOptions: () => HelperInstallOptions
  /**
   * Optional: persist the resolved TUN state for cross-session restore (a
   * cold-start prompt lives in the UI — boot() never auto-elevates). Forwarded
   * to createTunController.
   */
  persist?: PersistFn
  /** Optional teardown error logger (forwarded to createTunTeardown). */
  logError?: (err: unknown) => void
}

export interface TunRuntime {
  /**
   * The REAL injected dependencies for createTunController (B-1). Exposed so the
   * tun-controller wiring is unit-testable in isolation; boot() uses
   * `controller` directly.
   */
  deps: {
    injectTun: (tun: Record<string, unknown>) => Promise<void>
    removeTun: () => Promise<void>
    startSidecar: () => Promise<void>
    startPrivileged: () => Promise<void>
    stopKernel: () => Promise<void>
  }
  /** The wired desktop TunController (feature `'tun'` is gated on this). */
  controller: TunController
  /** Safe-teardown helper shared by the UI recover action + quit/crash paths. */
  teardown: TunTeardown
}

/**
 * Build the REAL injected dependencies for the B-1 `createTunController` out of
 * the B-2 helper client + the B3-T1 installer + the agent setSection primitive +
 * the in-process supervisor, and return the wired controller + its teardown.
 *
 *   injectTun(block)   = setSection('tun', block)
 *   removeTun()        = setSection('tun', null)
 *   startSidecar()     = supervisor.start()          (back to the sidecar backend)
 *   stopKernel()       = stop the CURRENT backend:
 *                          sidecar -> supervisor.stop()
 *                          tun     -> helperClient.stopKernel()
 *   startPrivileged()  = install-if-needed -> connect client -> client.startKernel(...)
 *
 * NOTHING here elevates, installs a service, or spawns a privileged process —
 * every such side effect goes through the INJECTED installer/connectClient/
 * supervisor/setSection. The privileged spawn happens behind the helper client,
 * which talks to the already-installed root/admin service over a local socket.
 *
 * `stopKernel` is backend-aware: the controller always stops BEFORE switching
 * modes, so on enable() the current backend is the sidecar and on disable() it
 * is the helper kernel. We track the active backend here and dispatch the stop
 * to the right owner — stopping the wrong one would orphan a running kernel.
 * Errors from the injected deps propagate untouched (no silent swallowing).
 */
export function createTunRuntime(opts: CreateTunRuntimeOptions): TunRuntime {
  const {
    installer,
    connectClient,
    supervisor,
    setSection,
    kernelOptions,
    installOptions,
  } = opts

  // Which backend currently owns the running kernel. enable()/disable() relaunch
  // through these helpers, which flip the backend so the NEXT stopKernel() hits
  // the right owner.
  let backend: 'sidecar' | 'tun' = 'sidecar'
  // The live helper-IPC connection while in TUN mode (null in sidecar mode).
  let client: HelperClient | null = null

  async function injectTun(tun: Record<string, unknown>): Promise<void> {
    await setSection('tun', tun)
  }

  async function removeTun(): Promise<void> {
    await setSection('tun', null)
  }

  async function startSidecar(): Promise<void> {
    await supervisor.start()
    backend = 'sidecar'
  }

  async function startPrivileged(): Promise<void> {
    // One-time privileged install if the service isn't registered yet (ONE
    // elevation prompt, inside the injected installer).
    if (!(await installer.isInstalled())) {
      await installer.install(installOptions())
    }
    // Connect the helper IPC client (real impl dials the local socket).
    client = connectClient()
    // The privileged service spawns mihomo with the TUN privilege.
    await client.startKernel(kernelOptions())
    backend = 'tun'
  }

  async function stopKernel(): Promise<void> {
    if (backend === 'tun') {
      // The privileged kernel is owned by the helper — stop it over IPC, then
      // drop the connection (the server's anti-residual teardown also stops the
      // kernel the moment we disconnect).
      if (!client) throw new Error('tun-runtime: no helper client to stop')
      await client.stopKernel()
      await client.close()
      client = null
    } else {
      await supervisor.stop()
    }
  }

  const controller = createTunController({
    injectTun,
    removeTun,
    startSidecar,
    startPrivileged,
    stopKernel,
    ...(opts.persist ? { persist: opts.persist } : {}),
  })

  const teardown = createTunTeardown({
    tunController: controller,
    ...(opts.logError ? { logError: opts.logError } : {}),
  })

  return {
    deps: {
      injectTun,
      removeTun,
      startSidecar,
      startPrivileged,
      stopKernel,
    },
    controller,
    teardown,
  }
}
