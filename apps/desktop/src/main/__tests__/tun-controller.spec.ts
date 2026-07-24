import { buildTunConfig } from '@metacubexd/agent'
import { describe, expect, it, vi } from 'vitest'
import { createTunController } from '../tun-controller'

/**
 * Build a set of recording stubs for every INJECTED dependency. None of these
 * touch the real OS: no elevation, no TUN device, no privileged spawn. They only
 * append to a shared `order` array so the test can assert the exact call
 * sequence, then return resolved promises.
 */
function makeDeps() {
  const order: string[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      order.push(name)
      void args
      return Promise.resolve()
    }
  const injectTun = vi.fn(record('injectTun'))
  const removeTun = vi.fn(record('removeTun'))
  const startSidecar = vi.fn(record('startSidecar'))
  const startPrivileged = vi.fn(record('startPrivileged'))
  const stopKernel = vi.fn(record('stopKernel'))
  const persist = vi.fn(record('persist'))
  const uninstall = vi.fn(record('uninstall'))
  return {
    order,
    injectTun,
    removeTun,
    startSidecar,
    startPrivileged,
    stopKernel,
    persist,
    uninstall,
  }
}

describe('createTunController', () => {
  describe('enable()', () => {
    it('stops the kernel, injects the tun block, then relaunches privileged — in order', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })

      // strict order of the teardown + relaunch steps: stop -> inject ->
      // privileged relaunch (persist is bookkeeping, asserted separately).
      expect(deps.order.filter((n) => n !== 'persist')).toEqual([
        'stopKernel',
        'injectTun',
        'startPrivileged',
      ])
      // the privileged launcher is used for enable, never the sidecar one
      expect(deps.startPrivileged).toHaveBeenCalledTimes(1)
      expect(deps.startSidecar).not.toHaveBeenCalled()
      expect(deps.removeTun).not.toHaveBeenCalled()
    })

    it('injects exactly buildTunConfig({ stack }) — the pure agent builder output', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'mixed' })

      expect(deps.injectTun).toHaveBeenCalledTimes(1)
      expect(deps.injectTun).toHaveBeenCalledWith(
        buildTunConfig({ stack: 'mixed' }),
      )
    })

    it('sets state to enabled/tun and remembers the stack', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'system' })

      expect(await tun.status()).toEqual({
        enabled: true,
        mode: 'tun',
        stack: 'system',
      })
    })

    it('calls persist when provided', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })

      expect(deps.persist).toHaveBeenCalledTimes(1)
    })

    it('works without a persist dep (optional)', async () => {
      const deps = makeDeps()
      const { persist: _persist, ...rest } = deps
      const tun = createTunController(rest)

      await tun.enable({ stack: 'gvisor' })

      expect(await tun.status()).toEqual({
        enabled: true,
        mode: 'tun',
        stack: 'gvisor',
      })
    })

    it('is idempotent: enabling again when already in tun does not re-stop/re-inject/re-launch', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await tun.enable({ stack: 'gvisor' })

      expect(deps.order).toEqual([])
      expect(deps.stopKernel).toHaveBeenCalledTimes(1)
      expect(deps.injectTun).toHaveBeenCalledTimes(1)
      expect(deps.startPrivileged).toHaveBeenCalledTimes(1)
    })

    it('does not swallow errors from the injected deps', async () => {
      const deps = makeDeps()
      deps.startPrivileged.mockRejectedValueOnce(new Error('elevation denied'))
      const tun = createTunController(deps)

      await expect(tun.enable({ stack: 'gvisor' })).rejects.toThrow(
        'elevation denied',
      )
    })

    it('relaunches the sidecar (undoes the tun block) when startPrivileged fails after stopKernel, so the kernel is not left dead (#2149)', async () => {
      const deps = makeDeps()
      deps.startPrivileged.mockRejectedValueOnce(
        new Error('connect ENOENT helper.sock'),
      )
      const tun = createTunController(deps)

      await expect(tun.enable({ stack: 'gvisor' })).rejects.toThrow(
        'connect ENOENT helper.sock',
      )

      // The kernel was stopped, then the privileged relaunch failed — recovery
      // must remove the injected tun block AND relaunch the sidecar so traffic
      // keeps flowing instead of leaving the backend offline.
      expect(deps.stopKernel).toHaveBeenCalledTimes(1)
      expect(deps.injectTun).toHaveBeenCalledTimes(1)
      expect(deps.startPrivileged).toHaveBeenCalledTimes(1)
      expect(deps.removeTun).toHaveBeenCalledTimes(1)
      expect(deps.startSidecar).toHaveBeenCalledTimes(1)
      // The failed enable must NOT flip the controller into TUN state.
      expect(await tun.status()).toEqual({ enabled: false, mode: 'sidecar' })
    })

    it('runs precheck BEFORE any teardown — a rejecting precheck aborts the enable without touching the kernel', async () => {
      const deps = makeDeps()
      const precheck = vi.fn(async () => {
        throw new Error('no active profile')
      })
      const tun = createTunController({ ...deps, precheck })

      await expect(tun.enable({ stack: 'gvisor' })).rejects.toThrow(
        'no active profile',
      )
      // The precondition failed before the destructive sequence ran — the
      // sidecar is never stopped, so the user is left in a recoverable state.
      expect(precheck).toHaveBeenCalledOnce()
      expect(deps.stopKernel).not.toHaveBeenCalled()
      expect(deps.injectTun).not.toHaveBeenCalled()
      expect(deps.startPrivileged).not.toHaveBeenCalled()
      expect(await tun.status()).toEqual({ enabled: false, mode: 'sidecar' })
    })

    it('runs precheck then the normal sequence when it passes', async () => {
      const deps = makeDeps()
      const precheck = vi.fn(async () => {})
      const tun = createTunController({ ...deps, precheck })

      await tun.enable({ stack: 'gvisor' })

      expect(precheck).toHaveBeenCalledOnce()
      expect(deps.order.filter((n) => n !== 'persist')).toEqual([
        'stopKernel',
        'injectTun',
        'startPrivileged',
      ])
    })

    it('skips precheck when already in TUN mode (idempotent no-op runs nothing)', async () => {
      const deps = makeDeps()
      const precheck = vi.fn(async () => {})
      const tun = createTunController({ ...deps, precheck })

      await tun.enable({ stack: 'gvisor' })
      precheck.mockClear()
      await tun.enable({ stack: 'gvisor' })

      expect(precheck).not.toHaveBeenCalled()
    })
  })

  describe('disable()', () => {
    it('stops the kernel, removes the tun block, then relaunches the sidecar — in order', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      // first enable so we have something to disable
      await tun.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await tun.disable()

      // teardown + relaunch order (persist is bookkeeping, filtered out)
      expect(deps.order.filter((n) => n !== 'persist')).toEqual([
        'stopKernel',
        'removeTun',
        'startSidecar',
      ])
      // the sidecar launcher is used for disable, never the privileged one
      expect(deps.startSidecar).toHaveBeenCalledTimes(1)
      // startPrivileged was only called by the earlier enable, not by disable
      expect(deps.startPrivileged).toHaveBeenCalledTimes(1)
    })

    it('sets state to disabled/sidecar', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })
      await tun.disable()

      expect(await tun.status()).toEqual({ enabled: false, mode: 'sidecar' })
    })

    it('persists the disabled/sidecar state for cold-start restore', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })
      deps.persist.mockClear()

      await tun.disable()

      expect(deps.persist).toHaveBeenCalledTimes(1)
      expect(deps.persist).toHaveBeenCalledWith({
        enabled: false,
        mode: 'sidecar',
      })
    })

    it('is idempotent: disabling when already sidecar does nothing', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.disable()

      expect(deps.order).toEqual([])
      expect(deps.stopKernel).not.toHaveBeenCalled()
      expect(deps.removeTun).not.toHaveBeenCalled()
      expect(deps.startSidecar).not.toHaveBeenCalled()
    })

    it('does not swallow errors from the injected deps', async () => {
      const deps = makeDeps()
      deps.removeTun.mockRejectedValueOnce(new Error('section write failed'))
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })

      await expect(tun.disable()).rejects.toThrow('section write failed')
    })
  })

  describe('status()', () => {
    it('defaults to disabled/sidecar before any call', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      expect(await tun.status()).toEqual({ enabled: false, mode: 'sidecar' })
    })
  })

  describe('uninstall()', () => {
    it('drops TUN to the sidecar FIRST, then removes the service — in order', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.enable({ stack: 'gvisor' })
      deps.order.length = 0

      await tun.uninstall!()

      // Never unregister a service still owning the kernel: full disable teardown
      // runs before the service removal.
      expect(deps.order.filter((n) => n !== 'persist')).toEqual([
        'stopKernel',
        'removeTun',
        'startSidecar',
        'uninstall',
      ])
      expect(await tun.status()).toEqual({ enabled: false, mode: 'sidecar' })
    })

    it('removes the service directly when already in the sidecar (no teardown)', async () => {
      const deps = makeDeps()
      const tun = createTunController(deps)

      await tun.uninstall!()

      expect(deps.order).toEqual(['uninstall'])
      expect(deps.stopKernel).not.toHaveBeenCalled()
      expect(deps.removeTun).not.toHaveBeenCalled()
      expect(deps.startSidecar).not.toHaveBeenCalled()
    })

    it('is absent when no uninstall dependency is wired (capability reflects reality)', () => {
      const deps = makeDeps()
      const { uninstall: _uninstall, ...rest } = deps
      const tun = createTunController(rest)

      expect(tun.uninstall).toBeUndefined()
    })

    it('does not swallow errors from the injected uninstall', async () => {
      const deps = makeDeps()
      deps.uninstall.mockRejectedValueOnce(new Error('pkexec denied'))
      const tun = createTunController(deps)

      await expect(tun.uninstall!()).rejects.toThrow('pkexec denied')
    })
  })
})
