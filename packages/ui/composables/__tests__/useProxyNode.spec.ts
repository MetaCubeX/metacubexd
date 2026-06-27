import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProxiesStore } from '~/stores/proxies'
import { useProxyNode } from '../useProxyNode'

// useProxiesStore is auto-imported in the app; make the real store available
// globally so useProxyNode.ts (which calls useProxiesStore() unqualified) and
// the test itself share the same pinia instance seeded in beforeEach.
vi.stubGlobal('useProxiesStore', useProxiesStore)

vi.mock('~/composables/useApi', () => ({
  closeAllConnectionsAPI: vi.fn(),
  closeSingleConnectionAPI: vi.fn(),
  fetchProxiesAPI: vi.fn(),
  fetchProxyProvidersAPI: vi.fn().mockResolvedValue({ providers: {} }),
  proxyGroupLatencyTestAPI: vi.fn(),
  proxyLatencyTestAPI: vi.fn().mockResolvedValue({ delay: 0 }),
  selectProxyInGroupAPI: vi.fn(),
  unfixProxyInGroupAPI: vi.fn(),
  updateProxyProviderAPI: vi.fn(),
}))

const mockConfigStore = {
  autoCloseConns: false,
  latencyQualityMap: { NOT_CONNECTED: 0, MEDIUM: 200, HIGH: 500 },
  latencyTestTimeoutDuration: 5000,
  urlForLatencyTest: 'https://latency.test/default',
  resolveLatencyTestUrl: (groupTestUrl?: string | null) =>
    groupTestUrl || mockConfigStore.urlForLatencyTest,
}
vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useConnectionsStore', () => ({
  latestConnectionMsg: null,
  restructRawMsgToConnection: vi.fn(() => []),
}))
vi.stubGlobal('useNodeRecommendationStore', () => ({
  recordTestResult: vi.fn(),
  recordBatchResults: vi.fn(),
  getNodePerformance: vi.fn(),
}))

function seedNode(store: ReturnType<typeof useProxiesStore>) {
  store.__seed({
    nodes: {
      leaf: {
        name: 'leaf',
        alive: true,
        udp: true,
        tfo: false,
        xudp: false,
        type: 'ss',
        latency: '',
        provider: 'subA',
        latencyTestHistory: {
          [mockConfigStore.urlForLatencyTest]: [
            { time: '2026-06-21T00:00:00.000Z', delay: 88 },
          ],
        },
      },
    },
    latency: { leaf: { [mockConfigStore.urlForLatencyTest]: 88 } },
  })
}

describe('useProxyNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes the shared folds for a node', () => {
    const store = useProxiesStore()
    seedNode(store)

    const vm = useProxyNode(
      () => 'leaf',
      () => null,
      () => null,
      { providerName: () => 'subA' },
    )

    expect(vm.proxyType.value).toBe('ss')
    expect(vm.isUDP.value).toBe(true)
    expect(vm.latency.value).toBe(88)
    expect(vm.latencyColorClass.value).toBe('text-green-600')
    expect(vm.stabilityBar.value).toEqual([{ colorClass: 'text-green-600' }])
    expect(vm.historyReversed.value).toHaveLength(1)
    expect(vm.isTesting.value).toBe(false)
  })

  it('runLatencyTest binds the node provider and flips the testing flag', () => {
    const store = useProxiesStore()
    seedNode(store)
    const spy = vi.spyOn(store, 'proxyLatencyTest')

    const vm = useProxyNode(
      () => 'leaf',
      () => null,
      () => 3000,
      { providerName: () => 'subA' },
    )
    vm.runLatencyTest()

    expect(spy).toHaveBeenCalledWith('leaf', 'subA', null, 3000)
  })
})
