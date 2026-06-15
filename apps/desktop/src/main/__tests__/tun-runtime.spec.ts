import type { HelperClient } from '../helper/client'
import type { HelperInstaller } from '../helper/installer'
import { buildTunConfig } from '@metacubexd/agent'
import { describe, expect, it, vi } from 'vitest'
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
    getVersion: vi.fn(),
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

  // connectClient builds + returns the (single) fake client; recorded so we can
  // assert a privileged relaunch connects exactly once.
  const connectClient = vi.fn(() => {
    order.push('connectClient')
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
    it('installs the helper when not yet installed, then connects + startKernel — in order', async () => {
      const deps = makeDeps({ installed: false })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      expect(deps.order).toEqual([
        'installer.install',
        'connectClient',
        'client.startKernel',
      ])
      expect(deps.client.startKernel).toHaveBeenCalledWith(KERNEL_OPTS)
    })

    it('skips install when the helper is already installed', async () => {
      const deps = makeDeps({ installed: true })
      const runtime = makeRuntime(deps)

      await runtime.deps.startPrivileged()

      expect(deps.installer.install).not.toHaveBeenCalled()
      expect(deps.order).toEqual(['connectClient', 'client.startKernel'])
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
        /privileged spawn failed/,
      )
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
})
