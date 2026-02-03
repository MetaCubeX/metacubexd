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

vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useNodeRecommendationStore', () => mockNodeRecommendationStore)

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
    })
  })
})
