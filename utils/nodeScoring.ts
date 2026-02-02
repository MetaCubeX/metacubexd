import type {
  NodePerformanceData,
  ScoringWeights,
} from '~/stores/nodeRecommendation'

// Default scoring weights
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  latency: 50,
  stability: 30,
  successRate: 20,
}

// Score thresholds for color coding
export const SCORE_THRESHOLDS = {
  good: 80, // Green: >= 80
  medium: 50, // Yellow: >= 50
  // Red: < 50
}

/**
 * Calculate latency score (0-100)
 * Lower latency = higher score
 * Uses logarithmic scale: 50ms = 100, 500ms = 50, 5000ms = 0
 */
export function calculateLatencyScore(latencies: (number | null)[]): number {
  const validLatencies = latencies.filter(
    (l): l is number => l !== null && l > 0,
  )
  if (validLatencies.length === 0) return 0

  const avgLatency =
    validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length

  // Logarithmic normalization: 50ms = 100, 500ms = 50, 5000ms = 0
  if (avgLatency <= 50) return 100
  if (avgLatency >= 5000) return 0

  // Log scale between 50ms and 5000ms
  const minLog = Math.log(50)
  const maxLog = Math.log(5000)
  const currentLog = Math.log(avgLatency)

  return Math.round(100 * (1 - (currentLog - minLog) / (maxLog - minLog)))
}

/**
 * Calculate stability score (0-100)
 * Lower standard deviation = higher score
 */
export function calculateStabilityScore(latencies: (number | null)[]): number {
  const validLatencies = latencies.filter(
    (l): l is number => l !== null && l > 0,
  )
  if (validLatencies.length < 2) return 50 // Not enough data, neutral score

  const mean = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length
  const squaredDiffs = validLatencies.map((l) => (l - mean)**2)
  const variance =
    squaredDiffs.reduce((a, b) => a + b, 0) / validLatencies.length
  const stdDev = Math.sqrt(variance)

  // Coefficient of variation (CV) = stdDev / mean
  // CV < 0.1 = very stable (100), CV > 0.5 = unstable (0)
  const cv = stdDev / mean

  if (cv <= 0.1) return 100
  if (cv >= 0.5) return 0

  return Math.round(100 * (1 - (cv - 0.1) / 0.4))
}

/**
 * Calculate success rate score (0-100)
 * Higher success rate = higher score
 */
export function calculateSuccessRateScore(
  history: { success: boolean }[],
): number {
  if (history.length === 0) return 0

  const successCount = history.filter((h) => h.success).length
  return Math.round((successCount / history.length) * 100)
}

/**
 * Calculate comprehensive node score (0-100)
 */
export function calculateNodeScore(
  data: NodePerformanceData,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): number {
  if (data.history.length === 0) return 0

  const latencies = data.history.map((h) => h.latency)

  const latencyScore = calculateLatencyScore(latencies)
  const stabilityScore = calculateStabilityScore(latencies)
  const successRateScore = calculateSuccessRateScore(data.history)

  // Normalize weights to ensure they sum to 100
  const totalWeight = weights.latency + weights.stability + weights.successRate
  const normalizedLatency = weights.latency / totalWeight
  const normalizedStability = weights.stability / totalWeight
  const normalizedSuccessRate = weights.successRate / totalWeight

  const score =
    latencyScore * normalizedLatency +
    stabilityScore * normalizedStability +
    successRateScore * normalizedSuccessRate

  return Math.round(score)
}

/**
 * Get score color class based on score value
 */
export function getScoreColorClass(score: number): string {
  if (score >= SCORE_THRESHOLDS.good) return 'text-success'
  if (score >= SCORE_THRESHOLDS.medium) return 'text-warning'
  return 'text-error'
}

/**
 * Get score background color class
 */
export function getScoreBgClass(score: number): string {
  if (score >= SCORE_THRESHOLDS.good) return 'bg-success/20'
  if (score >= SCORE_THRESHOLDS.medium) return 'bg-warning/20'
  return 'bg-error/20'
}

/**
 * Format time since last test
 */
export function formatTimeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Find recommended node from a list of nodes
 * Returns the node with highest score that is not excluded
 */
export function findRecommendedNode(
  nodeNames: string[],
  performanceData: Map<string, NodePerformanceData>,
  excludedNodes: string[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): string | null {
  let bestNode: string | null = null
  let bestScore = -1

  for (const nodeName of nodeNames) {
    if (excludedNodes.includes(nodeName)) continue

    const data = performanceData.get(nodeName)
    if (!data || data.history.length === 0) continue

    const score = calculateNodeScore(data, weights)
    if (score > bestScore) {
      bestScore = score
      bestNode = nodeName
    }
  }

  return bestNode
}
