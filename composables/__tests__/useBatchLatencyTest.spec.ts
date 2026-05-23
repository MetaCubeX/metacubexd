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

// Mock stores
const mockConfigStore = {
  urlForLatencyTest: 'https://www.gstatic.com/generate_204',
  latencyTestTimeoutDuration: 5000,
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
  proxies: { name: string; all: string[] }[]
} = {
  clearLatencyTestStateForGroup: vi.fn(),
  clearLatencyTestStateForNodes: vi.fn(),
  fetchProxies: vi.fn(),
  recordLatencyTestResult: vi.fn(),
  recordLatencyTestResults: vi.fn(),
  proxies: [],
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
})
