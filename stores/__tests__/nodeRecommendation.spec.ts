import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNodeRecommendationStore } from '../nodeRecommendation'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('stores/nodeRecommendation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('recordTestResult', () => {
    it('records a successful test result for a new node', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)

      const data = store.getNodePerformance('node1')
      expect(data).toBeDefined()
      expect(data?.history).toHaveLength(1)
      expect(data?.history[0].latency).toBe(100)
      expect(data?.history[0].success).toBe(true)
    })

    it('records a failed test result with null latency', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', null, false)

      const data = store.getNodePerformance('node1')
      expect(data?.history[0].latency).toBeNull()
      expect(data?.history[0].success).toBe(false)
    })

    it('adds new entries to existing node history', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)
      store.recordTestResult('node1', 150, true)

      const data = store.getNodePerformance('node1')
      expect(data?.history).toHaveLength(2)
      // Most recent entry should be first
      expect(data?.history[0].latency).toBe(150)
      expect(data?.history[1].latency).toBe(100)
    })

    it('limits history to max 20 entries', () => {
      const store = useNodeRecommendationStore()

      // Record 25 entries
      for (let i = 0; i < 25; i++) {
        store.recordTestResult('node1', 100 + i, true)
      }

      const data = store.getNodePerformance('node1')
      expect(data?.history).toHaveLength(20)
      // Most recent should be first (latency 124)
      expect(data?.history[0].latency).toBe(124)
    })

    it('updates lastTestTime on each record', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)
      const firstTime = store.getNodePerformance('node1')?.lastTestTime

      // Wait a bit and record again
      store.recordTestResult('node1', 150, true)
      const secondTime = store.getNodePerformance('node1')?.lastTestTime

      expect(secondTime).toBeGreaterThanOrEqual(firstTime!)
    })

    it('resets score to null when new result is recorded', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)

      const data = store.getNodePerformance('node1')
      expect(data?.score).toBeNull()
    })
  })

  describe('recordBatchResults', () => {
    it('records multiple nodes at once', () => {
      const store = useNodeRecommendationStore()

      store.recordBatchResults({
        node1: 100,
        node2: 200,
        node3: 150,
      })

      expect(store.getNodePerformance('node1')?.history[0].latency).toBe(100)
      expect(store.getNodePerformance('node2')?.history[0].latency).toBe(200)
      expect(store.getNodePerformance('node3')?.history[0].latency).toBe(150)
    })

    it('treats latency <= 0 as failed test', () => {
      const store = useNodeRecommendationStore()

      store.recordBatchResults({
        node1: 0,
        node2: -1,
      })

      expect(store.getNodePerformance('node1')?.history[0].success).toBe(false)
      expect(store.getNodePerformance('node1')?.history[0].latency).toBeNull()
      expect(store.getNodePerformance('node2')?.history[0].success).toBe(false)
    })

    it('treats latency > 0 as successful test', () => {
      const store = useNodeRecommendationStore()

      store.recordBatchResults({
        node1: 100,
      })

      expect(store.getNodePerformance('node1')?.history[0].success).toBe(true)
      expect(store.getNodePerformance('node1')?.history[0].latency).toBe(100)
    })

    it('appends to existing history', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 50, true)
      store.recordBatchResults({ node1: 100 })

      const data = store.getNodePerformance('node1')
      expect(data?.history).toHaveLength(2)
      expect(data?.history[0].latency).toBe(100) // Most recent first
    })
  })

  describe('toggleExclusion', () => {
    it('adds node to excluded list when not excluded', () => {
      const store = useNodeRecommendationStore()

      expect(store.isExcluded('node1')).toBe(false)

      store.toggleExclusion('node1')

      expect(store.isExcluded('node1')).toBe(true)
    })

    it('removes node from excluded list when already excluded', () => {
      const store = useNodeRecommendationStore()

      store.toggleExclusion('node1') // Add
      expect(store.isExcluded('node1')).toBe(true)

      store.toggleExclusion('node1') // Remove
      expect(store.isExcluded('node1')).toBe(false)
    })

    it('handles multiple nodes independently', () => {
      const store = useNodeRecommendationStore()

      store.toggleExclusion('node1')
      store.toggleExclusion('node2')

      expect(store.isExcluded('node1')).toBe(true)
      expect(store.isExcluded('node2')).toBe(true)
      expect(store.isExcluded('node3')).toBe(false)

      store.toggleExclusion('node1')

      expect(store.isExcluded('node1')).toBe(false)
      expect(store.isExcluded('node2')).toBe(true)
    })
  })

  describe('localStorage persistence', () => {
    it('saves performance data to localStorage', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'nodePerformanceHistory',
        expect.any(String),
      )
    })

    it('clears data from localStorage when clearAllData is called', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)
      store.clearAllData()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'nodePerformanceHistory',
      )
      expect(store.getNodePerformance('node1')).toBeUndefined()
    })
  })

  describe('updateWeights', () => {
    it('updates scoring weights partially', () => {
      const store = useNodeRecommendationStore()

      store.updateWeights({ latency: 60 })

      expect(store.scoringWeights.latency).toBe(60)
      expect(store.scoringWeights.stability).toBe(30) // unchanged
      expect(store.scoringWeights.successRate).toBe(20) // unchanged
    })

    it('updates all weights at once', () => {
      const store = useNodeRecommendationStore()

      store.updateWeights({
        latency: 40,
        stability: 40,
        successRate: 20,
      })

      expect(store.scoringWeights.latency).toBe(40)
      expect(store.scoringWeights.stability).toBe(40)
      expect(store.scoringWeights.successRate).toBe(20)
    })
  })

  describe('getNodePerformance', () => {
    it('returns undefined for unknown node', () => {
      const store = useNodeRecommendationStore()

      expect(store.getNodePerformance('unknown')).toBeUndefined()
    })

    it('returns data for recorded node', () => {
      const store = useNodeRecommendationStore()

      store.recordTestResult('node1', 100, true)

      const data = store.getNodePerformance('node1')
      expect(data).toBeDefined()
      expect(data?.nodeName).toBe('node1')
    })
  })
})
