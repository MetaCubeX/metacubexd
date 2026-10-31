import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import {
  applyConfigPatch,
  useEndpointScopedKey,
  useUpdateConfigMutation,
} from '../useQueries'

const mocks = vi.hoisted(() => ({
  patch: vi.fn(),
  getKernelStatus: vi.fn(),
  setConfigSection: vi.fn(),
  hasFeature: vi.fn(() => true),
  mockMode: false,
}))

vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: unknown) => options,
}))
vi.mock('../useControlApi', () => ({
  useControlApi: () => ({
    getKernelStatus: mocks.getKernelStatus,
    setConfigSection: mocks.setConfigSection,
  }),
}))
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({ hasFeature: mocks.hasFeature }),
}))

// useQueries.ts imports ./useApi at module load; stub it so importing the
// module under test has no side effects.
vi.mock('../useApi', () => ({
  useRequest: () => ({ patch: mocks.patch }),
  useMockMode: () => mocks.mockMode,
  toggleRuleDisabledAPI: vi.fn(),
}))

const mockEndpointStore = reactive<{
  selectedEndpoint: string
  currentEndpoint: { url: string; secret: string } | undefined
}>({
  selectedEndpoint: 'endpoint-a',
  currentEndpoint: { url: 'http://localhost:9090', secret: 'managed-secret' },
})
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)

