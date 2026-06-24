import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { applyConfigPatch, useEndpointScopedKey } from '../useQueries'

// useQueries.ts imports ./useApi at module load; stub it so importing the
// module under test has no side effects.
vi.mock('../useApi', () => ({
  useRequest: vi.fn(),
  toggleRuleDisabledAPI: vi.fn(),
}))

const mockEndpointStore = reactive({ selectedEndpoint: 'endpoint-a' })
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)

describe('composables/useQueries', () => {
  beforeEach(() => {
    mockEndpointStore.selectedEndpoint = 'endpoint-a'
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
