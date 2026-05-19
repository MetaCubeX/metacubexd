import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useProxiesStore } from '../proxies'

const apiMocks = vi.hoisted(() => ({
  fetchProxyProvidersAPI: vi.fn(),
  fetchProxiesAPI: vi.fn(),
  proxyLatencyTestAPI: vi.fn(),
}))

vi.mock('~/composables/useApi', () => ({
  closeSingleConnectionAPI: vi.fn(),
  fetchProxiesAPI: apiMocks.fetchProxiesAPI,
  fetchProxyProvidersAPI: apiMocks.fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI: vi.fn(),
  proxyLatencyTestAPI: apiMocks.proxyLatencyTestAPI,
  proxyProviderHealthCheckAPI: vi.fn(),
  selectProxyInGroupAPI: vi.fn(),
  updateProxyProviderAPI: vi.fn(),
}))

const mockConfigStore = {
  autoCloseConns: false,
  latencyQualityMap: {
    NOT_CONNECTED: 0,
    MEDIUM: 200,
    HIGH: 500,
  },
  latencyTestTimeoutDuration: 5000,
  urlForLatencyTest: 'https://latency.test/default',
}

vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useConnectionsStore', () => ({
  latestConnectionMsg: null,
  restructRawMsgToConnection: vi.fn(() => []),
}))

function proxy(overrides: Record<string, unknown> = {}) {
  return {
    name: 'node-a',
    type: 'ss',
    extra: {},
    history: [],
    hidden: false,
    udp: false,
    xudp: false,
    tfo: false,
    now: '',
    ...overrides,
  }
}

describe('stores/proxies latency state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    apiMocks.fetchProxyProvidersAPI.mockResolvedValue({ providers: {} })
  })

  it('clears stale latency without clearing history when an individual latency test starts', async () => {
    let resolveLatency!: (value: { delay: number }) => void
    apiMocks.proxyLatencyTestAPI.mockReturnValue(
      new Promise((resolve) => {
        resolveLatency = resolve
      }),
    )

    const store = useProxiesStore()
    store.proxyNodeMap = {
      'node-a': {
        name: 'node-a',
        alive: true,
        udp: false,
        tfo: false,
        latencyTestHistory: {
          [mockConfigStore.urlForLatencyTest]: [
            { time: '2026-05-19T13:17:31.000Z', delay: 88 },
          ],
          'https://latency.test/old': [
            { time: '2026-05-19T13:15:31.000Z', delay: 66 },
          ],
        },
        latency: '',
        xudp: false,
        type: 'ss',
        provider: '',
      },
    }
    store.latencyMap = {
      'node-a': {
        [mockConfigStore.urlForLatencyTest]: 88,
        'https://latency.test/old': 66,
      },
    }

    const testing = store.proxyLatencyTest('node-a', '', null, null)

    expect(store.getLatencyByName('node-a', null)).toBe(0)
    expect(store.getLatencyHistoryByName('node-a', null)).toEqual([
      { time: '2026-05-19T13:17:31.000Z', delay: 88 },
    ])

    resolveLatency({ delay: 42 })
    await testing
  })

  it('keeps existing latency history when recording an individual test result', async () => {
    apiMocks.proxyLatencyTestAPI.mockResolvedValue({ delay: 42 })

    const store = useProxiesStore()
    store.proxyNodeMap = {
      'node-a': {
        name: 'node-a',
        alive: true,
        udp: false,
        tfo: false,
        latencyTestHistory: {
          [mockConfigStore.urlForLatencyTest]: [
            { time: '2026-05-19T13:17:31.000Z', delay: 88 },
          ],
        },
        latency: '',
        xudp: false,
        type: 'ss',
        provider: '',
      },
    }
    store.latencyMap = {
      'node-a': {
        [mockConfigStore.urlForLatencyTest]: 88,
      },
    }

    await store.proxyLatencyTest('node-a', '', null, null)

    expect(store.getLatencyByName('node-a', null)).toBe(42)
    expect(store.getLatencyHistoryByName('node-a', null)).toEqual([
      { time: '2026-05-19T13:17:31.000Z', delay: 88 },
    ])
    expect(store.getLatencyHistoryByName('node-a', null)).toHaveLength(1)
  })

  it('drops stale latency when fresh proxy data has no successful history', async () => {
    const store = useProxiesStore()
    store.latencyMap = {
      'node-a': {
        [mockConfigStore.urlForLatencyTest]: 88,
      },
    }
    apiMocks.fetchProxiesAPI.mockResolvedValue({
      proxies: {
        'node-a': proxy({
          history: [],
        }),
      },
    })

    await store.fetchProxies()
    await nextTick()

    expect(store.getLatencyByName('node-a', null)).toBe(0)
    expect(store.getLatencyHistoryByName('node-a', null)).toEqual([])
  })
})
