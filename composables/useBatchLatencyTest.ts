import { useRequest } from './useApi'

// Batch test configuration
const BATCH_SIZE = 10 // Max concurrent tests
const BATCH_DELAY = 200 // Delay between batches in ms

export interface BatchTestOptions {
  url: string
  timeout: number
  onProgress?: (completed: number, total: number, current: string) => void
  onNodeComplete?: (nodeName: string, delay: number) => void
}

export function useBatchLatencyTest() {
  const configStore = useConfigStore()
  const nodeRecommendationStore = useNodeRecommendationStore()

  const isRunning = ref(false)
  const progress = ref({ completed: 0, total: 0, current: '' })
  const abortController = ref<AbortController | null>(null)

  // Test a single proxy node
  const testSingleNode = async (
    proxyName: string,
    url: string,
    timeout: number,
  ): Promise<{ proxyName: string; delay: number }> => {
    try {
      const request = useRequest()
      const result = await request
        .get(`proxies/${encodeURIComponent(proxyName)}/delay`, {
          searchParams: { url, timeout },
        })
        .json<{ delay: number }>()
      return { proxyName, delay: result.delay }
    } catch {
      return { proxyName, delay: 0 } // 0 indicates failure
    }
  }

  // Test a proxy group (uses backend batch API)
  const testProxyGroup = async (
    groupName: string,
    url: string,
    timeout: number,
  ): Promise<Record<string, number>> => {
    try {
      const request = useRequest()
      const result = await request
        .get(`group/${encodeURIComponent(groupName)}/delay`, {
          searchParams: { url, timeout },
        })
        .json<Record<string, number>>()
      return result
    } catch {
      return {}
    }
  }

  // Batch test multiple nodes with concurrency control
  const batchTestNodes = async (
    nodeNames: string[],
    options: BatchTestOptions,
  ): Promise<Record<string, number>> => {
    const { url, timeout, onProgress, onNodeComplete } = options
    const results: Record<string, number> = {}

    isRunning.value = true
    progress.value = { completed: 0, total: nodeNames.length, current: '' }
    abortController.value = new AbortController()

    // Update store progress
    nodeRecommendationStore.batchTestProgress = {
      total: nodeNames.length,
      completed: 0,
      current: null,
      isRunning: true,
    }

    try {
      // Process in batches
      for (let i = 0; i < nodeNames.length; i += BATCH_SIZE) {
        // Check if aborted
        if (abortController.value?.signal.aborted) {
          break
        }

        const batch = nodeNames.slice(i, i + BATCH_SIZE)

        // Test batch concurrently
        const batchPromises = batch.map(async (nodeName) => {
          progress.value.current = nodeName
          nodeRecommendationStore.batchTestProgress.current = nodeName

          const result = await testSingleNode(nodeName, url, timeout)
          results[nodeName] = result.delay

          progress.value.completed++
          nodeRecommendationStore.batchTestProgress.completed++

          onProgress?.(progress.value.completed, nodeNames.length, nodeName)
          onNodeComplete?.(nodeName, result.delay)

          // Record result in store
          nodeRecommendationStore.recordTestResult(
            nodeName,
            result.delay > 0 ? result.delay : null,
            result.delay > 0,
          )

          return result
        })

        await Promise.all(batchPromises)

        // Delay between batches (except for last batch)
        if (
          i + BATCH_SIZE < nodeNames.length &&
          !abortController.value?.signal.aborted
        ) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
        }
      }
    } finally {
      isRunning.value = false
      progress.value.current = ''
      nodeRecommendationStore.batchTestProgress = {
        total: nodeNames.length,
        completed: progress.value.completed,
        current: null,
        isRunning: false,
      }
      abortController.value = null
    }

    return results
  }

  // Test all nodes in a proxy group using batch API
  const testGroupNodes = async (
    groupName: string,
    options?: Partial<BatchTestOptions>,
  ): Promise<Record<string, number>> => {
    const url = options?.url ?? configStore.urlForLatencyTest
    const timeout = options?.timeout ?? configStore.latencyTestTimeoutDuration

    isRunning.value = true
    nodeRecommendationStore.batchTestProgress = {
      total: 1,
      completed: 0,
      current: groupName,
      isRunning: true,
    }

    try {
      const results = await testProxyGroup(groupName, url, timeout)

      // Record all results
      nodeRecommendationStore.recordBatchResults(results)

      return results
    } finally {
      isRunning.value = false
      nodeRecommendationStore.batchTestProgress = {
        total: 1,
        completed: 1,
        current: null,
        isRunning: false,
      }
    }
  }

  // Test multiple groups sequentially
  const testMultipleGroups = async (
    groupNames: string[],
    options?: Partial<BatchTestOptions>,
  ): Promise<Record<string, Record<string, number>>> => {
    const allResults: Record<string, Record<string, number>> = {}

    isRunning.value = true
    nodeRecommendationStore.batchTestProgress = {
      total: groupNames.length,
      completed: 0,
      current: null,
      isRunning: true,
    }

    try {
      for (let i = 0; i < groupNames.length; i++) {
        const groupName = groupNames[i]
        if (!groupName) continue

        nodeRecommendationStore.batchTestProgress.current = groupName
        nodeRecommendationStore.batchTestProgress.completed = i

        const results = await testGroupNodes(groupName, options)
        allResults[groupName] = results

        // Delay between groups
        if (i < groupNames.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
        }
      }
    } finally {
      isRunning.value = false
      nodeRecommendationStore.batchTestProgress = {
        total: groupNames.length,
        completed: groupNames.length,
        current: null,
        isRunning: false,
      }
    }

    return allResults
  }

  // Abort ongoing test
  const abortTest = () => {
    abortController.value?.abort()
  }

  return {
    isRunning,
    progress,
    batchTestNodes,
    testGroupNodes,
    testMultipleGroups,
    abortTest,
  }
}
