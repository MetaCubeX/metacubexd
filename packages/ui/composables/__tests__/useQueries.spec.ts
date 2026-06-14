import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useEndpointScopedKey } from '../useQueries'

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
})
