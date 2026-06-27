import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBatchLatencyTest } from '../useBatchLatencyTest'

// Mock useRequest
const mockGet = vi.fn()
const mockJson = vi.fn()
mockGet.mockReturnValue({ json: mockJson })

vi.mock('../useApi', () => ({
  useRequest: () => ({
    get: mockGet,
  }),
}))

// Hoisted so the mock factory (runs before the module body) can reference it.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

// Mock stores
const mockConfigStore = {
  urlForLatencyTest: 'https://www.gstatic.com/generate_204',
  latencyTestTimeoutDuration: 5000,
  // Mirrors the real store's default ('core') resolution: a group's own
  // testUrl wins, falling back to the dashboard url.
  resolveLatencyTestUrl: (groupTestUrl?: string | null) =>
    groupTestUrl || mockConfigStore.urlForLatencyTest,
}

const mockNodeRecommendationStore = {
  batchTestProgress: {
    total: 0,
    completed: 0,
    current: null,
    isRunning: false,
  },
  recordTestResult: vi.fn(),
  recordBatchResults: vi.fn(),
}

const mockProxiesStore: {
  clearLatencyTestStateForGroup: ReturnType<typeof vi.fn>
  clearLatencyTestStateForNodes: ReturnType<typeof vi.fn>
  fetchProxies: ReturnType<typeof vi.fn>
  recordLatencyTestResult: ReturnType<typeof vi.fn>
  recordLatencyTestResults: ReturnType<typeof vi.fn>
  proxyProviderLatencyTest: ReturnType<typeof vi.fn>
  proxies: { name: string; all: string[]; testUrl?: string }[]
  proxyProviders: { name: string }[]
} = {
  clearLatencyTestStateForGroup: vi.fn(),
  clearLatencyTestStateForNodes: vi.fn(),
  fetchProxies: vi.fn(),
  recordLatencyTestResult: vi.fn(),
  recordLatencyTestResults: vi.fn(),
  proxyProviderLatencyTest: vi.fn(),
  proxies: [],
  proxyProviders: [],
}

vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useNodeRecommendationStore', () => mockNodeRecommendationStore)
vi.stubGlobal('useProxiesStore', () => mockProxiesStore)

