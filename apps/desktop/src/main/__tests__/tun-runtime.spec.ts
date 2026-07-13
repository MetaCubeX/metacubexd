import type { HelperClient } from '../helper/client'
import type { HelperInstaller } from '../helper/installer'
import { buildTunConfig } from '@metacubexd/agent'
import { describe, expect, it, vi } from 'vitest'
import { HelperVersionMismatchError } from '../helper/client'
import { createTunRuntime } from '../tun-runtime'

/**
 * Build recording stubs for every INJECTED dependency of the tun-runtime glue.
 * NONE of these touch the real OS: no elevation, no service install, no
 * privileged spawn, no real socket. They only append to a shared `order` array
 * (so the test can assert the exact underlying call sequence) and return
 * resolved promises.
 */
function makeDeps(opts?: { installed?: boolean }) {
  const order: string[] = []

  // --- helper client (B-2): a single fake; connectClient hands it out ---
  const client = {
    ping: vi.fn(),
    getVersion: vi.fn(async () => {
      order.push('client.getVersion')
      return { type: 'getVersion', ok: true, version: '1' }
    }),
    startKernel: vi.fn(async () => {
      order.push('client.startKernel')
      return { type: 'startKernel', ok: true, version: '1', running: true }
    }),
    stopKernel: vi.fn(async () => {
      order.push('client.stopKernel')
      return { type: 'stopKernel', ok: true, version: '1' }
    }),
    status: vi.fn(),
    close: vi.fn(async () => {
      order.push('client.close')
    }),
  } as unknown as HelperClient

  // The disconnect handler the runtime hands to connectClient; captured so a
  // test can simulate an unexpected helper drop (helper crash/kill).
  let onDisconnect: (() => void) | undefined
  function dropHelper(): void {
    onDisconnect?.()
  }

  // connectClient builds + returns the (single) fake client; recorded so we can
  // assert a privileged relaunch connects exactly once. The runtime passes the
  // disconnect handler it wants wired onto the real socket (B-3 linkage).
  const connectClient = vi.fn((cb?: () => void) => {
    order.push('connectClient')
    onDisconnect = cb
    return client
  })

  // --- installer (B3-T1): isInstalled probe + install (ONE elevate) ---
  const installer = {
    install: vi.fn(async () => {
      order.push('installer.install')
    }),
    uninstall: vi.fn(async () => {
      order.push('installer.uninstall')
    }),
    isInstalled: vi.fn(async () => opts?.installed ?? false),
    installedVersion: vi.fn(async () => undefined),
  } as unknown as HelperInstaller

  // --- supervisor (sidecar backend): only start/stop are exercised here ---
  const supervisor = {
    start: vi.fn(async () => {
      order.push('supervisor.start')
      return {} as never
    }),
    stop: vi.fn(async () => {
      order.push('supervisor.stop')
      return {} as never
    }),
  }

  // --- agent setSection primitive (already closed over the active id) ---
  const setSection = vi.fn(async (key: string, value: unknown) => {
    order.push(value == null ? `setSection.remove:${key}` : `setSection:${key}`)
  })

  return {
    order,
    client,
    connectClient,
    dropHelper,
    installer,
    supervisor,
    setSection,
  }
}

const KERNEL_OPTS = {
  binaryPath: '/opt/mihomo',
  homeDir: '/home/data',
  configPath: '/home/data/config.yaml',
}

function makeRuntime(deps: ReturnType<typeof makeDeps>) {
  return createTunRuntime({
    installer: deps.installer,
    connectClient: deps.connectClient,
    supervisor: deps.supervisor,
    setSection: deps.setSection,
    kernelOptions: () => KERNEL_OPTS,
    installOptions: () => ({
      electronBin: '/app/electron',
      helperEntry: '/app/out/helper/index.js',
      socketPath: '/var/run/mcxd.sock',
      secret: 'install-secret',
    }),
  })
}

