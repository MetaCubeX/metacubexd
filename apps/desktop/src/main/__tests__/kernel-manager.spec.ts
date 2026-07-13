import type { KernelState, MihomoSupervisor } from '@metacubexd/agent/types'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createKernelManager } from '../kernel-manager'

/**
 * A minimal supervisor stub: records setBinaryPath/restart calls and reports a
 * canned running version via getState(). Only the methods the KernelManager
 * touches are real; the rest throw so an accidental call is loud.
 */
function makeSupervisor(version?: string) {
  const calls: string[] = []
  const setBinaryPath = vi.fn((p: string) => {
    calls.push(`setBinaryPath:${p}`)
  })
  const restart = vi.fn(async (): Promise<KernelState> => {
    calls.push('restart')
    return {
      status: 'running',
      externalController: '127.0.0.1:9090',
      secret: 's',
      version,
    }
  })
  const getState = vi.fn((): KernelState => ({
    status: version ? 'running' : 'stopped',
    externalController: '127.0.0.1:9090',
    secret: 's',
    version,
  }))
  const supervisor = {
    getState,
    setBinaryPath,
    restart,
  } as unknown as MihomoSupervisor
  return { supervisor, calls, setBinaryPath, restart, getState }
}

describe('createKernelManager', () => {
  describe('listVersions()', () => {
    it('merges the injected version list with the running current + bundled', async () => {
      const { supervisor } = makeSupervisor('v1.19.10')
      const listVersions = vi.fn(async () => [
        'v1.19.27',
        'v1.19.10',
        'v1.18.0',
      ])

      const mgr = createKernelManager({
        supervisor,
        os: 'darwin',
        arch: 'arm64',
        kernelsDir: '/data/kernels',
        overridePath: '/data/mihomo-bin-override.txt',
        listVersions,
        // switch() deps unused here, but required for typing:
        fetchKernel: vi.fn(),
        writeOverride: vi.fn(),
      })

      const result = await mgr.listVersions()

      expect(listVersions).toHaveBeenCalledTimes(1)
      expect(result.versions).toEqual(['v1.19.27', 'v1.19.10', 'v1.18.0'])
      // current is taken from the running supervisor state.
      expect(result.current).toBe('v1.19.10')
      // bundled is the agent's MIHOMO_VERSION default.
      expect(result.bundled).toBe('v1.19.27')
    })

    it('reports current as undefined when the kernel reports no version', async () => {
      const { supervisor } = makeSupervisor(undefined)
      const listVersions = vi.fn(async () => ['v1.19.27'])

      const mgr = createKernelManager({
        supervisor,
        os: 'linux',
        arch: 'x64',
        kernelsDir: '/data/kernels',
        overridePath: '/data/override.txt',
        listVersions,
        fetchKernel: vi.fn(),
        writeOverride: vi.fn(),
      })

      const result = await mgr.listVersions()
      expect(result.current).toBeUndefined()
      expect(result.bundled).toBe('v1.19.27')
    })
  })

  describe('switch()', () => {
    it('downloads, persists the override, swaps the binary, then restarts — in order', async () => {
      const { supervisor, setBinaryPath, restart } = makeSupervisor('v1.19.10')
      const order: string[] = []
      const binPath = '/data/kernels/v1.19.27/mihomo'

      const fetchKernel = vi.fn(async () => {
        order.push('fetchKernel')
        return { binPath }
      })
      const writeOverride = vi.fn(async () => {
        order.push('writeOverride')
      })
      setBinaryPath.mockImplementation(() => {
        order.push('setBinaryPath')
      })
      restart.mockImplementation(async () => {
        order.push('restart')
        return supervisor.getState()
      })

      const mgr = createKernelManager({
        supervisor,
        os: 'darwin',
        arch: 'arm64',
        kernelsDir: '/data/kernels',
        overridePath: '/data/mihomo-bin-override.txt',
        fetchKernel,
        writeOverride,
        listVersions: vi.fn(),
      })

      await mgr.switch('v1.19.27')

      // fetchKernel(os, arch, join(kernelsDir, version), { version })
      expect(fetchKernel).toHaveBeenCalledWith(
        'darwin',
        'arm64',
        join('/data/kernels', 'v1.19.27'),
        { version: 'v1.19.27' },
      )
      // override file written with the freshly downloaded binPath
      expect(writeOverride).toHaveBeenCalledWith(
        '/data/mihomo-bin-override.txt',
        binPath,
      )
      // supervisor swapped + restarted with the new path
      expect(setBinaryPath).toHaveBeenCalledWith(binPath)
      expect(restart).toHaveBeenCalledTimes(1)
      // strict ordering: download -> persist -> swap -> restart
      expect(order).toEqual([
        'fetchKernel',
        'writeOverride',
        'setBinaryPath',
        'restart',
      ])
    })

    it('does not write the override or restart when the download fails', async () => {
      const { supervisor, setBinaryPath, restart } = makeSupervisor('v1.19.10')
      const fetchKernel = vi.fn(async () => {
        throw new Error('download failed 404')
      })
      const writeOverride = vi.fn()

      const mgr = createKernelManager({
        supervisor,
        os: 'darwin',
        arch: 'arm64',
        kernelsDir: '/data/kernels',
        overridePath: '/data/mihomo-bin-override.txt',
        fetchKernel,
        writeOverride,
        listVersions: vi.fn(),
      })

      await expect(mgr.switch('v1.19.27')).rejects.toThrow('download failed')
      expect(writeOverride).not.toHaveBeenCalled()
      expect(setBinaryPath).not.toHaveBeenCalled()
      expect(restart).not.toHaveBeenCalled()
    })
  })
})