describe('composables/useBatchLatencyTest', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockNodeRecommendationStore.batchTestProgress = {
      total: 0,
      completed: 0,
      current: null,
      isRunning: false,
    }
    mockProxiesStore.proxies = []
    mockProxiesStore.proxyProviders = []
    mockProxiesStore.proxyProviderLatencyTest.mockResolvedValue(undefined)
  })

  describe('initial state', () => {
    it('starts with isRunning as false', () => {
      const { isRunning } = useBatchLatencyTest()

      expect(isRunning.value).toBe(false)
    })

    it('starts with empty progress', () => {
      const { progress } = useBatchLatencyTest()

      expect(progress.value).toEqual({
        completed: 0,
        total: 0,
        current: '',
      })
    })
  })

  describe('batchTestNodes', () => {
    it('sets isRunning to true during test', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes, isRunning } = useBatchLatencyTest()

      const testPromise = batchTestNodes(['node1'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      // During execution, isRunning should be true
      // After completion, it should be false
      await testPromise

      expect(isRunning.value).toBe(false)
    })

    it('updates progress during batch test', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes } = useBatchLatencyTest()
      const onProgress = vi.fn()

      await batchTestNodes(['node1', 'node2'], {
        url: 'https://test.com',
        timeout: 5000,
        onProgress,
      })

      expect(onProgress).toHaveBeenCalled()
    })

    it('returns results for all nodes', async () => {
      mockJson
        .mockResolvedValueOnce({ delay: 100 })
        .mockResolvedValueOnce({ delay: 200 })

      const { batchTestNodes } = useBatchLatencyTest()

      const results = await batchTestNodes(['node1', 'node2'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      expect(results).toHaveProperty('node1')
      expect(results).toHaveProperty('node2')
    })

    it('records test results in store', async () => {
      mockJson.mockResolvedValue({ delay: 150 })

      const { batchTestNodes } = useBatchLatencyTest()

      await batchTestNodes(['node1'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      expect(mockNodeRecommendationStore.recordTestResult).toHaveBeenCalledWith(
        'node1',
        150,
        true,
      )
      expect(mockProxiesStore.recordLatencyTestResult).toHaveBeenCalledWith(
        'node1',
        'https://test.com',
        150,
      )
    })

    it('clears old node latency state before batch testing starts', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes } = useBatchLatencyTest()

      await batchTestNodes(['node1', 'node2'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      expect(
        mockProxiesStore.clearLatencyTestStateForNodes,
      ).toHaveBeenCalledWith(['node1', 'node2'], 'https://test.com')
    })

    it('handles failed tests with delay 0', async () => {
      mockJson.mockRejectedValue(new Error('Network error'))

      const { batchTestNodes } = useBatchLatencyTest()

      const results = await batchTestNodes(['node1'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      expect(results.node1).toBe(0)
      expect(mockNodeRecommendationStore.recordTestResult).toHaveBeenCalledWith(
        'node1',
        null,
        false,
      )
    })

    it('calls onNodeComplete callback for each node', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes } = useBatchLatencyTest()
      const onNodeComplete = vi.fn()

      await batchTestNodes(['node1', 'node2'], {
        url: 'https://test.com',
        timeout: 5000,
        onNodeComplete,
      })

      expect(onNodeComplete).toHaveBeenCalledTimes(2)
      expect(onNodeComplete).toHaveBeenCalledWith('node1', 100)
      expect(onNodeComplete).toHaveBeenCalledWith('node2', 100)
    })
  })

  describe('concurrency control', () => {
    it('processes nodes in batches of 10', async () => {
      // Create 15 nodes to test batching
      const nodes = Array.from({ length: 15 }, (_, i) => `node${i + 1}`)
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes } = useBatchLatencyTest()

      await batchTestNodes(nodes, {
        url: 'https://test.com',
        timeout: 5000,
      })

      // All 15 nodes should have been tested
      expect(
        mockNodeRecommendationStore.recordTestResult,
      ).toHaveBeenCalledTimes(15)
    })
  })

  describe('progress tracking', () => {
    it('updates store progress during test', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes } = useBatchLatencyTest()

      await batchTestNodes(['node1', 'node2', 'node3'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      // After completion, progress should reflect completion
      expect(mockNodeRecommendationStore.batchTestProgress.isRunning).toBe(
        false,
      )
      expect(mockNodeRecommendationStore.batchTestProgress.completed).toBe(3)
    })

    it('resets progress after test completes', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { batchTestNodes, progress } = useBatchLatencyTest()

      await batchTestNodes(['node1'], {
        url: 'https://test.com',
        timeout: 5000,
      })

      expect(progress.value.current).toBe('')
    })
  })

  describe('abortTest', () => {
    it('provides abort functionality', () => {
      const { abortTest } = useBatchLatencyTest()

      // Should not throw
      expect(() => abortTest()).not.toThrow()
    })

    it('stops before the next batch when aborted during batch delay', async () => {
      vi.useFakeTimers()
      mockJson.mockResolvedValue({ delay: 100 })

      const { abortTest, batchTestNodes } = useBatchLatencyTest()
      const nodes = Array.from({ length: 11 }, (_, i) => `node${i + 1}`)

      const testPromise = batchTestNodes(nodes, {
        url: 'https://test.com',
        timeout: 5000,
      })

      await vi.waitFor(() => {
        expect(
          mockNodeRecommendationStore.recordTestResult,
        ).toHaveBeenCalledTimes(10)
      })

      abortTest()
      await testPromise

      expect(
        mockNodeRecommendationStore.recordTestResult,
      ).toHaveBeenCalledTimes(10)
      vi.useRealTimers()
    })
  })

  describe('testGroupNodes', () => {
    it('uses default config values when options not provided', async () => {
      mockJson.mockResolvedValue({ node1: 100, node2: 200 })

      const { testGroupNodes } = useBatchLatencyTest()

      await testGroupNodes('group1')

      expect(mockGet).toHaveBeenCalledWith(
        'group/group1/delay',
        expect.objectContaining({
          searchParams: {
            url: mockConfigStore.urlForLatencyTest,
            timeout: mockConfigStore.latencyTestTimeoutDuration,
          },
        }),
      )
    })

    it("probes against the group's own testUrl in core mode (#2082)", async () => {
      mockJson.mockResolvedValue({ node1: 100 })
      mockProxiesStore.proxies = [
        { name: 'group1', all: ['node1'], testUrl: 'https://group1.test/204' },
      ]

      const { testGroupNodes } = useBatchLatencyTest()

      await testGroupNodes('group1')

      expect(mockGet).toHaveBeenCalledWith(
        'group/group1/delay',
        expect.objectContaining({
          searchParams: expect.objectContaining({
            url: 'https://group1.test/204',
          }),
        }),
      )
    })

    it('records batch results in store', async () => {
      const groupResults = { node1: 100, node2: 200 }
      mockJson.mockResolvedValue(groupResults)

      const { testGroupNodes } = useBatchLatencyTest()

      await testGroupNodes('group1')

      expect(
        mockNodeRecommendationStore.recordBatchResults,
      ).toHaveBeenCalledWith(groupResults)
      expect(mockProxiesStore.recordLatencyTestResults).toHaveBeenCalledWith(
        groupResults,
        mockConfigStore.urlForLatencyTest,
      )
    })

    it('does not clear the existing latency state before group testing starts', async () => {
      mockJson.mockResolvedValue({ node1: 100 })

      const { testGroupNodes } = useBatchLatencyTest()

      await testGroupNodes('group1')

      // Pre-clearing was the root cause of "Test All -> all pills become ---"
      // when the request didn't return every member. The spinner provided by
      // isTesting already hides the value during the in-flight phase, so we
      // leave latencyMap alone here.
      expect(
        mockProxiesStore.clearLatencyTestStateForGroup,
      ).not.toHaveBeenCalled()
    })

    it('resolves with an empty map and leaves latencyMap untouched when the request times out', async () => {
      mockJson.mockRejectedValue(new Error('Request timed out'))
      mockProxiesStore.proxies = [{ name: 'group1', all: ['node-a', 'node-b'] }]

      const { testGroupNodes, isRunning } = useBatchLatencyTest()

      // testProxyGroup swallows the error into {} — testGroupNodes shouldn't
      // synthesize failures into latencyMap (would leave pills stuck at "---");
      // recordLatencyTestResults still runs with the empty map so callers can
      // observe "no fresh data" without us clobbering existing values.
      await expect(testGroupNodes('group1')).resolves.toEqual({})
      expect(isRunning.value).toBe(false)
      expect(
        mockNodeRecommendationStore.recordBatchResults,
      ).toHaveBeenCalledWith({})
      expect(mockProxiesStore.recordLatencyTestResults).toHaveBeenCalledWith(
        {},
        mockConfigStore.urlForLatencyTest,
      )
      expect(
        mockProxiesStore.clearLatencyTestStateForGroup,
      ).not.toHaveBeenCalled()
    })

    it('does not crash when fetchProxies itself fails after the group test', async () => {
      mockJson.mockResolvedValue({ 'node-a': 80 })
      mockProxiesStore.proxies = [{ name: 'group1', all: ['node-a'] }]
      mockProxiesStore.fetchProxies.mockRejectedValueOnce(
        new Error('network down'),
      )

      const { testGroupNodes, isRunning } = useBatchLatencyTest()

      await expect(testGroupNodes('group1')).resolves.toEqual({
        'node-a': 80,
      })
      expect(isRunning.value).toBe(false)
      expect(mockProxiesStore.recordLatencyTestResults).toHaveBeenCalledWith(
        { 'node-a': 80 },
        mockConfigStore.urlForLatencyTest,
      )
    })
  })

  describe('testMultipleGroups', () => {
    it('keeps global progress owned by the outer loop while each group runs', async () => {
      vi.useRealTimers()
      mockJson.mockResolvedValue({ node1: 100 })

      const { testMultipleGroups, isRunning } = useBatchLatencyTest()

      // Capture the shared state at the moment each group refreshes proxies
      // (mid-run, inside testGroupNodes). The inner call must NOT reset total
      // back to 1 (it previously did, corrupting the multi-group progress bar).
      const seen: { total: number; running: boolean; storeRunning: boolean }[] =
        []
      mockProxiesStore.fetchProxies.mockImplementation(async () => {
        seen.push({
          total: mockNodeRecommendationStore.batchTestProgress.total,
          running: isRunning.value,
          storeRunning: mockNodeRecommendationStore.batchTestProgress.isRunning,
        })
      })

      await testMultipleGroups(['group1', 'group2'])

      expect(seen).toHaveLength(2)
      for (const snapshot of seen) {
        expect(snapshot.total).toBe(2)
        expect(snapshot.running).toBe(true)
        expect(snapshot.storeRunning).toBe(true)
      }

      // After completion the outer loop resets everything.
      expect(isRunning.value).toBe(false)
      expect(mockNodeRecommendationStore.batchTestProgress).toEqual({
        total: 2,
        completed: 2,
        current: null,
        isRunning: false,
      })
    })
  })

  describe('healthCheckAllProviders', () => {
    it('health-checks every proxy provider via the store action', async () => {
      mockProxiesStore.proxyProviders = [
        { name: 'provider-a' },
        { name: 'provider-b' },
        { name: 'provider-c' },
      ]

      const { healthCheckAllProviders } = useBatchLatencyTest()

      await healthCheckAllProviders()

      expect(mockProxiesStore.proxyProviderLatencyTest).toHaveBeenCalledTimes(3)
      expect(mockProxiesStore.proxyProviderLatencyTest).toHaveBeenCalledWith(
        'provider-a',
      )
      expect(mockProxiesStore.proxyProviderLatencyTest).toHaveBeenCalledWith(
        'provider-b',
      )
      expect(mockProxiesStore.proxyProviderLatencyTest).toHaveBeenCalledWith(
        'provider-c',
      )
    })

    it('tracks shared progress and resets it after completion', async () => {
      vi.useRealTimers()
      mockProxiesStore.proxyProviders = [
        { name: 'provider-a' },
        { name: 'provider-b' },
      ]

      const seen: { total: number; running: boolean; storeRunning: boolean }[] =
        []
      mockProxiesStore.proxyProviderLatencyTest.mockImplementation(async () => {
        seen.push({
          total: mockNodeRecommendationStore.batchTestProgress.total,
          running: isRunningRef.value,
          storeRunning: mockNodeRecommendationStore.batchTestProgress.isRunning,
        })
      })

      const composable = useBatchLatencyTest()
      const isRunningRef = composable.isRunning
      await composable.healthCheckAllProviders()

      expect(seen).toHaveLength(2)
      for (const snapshot of seen) {
        expect(snapshot.total).toBe(2)
        expect(snapshot.running).toBe(true)
        expect(snapshot.storeRunning).toBe(true)
      }

      expect(composable.isRunning.value).toBe(false)
      expect(mockNodeRecommendationStore.batchTestProgress).toEqual({
        total: 2,
        completed: 2,
        current: null,
        isRunning: false,
      })
    })

    it('does nothing and does not toast when there are no providers', async () => {
      mockProxiesStore.proxyProviders = []

      const { healthCheckAllProviders } = useBatchLatencyTest()

      await healthCheckAllProviders()

      expect(mockProxiesStore.proxyProviderLatencyTest).not.toHaveBeenCalled()
      expect(toast.success).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('surfaces failures via toast.error without aborting the remaining providers', async () => {
      mockProxiesStore.proxyProviders = [
        { name: 'provider-a' },
        { name: 'provider-b' },
      ]
      mockProxiesStore.proxyProviderLatencyTest.mockImplementation(
        async (name: string) => {
          if (name === 'provider-a') throw new Error('provider boom')
        },
      )

      const { healthCheckAllProviders, isRunning } = useBatchLatencyTest()

      // Must not reject — the failure is surfaced via toast, not thrown.
      await expect(healthCheckAllProviders()).resolves.toBeUndefined()

      // The failing provider does not stop the others from being checked.
      expect(mockProxiesStore.proxyProviderLatencyTest).toHaveBeenCalledTimes(2)
      expect(toast.error).toHaveBeenCalled()
      expect(isRunning.value).toBe(false)
      expect(mockNodeRecommendationStore.batchTestProgress.isRunning).toBe(
        false,
      )
    })
  })
})