describe('createTunRuntime', () => {
  describe('injectTun / removeTun', () => {
    it('injectTun writes the tun block via setSection("tun", block)', async () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      const block = buildTunConfig({ stack: 'gvisor' })
      await runtime.deps.injectTun(block)

      expect(deps.setSection).toHaveBeenCalledWith('tun', block)
    })

    it('removeTun deletes the tun block via setSection("tun", null)', async () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      await runtime.deps.removeTun()

      expect(deps.setSection).toHaveBeenCalledWith('tun', null)
    })
  })

  describe('startSidecar', () => {
    it('starts the in-process supervisor (the unprivileged sidecar)', async () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      await runtime.deps.startSidecar()

      expect(deps.supervisor.start).toHaveBeenCalledTimes(1)
    })
  })

  describe('startPrivileged', () => {
    it('installs the helper when not yet installed, then connects + startKernel — in order (no handshake on a fresh install)', async () => {
      const deps = makeDeps({ installed: false })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      // A fresh install is THIS build's helper, so it matches by construction —
      // no version handshake round-trip is paid.
      expect(deps.client.getVersion).not.toHaveBeenCalled()
      expect(deps.order).toEqual([
        'installer.install',
        'connectClient',
        'client.startKernel',
      ])
      expect(deps.client.startKernel).toHaveBeenCalledWith(KERNEL_OPTS)
    })

    it('skips install but handshakes an already-installed (possibly stale) helper', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      expect(deps.installer.install).not.toHaveBeenCalled()
      expect(deps.order).toEqual([
        'connectClient',
        'client.getVersion',
        'client.startKernel',
      ])
    })

    it('passes the install options to installer.install', async () => {
      const deps = makeDeps({ installed: false })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      expect(deps.installer.install).toHaveBeenCalledWith({
        electronBin: '/app/electron',
        helperEntry: '/app/out/helper/index.js',
        socketPath: '/var/run/mcxd.sock',
        secret: 'install-secret',
      })
    })

    it('does not swallow a startKernel failure', async () => {
      const deps = makeDeps({ installed: true })
      ;(
        deps.client.startKernel as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error('privileged spawn failed'))
      const runtime = makeRuntime(deps)

      await expect(runtime.deps.startPrivileged()).rejects.toThrow(
        'privileged spawn failed',
      )
    })
  })

  describe('startPrivileged — stale-helper version handshake', () => {
    it('reinstalls + reconnects when a pre-existing helper reports a stale protocol version', async () => {
      const deps = makeDeps({ installed: true })
      // The first handshake rejects with a version mismatch (a stale helper from
      // an older build); after the clean reinstall the second handshake matches.
      ;(
        deps.client.getVersion as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new HelperVersionMismatchError('stale-999', '1'))
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      // connect -> (mismatch) -> close stale -> uninstall -> install -> reconnect
      // -> handshake ok -> startKernel. The rejected-once getVersion doesn't run
      // the default impl, so only the SECOND (matching) handshake records order.
      expect(deps.order).toEqual([
        'connectClient',
        'client.close',
        'installer.uninstall',
        'installer.install',
        'connectClient',
        'client.getVersion',
        'client.startKernel',
      ])
      expect(deps.installer.install).toHaveBeenCalledWith({
        electronBin: '/app/electron',
        helperEntry: '/app/out/helper/index.js',
        socketPath: '/var/run/mcxd.sock',
        secret: 'install-secret',
      })
    })

    it('surfaces a mismatch that persists after a clean reinstall (never starts the kernel)', async () => {
      const deps = makeDeps({ installed: true })
      ;(deps.client.getVersion as ReturnType<typeof vi.fn>).mockRejectedValue(
        new HelperVersionMismatchError('stale-999', '1'),
      )
      const runtime = makeRuntime(deps)

      await expect(runtime.deps.startPrivileged()).rejects.toBeInstanceOf(
        HelperVersionMismatchError,
      )
      // Exactly one self-heal attempt, then it gives up rather than spawn against
      // an incompatible helper.
      expect(deps.installer.uninstall).toHaveBeenCalledTimes(1)
      expect(deps.installer.install).toHaveBeenCalledTimes(1)
      expect(deps.client.startKernel).not.toHaveBeenCalled()
      // Both opened sockets (stale + post-reinstall) are closed — no leaked FD.
      expect(deps.client.close).toHaveBeenCalledTimes(2)
    })

    it('propagates a non-mismatch handshake failure without reinstalling', async () => {
      const deps = makeDeps({ installed: true })
      ;(deps.client.getVersion as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('helper: request "getVersion" timed out after 10000ms'),
      )
      const runtime = makeRuntime(deps)

      await expect(runtime.deps.startPrivileged()).rejects.toThrow('timed out')
      // A timeout / dropped socket is NOT a stale install — don't tear a healthy
      // service down on a transient blip.
      expect(deps.installer.uninstall).not.toHaveBeenCalled()
      expect(deps.installer.install).not.toHaveBeenCalled()
      expect(deps.client.startKernel).not.toHaveBeenCalled()
      // The connected socket is still closed before bailing — no leaked FD.
      expect(deps.client.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('stopKernel (backend-aware)', () => {
    it('in sidecar mode stops the in-process supervisor', async () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      // default backend is the sidecar
      await runtime.deps.stopKernel()

      expect(deps.supervisor.stop).toHaveBeenCalledTimes(1)
      expect(deps.client.stopKernel).not.toHaveBeenCalled()
    })

    it('after a privileged relaunch stops the helper kernel (not the supervisor)', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      // privileged relaunch flips the active backend to the helper kernel
      await runtime.deps.startPrivileged()
      deps.order.length = 0

      await runtime.deps.stopKernel()

      expect(deps.client.stopKernel).toHaveBeenCalledTimes(1)
      expect(deps.supervisor.stop).not.toHaveBeenCalled()
    })

    it('after returning to the sidecar stops the supervisor again', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged() // -> helper backend
      await runtime.deps.startSidecar() // -> sidecar backend
      ;(deps.supervisor.stop as ReturnType<typeof vi.fn>).mockClear()

      await runtime.deps.stopKernel()

      expect(deps.supervisor.stop).toHaveBeenCalledTimes(1)
      expect(deps.client.stopKernel).not.toHaveBeenCalled()
    })
  })

  describe('end-to-end through createTunController', () => {
    it('enable() runs install-if-needed -> startKernel and injects the tun block', async () => {
      const deps = makeDeps({ installed: false })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })

      // stopKernel(sidecar) -> injectTun(setSection) -> startPrivileged(install->connect->startKernel)
      expect(deps.order).toEqual([
        'supervisor.stop',
        'setSection:tun',
        'installer.install',
        'connectClient',
        'client.startKernel',
      ])
      expect(deps.setSection).toHaveBeenCalledWith(
        'tun',
        buildTunConfig({ stack: 'gvisor' }),
      )
      expect(await runtime.controller.status()).toEqual({
        enabled: true,
        mode: 'tun',
        stack: 'gvisor',
      })
    })

    it('disable() stops the helper kernel -> removes the tun block -> starts the sidecar', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await runtime.controller.disable()

      // helper stop closes the IPC connection (the server tears the kernel down
      // again on disconnect), then the tun block is removed + the sidecar starts
      expect(deps.order).toEqual([
        'client.stopKernel',
        'client.close',
        'setSection.remove:tun',
        'supervisor.start',
      ])
      expect(deps.setSection).toHaveBeenLastCalledWith('tun', null)
      expect(await runtime.controller.status()).toEqual({
        enabled: false,
        mode: 'sidecar',
      })
    })

    it('uninstall() tears TUN down to the sidecar, then removes the privileged service', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await runtime.controller.uninstall!()

      // full disable teardown (helper stop+close -> remove tun -> sidecar) BEFORE
      // the service is unregistered — never remove a service still owning the
      // kernel.
      expect(deps.order).toEqual([
        'client.stopKernel',
        'client.close',
        'setSection.remove:tun',
        'supervisor.start',
        'installer.uninstall',
      ])
      expect(await runtime.controller.status()).toEqual({
        enabled: false,
        mode: 'sidecar',
      })
    })
  })

  describe('persist (cross-session mode)', () => {
    it('forwards the resolved mode to the injected persist callback', async () => {
      const deps = makeDeps({ installed: true })
      const persist = vi.fn(async () => {})
      const runtime = createTunRuntime({
        installer: deps.installer,
        connectClient: deps.connectClient,
        supervisor: deps.supervisor,
        setSection: deps.setSection,
        kernelOptions: () => KERNEL_OPTS,
        installOptions: () => ({
          electronBin: '/app/electron',
          helperEntry: '/app/out/helper/index.js',
          socketPath: '/var/run/mcxd.sock',
          secret: 'install-secret',
        }),
        persist,
      })

      await runtime.controller.enable({ stack: 'gvisor' })
      expect(persist).toHaveBeenLastCalledWith({
        enabled: true,
        mode: 'tun',
        stack: 'gvisor',
      })

      await runtime.controller.disable()
      expect(persist).toHaveBeenLastCalledWith({
        enabled: false,
        mode: 'sidecar',
      })
    })
  })

  describe('quit teardown', () => {
    it('teardown() tears down the TUN (back to sidecar) when in tun mode', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await runtime.teardown.recoverNetwork()

      // recoverNetwork sees tun mode -> disable(): helper stop (+ close) ->
      // remove -> sidecar
      expect(deps.order).toEqual([
        'client.stopKernel',
        'client.close',
        'setSection.remove:tun',
        'supervisor.start',
      ])
    })

    it('teardown() is a no-op in sidecar mode', async () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      await runtime.teardown.recoverNetwork()

      expect(deps.order).toEqual([])
    })
  })

  describe('isTunMode (watchdog-ownership predicate)', () => {
    it('is false in the default sidecar backend', () => {
      const deps = makeDeps()
      const runtime = makeRuntime(deps)

      expect(runtime.isTunMode()).toBe(false)
    })

    it('is true after a privileged relaunch (helper owns the kernel)', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })

      expect(runtime.isTunMode()).toBe(true)
    })

    it('is false again after disabling back to the sidecar', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })
      await runtime.controller.disable()

      expect(runtime.isTunMode()).toBe(false)
    })
  })

  describe('helper-disconnect linkage', () => {
    function makeRuntimeWithDisconnect(
      deps: ReturnType<typeof makeDeps>,
      onHelperDisconnect: () => void,
    ) {
      return createTunRuntime({
        installer: deps.installer,
        connectClient: deps.connectClient,
        supervisor: deps.supervisor,
        setSection: deps.setSection,
        kernelOptions: () => KERNEL_OPTS,
        installOptions: () => ({
          electronBin: '/app/electron',
          helperEntry: '/app/out/helper/index.js',
          socketPath: '/var/run/mcxd.sock',
          secret: 'install-secret',
        }),
        onHelperDisconnect,
      })
    }

    it('an unexpected helper drop in tun mode fires onHelperDisconnect', async () => {
      const deps = makeDeps({ installed: true })
      const onHelperDisconnect = vi.fn()
      const runtime = makeRuntimeWithDisconnect(deps, onHelperDisconnect)

      await runtime.controller.enable({ stack: 'gvisor' })

      // The helper crashes / is killed under us.
      deps.dropHelper()

      expect(onHelperDisconnect).toHaveBeenCalledTimes(1)
    })

    it('a deliberate stop (disable) does NOT fire onHelperDisconnect', async () => {
      const deps = makeDeps({ installed: true })
      const onHelperDisconnect = vi.fn()
      const runtime = makeRuntimeWithDisconnect(deps, onHelperDisconnect)

      await runtime.controller.enable({ stack: 'gvisor' })
      // disable() stops the helper kernel + closes the client deliberately. The
      // client suppresses onDisconnect for a deliberate close(), so the runtime
      // never gets a stray disconnect — but even if a late event arrived after
      // we returned to the sidecar, the backend is no longer tun, so it's inert.
      await runtime.controller.disable()
      deps.dropHelper()

      expect(onHelperDisconnect).not.toHaveBeenCalled()
    })

    it('does not dial the helper until tun mode is entered (lazy connect)', async () => {
      const deps = makeDeps({ installed: true })
      const onHelperDisconnect = vi.fn()
      // Construct the runtime (wires onHelperDisconnect) but never enter tun mode.
      void makeRuntimeWithDisconnect(deps, onHelperDisconnect)

      // The runtime must NOT eagerly dial the helper socket at construction — the
      // helper isn't installed/listening until enable(). With no connection there
      // is no live disconnect handler, so a stray drop can't act in sidecar mode.
      // (The backend-flip guard itself is covered by the 'deliberate stop' test,
      // which wires a real disconnect callback before firing it.)
      expect(deps.connectClient).not.toHaveBeenCalled()
      deps.dropHelper()
      expect(onHelperDisconnect).not.toHaveBeenCalled()
    })

    it('works without an onHelperDisconnect dep (a drop is a harmless no-op)', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.controller.enable({ stack: 'gvisor' })

      // No callback wired: dropping must not throw.
      expect(() => deps.dropHelper()).not.toThrow()
    })
  })
})
