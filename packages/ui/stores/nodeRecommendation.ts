import { defineStore } from 'pinia'

// Node performance history entry
export interface NodePerformanceEntry {
  timestamp: number
  latency: number | null // null means test failed
  success: boolean
}

// Node performance data
export interface NodePerformanceData {
  nodeName: string
  history: NodePerformanceEntry[]
  lastTestTime: number
  score: number | null // Computed score (0-100)
}

// Scoring weights configuration
export interface ScoringWeights {
  latency: number // Default: 50
  stability: number // Default: 30
  successRate: number // Default: 20
}

// Batch test progress
export interface BatchTestProgress {
  total: number
  completed: number
  current: string | null
  isRunning: boolean
}

const MAX_HISTORY_ENTRIES = 20
const STORAGE_KEY = 'nodePerformanceHistory'

export const useNodeRecommendationStore = defineStore(
  'nodeRecommendation',
  () => {
    // Performance data for all nodes
    const performanceData = ref<Map<string, NodePerformanceData>>(new Map())

    // Scoring weights (user configurable)
    const scoringWeights = useLocalStorage<ScoringWeights>('scoringWeights', {
      latency: 50,
      stability: 30,
      successRate: 20,
    })

    // Excluded nodes (won't be recommended)
    const excludedNodes = useLocalStorage<string[]>('excludedNodes', [])

    // Auto-switch to recommended node
    const autoSwitchEnabled = useLocalStorage('autoSwitchToRecommended', false)

    // Minimum test interval in minutes
    const minTestInterval = useLocalStorage('minTestInterval', 1)

    // Batch test progress
    const batchTestProgress = ref<BatchTestProgress>({
      total: 0,
      completed: 0,
      current: null,
      isRunning: false,
    })

    // Load performance data from localStorage
    const loadFromStorage = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as Record<
            string,
            NodePerformanceData
          >
          performanceData.value = new Map(Object.entries(parsed))
        }
      } catch (e) {
        console.warn('Failed to load node performance data:', e)
      }
    }

    // Save performance data to localStorage
    const saveToStorage = () => {
      try {
        const data = Object.fromEntries(performanceData.value)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch (e) {
        console.warn('Failed to save node performance data:', e)
      }
    }

    // Record a test result for a node
    const recordTestResult = (
      nodeName: string,
      latency: number | null,
      success: boolean,
    ) => {
      const now = Date.now()
      const existing = performanceData.value.get(nodeName)

      const entry: NodePerformanceEntry = {
        timestamp: now,
        latency,
        success,
      }

      if (existing) {
        // Add new entry and trim to max size
        existing.history = [entry, ...existing.history].slice(
          0,
          MAX_HISTORY_ENTRIES,
        )
        existing.lastTestTime = now
        existing.score = null // Will be recalculated
      } else {
        performanceData.value.set(nodeName, {
          nodeName,
          history: [entry],
          lastTestTime: now,
          score: null,
        })
      }

      saveToStorage()
    }

    // Record batch test results
    const recordBatchResults = (results: Record<string, number>) => {
      const now = Date.now()

      for (const [nodeName, latency] of Object.entries(results)) {
        const success = latency > 0
        const entry: NodePerformanceEntry = {
          timestamp: now,
          latency: success ? latency : null,
          success,
        }

        const existing = performanceData.value.get(nodeName)
        if (existing) {
          existing.history = [entry, ...existing.history].slice(
            0,
            MAX_HISTORY_ENTRIES,
          )
          existing.lastTestTime = now
          existing.score = null
        } else {
          performanceData.value.set(nodeName, {
            nodeName,
            history: [entry],
            lastTestTime: now,
            score: null,
          })
        }
      }

      saveToStorage()
    }

    // Get performance data for a node
    const getNodePerformance = (
      nodeName: string,
    ): NodePerformanceData | undefined => {
      return performanceData.value.get(nodeName)
    }

    // Check if a node is excluded
    const isExcluded = (nodeName: string): boolean => {
      return excludedNodes.value.includes(nodeName)
    }

    // Toggle node exclusion
    const toggleExclusion = (nodeName: string) => {
      const index = excludedNodes.value.indexOf(nodeName)
      if (index >= 0) {
        excludedNodes.value.splice(index, 1)
      } else {
        excludedNodes.value.push(nodeName)
      }
    }

    // Clear all performance data
    const clearAllData = () => {
      performanceData.value.clear()
      localStorage.removeItem(STORAGE_KEY)
    }

    // Update scoring weights
    const updateWeights = (weights: Partial<ScoringWeights>) => {
      scoringWeights.value = { ...scoringWeights.value, ...weights }
    }

    // Initialize on store creation
    loadFromStorage()

    return {
      // State
      performanceData,
      scoringWeights,
      excludedNodes,
      autoSwitchEnabled,
      minTestInterval,
      batchTestProgress,
      // Actions
      recordTestResult,
      recordBatchResults,
      getNodePerformance,
      isExcluded,
      toggleExclusion,
      clearAllData,
      updateWeights,
      loadFromStorage,
      saveToStorage,
    }
  },
)
