import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useProxiesStore } from '../proxies'

const apiMocks = vi.hoisted(() => ({
  fetchProxyProvidersAPI: vi.fn(),
  fetchProxiesAPI: vi.fn(),
  proxyLatencyTestAPI: vi.fn(),
  proxyGroupLatencyTestAPI: vi.fn(),
}))

vi.mock('~/composables/useApi', () => ({
  closeSingleConnectionAPI: vi.fn(),
  fetchProxiesAPI: apiMocks.fetchProxiesAPI,
  fetchProxyProvidersAPI: apiMocks.fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI: apiMocks.proxyGroupLatencyTestAPI,
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

const recordTestResultMock = vi.fn()
const recordBatchResultsMock = vi.fn()
vi.stubGlobal('useNodeRecommendationStore', () => ({
  recordTestResult: recordTestResultMock,
  recordBatchResults: recordBatchResultsMock,
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
    recordTestResultMock.mockReset()
    recordBatchResultsMock.mockReset()
    apiMocks.fetchProxyProvidersAPI.mockResolvedValue({ providers: {} })
  })

  it('preserves the previous latency value while an individual test is in flight', async () => {
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

    // The Latency pill renders a spinner via proxyLatencyTestingMap; the
    // underlying value should stay at its previous reading so that on failure
    // we don't leak "---" out the other side.
    expect(store.proxyLatencyTestingMap['node-a']).toBe(true)
    expect(store.getLatencyByName('node-a', null)).toBe(88)
    expect(store.getLatencyHistoryByName('node-a', null)).toEqual([
      { time: '2026-05-19T13:17:31.000Z', delay: 88 },
    ])

    resolveLatency({ delay: 42 })
    await testing
  })

  it('appends new latency to history while preserving prior entries', async () => {
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

    const history = store.getLatencyHistoryByName('node-a', null)
    expect(history).toHaveLength(2)
    expect(history[0]).toEqual({
      time: '2026-05-19T13:17:31.000Z',
      delay: 88,
    })
    expect(history[1]?.delay).toBe(42)
    expect(typeof history[1]?.time).toBe('string')
  })

  it('records a failed entry in history without clobbering the latency map when an individual test errors', async () => {
    apiMocks.proxyLatencyTestAPI.mockRejectedValue(new Error('boom'))

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

    // Previous value preserved so the pill stays informative on transport
    // failures; the failure datapoint surfaces via stability bar / sparkline
    // through history + nodeRecommendation.
    expect(store.getLatencyByName('node-a', null)).toBe(88)

    const history = store.getLatencyHistoryByName('node-a', null)
    expect(history).toHaveLength(2)
    expect(history[1]?.delay).toBe(0)

    expect(recordTestResultMock).toHaveBeenCalledWith('node-a', null, false)
  })

  it('preserves prior latency map values when a group latency test fails, only recording failure history', async () => {
    apiMocks.proxyGroupLatencyTestAPI.mockRejectedValue(
      new Error('Request timed out'),
    )
    apiMocks.fetchProxiesAPI.mockResolvedValue({ proxies: {} })

    const store = useProxiesStore()
    store.proxies = [
      {
        name: 'GROUP',
        type: 'Selector',
        all: ['node-a', 'node-b'],
        extra: {},
        history: [],
        hidden: false,
        udp: false,
        xudp: false,
        tfo: false,
        now: 'node-a',
      } as never,
    ]
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
      'node-b': {
        name: 'node-b',
        alive: true,
        udp: false,
        tfo: false,
        latencyTestHistory: {},
        latency: '',
        xudp: false,
        type: 'ss',
        provider: '',
      },
    }
    store.latencyMap = {
      'node-a': { [mockConfigStore.urlForLatencyTest]: 88 },
      'node-b': { [mockConfigStore.urlForLatencyTest]: 120 },
    }

    // Must not reject — store should swallow the network failure.
    await expect(store.proxyGroupLatencyTest('GROUP')).resolves.toBeUndefined()

    expect(store.proxyGroupLatencyTestingMap.GROUP).toBe(false)
    expect(recordBatchResultsMock).toHaveBeenCalledWith({
      'node-a': 0,
      'node-b': 0,
    })

    // Latency map values stay at what they were before the failed test —
    // the user's pills don't suddenly turn into "---".
    expect(store.getLatencyByName('node-a', null)).toBe(88)
    expect(store.getLatencyByName('node-b', null)).toBe(120)

    const aHistory = store.getLatencyHistoryByName('node-a', null)
    expect(aHistory).toHaveLength(2)
    expect(aHistory[1]?.delay).toBe(0)

    const bHistory = store.getLatencyHistoryByName('node-b', null)
    expect(bHistory).toHaveLength(1)
    expect(bHistory[0]?.delay).toBe(0)
  })

  it('batch-tests every provider node via the delay API', async () => {
    apiMocks.proxyLatencyTestAPI
      .mockResolvedValueOnce({ delay: 120 })
      .mockResolvedValueOnce({ delay: 88 })
    apiMocks.fetchProxiesAPI.mockResolvedValue({ proxies: {} })

    const store = useProxiesStore()
    store.proxyProviders = [
      {
        name: '订阅',
        vehicleType: 'HTTP',
        updatedAt: '2026-05-27T00:00:00.000Z',
        testUrl: 'https://latency.test/provider',
        timeout: 3000,
        proxies: [{ name: 'node-a' }, { name: 'node-b' }],
      } as never,
    ]
    store.proxyNodeMap = {
      'node-a': {
        name: 'node-a',
        alive: true,
        udp: false,
        tfo: false,
        latencyTestHistory: {},
        latency: '',
        xudp: false,
        type: 'ss',
        provider: '订阅',
      },
      'node-b': {
        name: 'node-b',
        alive: true,
        udp: false,
        tfo: false,
        latencyTestHistory: {},
        latency: '',
        xudp: false,
        type: 'ss',
        provider: '订阅',
      },
    }

    await store.proxyProviderLatencyTest('订阅')

    expect(apiMocks.proxyLatencyTestAPI).toHaveBeenCalledTimes(2)
    expect(apiMocks.proxyLatencyTestAPI).toHaveBeenNthCalledWith(
      1,
      'node-a',
      '',
      'https://latency.test/provider',
      3000,
    )
    expect(apiMocks.proxyLatencyTestAPI).toHaveBeenNthCalledWith(
      2,
      'node-b',
      '',
      'https://latency.test/provider',
      3000,
    )
    expect(recordBatchResultsMock).toHaveBeenCalledWith({
      'node-a': 120,
      'node-b': 88,
    })
    expect(
      store.getLatencyByName('node-a', 'https://latency.test/provider'),
    ).toBe(120)
    expect(
      store.getLatencyByName('node-b', 'https://latency.test/provider'),
    ).toBe(88)
    expect(store.proxyProviderLatencyTestingMap['订阅']).toBe(false)
  })

  it('notifies node recommendation store after a proxy group latency test', async () => {
    apiMocks.proxyGroupLatencyTestAPI.mockResolvedValue({
      'node-a': 120,
      'node-b': 0,
    })
    apiMocks.fetchProxiesAPI.mockResolvedValue({
      proxies: {
        GROUP: {
          name: 'GROUP',
          type: 'Selector',
          all: ['node-a', 'node-b'],
          extra: {},
          history: [],
          hidden: false,
          udp: false,
          xudp: false,
          tfo: false,
          now: 'node-a',
        },
        'node-a': proxy({
          name: 'node-a',
          history: [{ time: '2026-05-19T13:18:00.000Z', delay: 120 }],
        }),
        'node-b': proxy({ name: 'node-b' }),
      },
    })

    const store = useProxiesStore()
    await store.proxyGroupLatencyTest('GROUP')

    expect(recordBatchResultsMock).toHaveBeenCalledWith({
      'node-a': 120,
      'node-b': 0,
    })
    expect(store.getLatencyByName('node-a', null)).toBe(120)
    expect(store.getLatencyByName('node-b', null)).toBe(0)
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

  it('reuses a node latency measured under a provider test url when the proxy view queries the global url', async () => {
    const store = useProxiesStore()
    apiMocks.fetchProxiesAPI.mockResolvedValue({
      proxies: {
        'node-a': proxy({
          name: 'node-a',
          type: 'vless',
          // Backend only has a reading under the provider's health-check url;
          // the global url (used by the proxies view) was never measured.
          extra: {
            'https://latency.test/provider': {
              history: [{ time: '2026-05-19T13:17:31.000Z', delay: 506 }],
            },
          },
          history: [],
        }),
      },
    })

    await store.fetchProxies()
    await nextTick()

    // Provider view (queries the provider url) shows the real value.
    expect(
      store.getLatencyByName('node-a', 'https://latency.test/provider'),
    ).toBe(506)

    // Proxies view falls back to the global url. It must reuse the value that
    // was actually measured rather than reporting "---" (0).
    expect(store.getLatencyByName('node-a', null)).toBe(506)
  })

  it('reuses a node latency history measured under a provider test url when the proxy view queries the global url', async () => {
    const store = useProxiesStore()
    apiMocks.fetchProxiesAPI.mockResolvedValue({
      proxies: {
        'node-a': proxy({
          name: 'node-a',
          type: 'vless',
          extra: {
            'https://latency.test/provider': {
              history: [{ time: '2026-05-19T13:17:31.000Z', delay: 506 }],
            },
          },
          history: [],
        }),
      },
    })

    await store.fetchProxies()
    await nextTick()

    // The stability bar / sparkline reads history. It must reuse the measured
    // series instead of the empty placeholder bucket for the global url.
    expect(store.getLatencyHistoryByName('node-a', null)).toEqual([
      { time: '2026-05-19T13:17:31.000Z', delay: 506 },
    ])
  })
})