describe('composables/useQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEndpointStore.selectedEndpoint = 'endpoint-a'
    mockEndpointStore.currentEndpoint = {
      url: 'http://localhost:9090',
      secret: 'managed-secret',
    }
    mocks.hasFeature.mockReturnValue(true)
    mocks.mockMode = false
    mocks.getKernelStatus.mockResolvedValue({
      externalController: '0.0.0.0:9090',
      secret: 'managed-secret',
    })
    mocks.patch.mockResolvedValue(undefined)
    mocks.setConfigSection.mockResolvedValue(undefined)
    delete (window as any).metacubexd
  })

  describe('managed config persistence', () => {
    const save = () =>
      (
        useUpdateConfigMutation() as unknown as {
          mutationFn: (value: { key: 'mode'; value: string }) => Promise<void>
        }
      ).mutationFn({ key: 'mode', value: 'global' })

    it('does not persist a remote endpoint change to the desktop agent', async () => {
      ;(window as any).metacubexd = {
        isDesktop: true,
        endpoint: { url: 'http://127.0.0.1:9090', secret: 'local-secret' },
      }
      mockEndpointStore.currentEndpoint = {
        url: 'https://remote.example.invalid',
        secret: 'remote-secret',
      }
      await save()
      expect(mocks.patch).toHaveBeenCalledWith('configs', {
        json: { mode: 'global' },
      })
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('persists the desktop bridge endpoint regardless of its saved id', async () => {
      ;(window as any).metacubexd = {
        isDesktop: true,
        endpoint: { url: 'http://localhost:9090/', secret: 'managed-secret' },
      }
      await save()
      expect(mocks.setConfigSection).toHaveBeenCalledWith({
        key: 'mode',
        value: 'global',
        restart: false,
      })
      expect(mocks.getKernelStatus).not.toHaveBeenCalled()
    })

    it('does not trust a matching managed URL with a different secret', async () => {
      ;(window as any).metacubexd = {
        isDesktop: true,
        endpoint: { url: 'http://localhost:9090', secret: 'other-secret' },
      }
      await save()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('persists an AIO endpoint authenticated by the kernel status', async () => {
      await save()
      expect(mocks.getKernelStatus).toHaveBeenCalledOnce()
      expect(mocks.setConfigSection).toHaveBeenCalledWith({
        key: 'mode',
        value: 'global',
        restart: false,
      })
    })

    it('does not persist when the AIO ownership probe fails', async () => {
      mocks.getKernelStatus.mockRejectedValue(new Error('unreachable'))
      await save()
      expect(mocks.patch).toHaveBeenCalledOnce()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('does not persist an unrelated remote endpoint on an AIO page', async () => {
      mockEndpointStore.currentEndpoint!.url =
        'http://remote.example.invalid:9090'
      await save()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('normalizes the AIO controller URL and checks its secret', async () => {
      mocks.getKernelStatus.mockResolvedValue({
        externalController: '[::]:9090',
        secret: 'managed-secret',
      })
      mockEndpointStore.currentEndpoint!.url = 'http://LOCALHOST:9090/'
      await save()
      expect(mocks.setConfigSection).toHaveBeenCalledOnce()
      mocks.setConfigSection.mockClear()
      mockEndpointStore.currentEndpoint!.secret = 'different-secret'
      await save()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('reuses a successful ownership lookup and retries a failed lookup', async () => {
      const mutation = useUpdateConfigMutation() as unknown as {
        mutationFn: (value: { key: 'mode'; value: string }) => Promise<void>
      }
      mocks.getKernelStatus.mockRejectedValueOnce(
        new Error('temporarily unavailable'),
      )
      await mutation.mutationFn({ key: 'mode', value: 'global' })
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
      await mutation.mutationFn({ key: 'mode', value: 'global' })
      await mutation.mutationFn({ key: 'mode', value: 'rule' })
      expect(mocks.getKernelStatus).toHaveBeenCalledTimes(2)
      expect(mocks.setConfigSection).toHaveBeenCalledTimes(2)
    })

    it('does not query the host agent for a plain remote panel', async () => {
      mocks.hasFeature.mockReturnValue(false)
      await save()
      expect(mocks.getKernelStatus).not.toHaveBeenCalled()
      expect(mocks.patch).toHaveBeenCalledOnce()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('keeps mock controls usable without a saved endpoint', async () => {
      mockEndpointStore.currentEndpoint = undefined
      mocks.mockMode = true
      await save()
      expect(mocks.patch).toHaveBeenCalledWith('configs', {
        json: { mode: 'global' },
      })
      expect(mocks.getKernelStatus).not.toHaveBeenCalled()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })

    it('does not persist when the endpoint changes while the PATCH is pending', async () => {
      ;(window as any).metacubexd = {
        isDesktop: true,
        endpoint: { ...mockEndpointStore.currentEndpoint },
      }
      let finish!: () => void
      mocks.patch.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve
        }),
      )
      const mutation = save()
      await vi.waitUntil(() => mocks.patch.mock.calls.length === 1)
      mockEndpointStore.selectedEndpoint = 'endpoint-b'
      finish()
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mutation
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
      warn.mockRestore()
    })

    it('abandons a save when its endpoint changes during the ownership probe', async () => {
      let finish!: (value: {
        externalController: string
        secret: string
      }) => void
      mocks.getKernelStatus.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
      const pending = save()
      mockEndpointStore.currentEndpoint!.url =
        'http://remote.example.invalid:9090'
      finish({ externalController: '0.0.0.0:9090', secret: 'managed-secret' })
      await expect(pending).rejects.toThrow()
      expect(mocks.patch).not.toHaveBeenCalled()
      expect(mocks.setConfigSection).not.toHaveBeenCalled()
    })
  })

  describe('useEndpointScopedKey', () => {
    it('appends the current endpoint to the base key', () => {
      const key = useEndpointScopedKey(['proxies'])
      expect(key.value).toEqual(['proxies', 'endpoint-a'])
    })

    it('updates reactively when the endpoint changes, so vue-query refetches under a new key', () => {
      const key = useEndpointScopedKey(['config'])
      expect(key.value).toEqual(['config', 'endpoint-a'])

      mockEndpointStore.selectedEndpoint = 'endpoint-b'

      expect(key.value).toEqual(['config', 'endpoint-b'])
    })
  })

  describe('applyConfigPatch', () => {
    it('hot-applies the change via the PATCH callback', async () => {
      const patch = vi.fn().mockResolvedValue(undefined)
      await applyConfigPatch('allow-lan', true, { patch })
      expect(patch).toHaveBeenCalledWith({ 'allow-lan': true })
    })

    it('persists the same change to the active profile when persist is supplied (#2070)', async () => {
      const patch = vi.fn().mockResolvedValue(undefined)
      const persist = vi.fn().mockResolvedValue(undefined)
      await applyConfigPatch('mode', 'global', { patch, persist })
      expect(patch).toHaveBeenCalledWith({ mode: 'global' })
      expect(persist).toHaveBeenCalledWith({ key: 'mode', value: 'global' })
    })

    it('skips persistence on a plain remote backend (no persist callback)', async () => {
      const patch = vi.fn().mockResolvedValue(undefined)
      await expect(
        applyConfigPatch('allow-lan', true, { patch }),
      ).resolves.toBeUndefined()
      expect(patch).toHaveBeenCalledOnce()
    })

    it('does not persist if the live PATCH itself fails', async () => {
      const patch = vi.fn().mockRejectedValue(new Error('network'))
      const persist = vi.fn()
      await expect(
        applyConfigPatch('allow-lan', true, { patch, persist }),
      ).rejects.toThrow('network')
      expect(persist).not.toHaveBeenCalled()
    })

    it('swallows a persistence failure — the live change already took effect', async () => {
      const patch = vi.fn().mockResolvedValue(undefined)
      const persist = vi
        .fn()
        .mockRejectedValue(new Error('409 no active profile'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await expect(
        applyConfigPatch('allow-lan', true, { patch, persist }),
      ).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })
})
