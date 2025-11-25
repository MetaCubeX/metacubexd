import { CHART_MAX_XAXIS } from '~/constants'

export const [rootElement, setRootElement] = createSignal(
  document.createElement('div'),
)

// Global traffic data signal
export type TrafficData = {
  up: number
  down: number
}

export const [latestTraffic, setLatestTraffic] =
  createSignal<TrafficData | null>(null)

// Global memory data signal
export type MemoryData = {
  inuse: number
}

export const [latestMemory, setLatestMemory] = createSignal<MemoryData | null>(
  null,
)

// Chart history data for persistence across page navigation
// Using simple arrays to store [timestamp, value] pairs
export type ChartDataPoint = [number, number]

// Traffic chart history - stores download and upload series
export const trafficChartHistory: {
  download: ChartDataPoint[]
  upload: ChartDataPoint[]
} = {
  download: [],
  upload: [],
}

// Memory chart history
export const memoryChartHistory: ChartDataPoint[] = []

// Helper function to add traffic data point with limit
export const addTrafficDataPoint = (
  time: number,
  download: number,
  upload: number,
) => {
  trafficChartHistory.download.push([time, download])
  trafficChartHistory.upload.push([time, upload])

  // Keep only the last CHART_MAX_XAXIS points
  if (trafficChartHistory.download.length > CHART_MAX_XAXIS) {
    trafficChartHistory.download.shift()
  }

  if (trafficChartHistory.upload.length > CHART_MAX_XAXIS) {
    trafficChartHistory.upload.shift()
  }
}

// Helper function to add memory data point with limit
export const addMemoryDataPoint = (time: number, value: number) => {
  memoryChartHistory.push([time, value])

  // Keep only the last CHART_MAX_XAXIS points
  if (memoryChartHistory.length > CHART_MAX_XAXIS) {
    memoryChartHistory.shift()
  }
}

// Clear chart history (called on service restart)
export const clearChartHistory = () => {
  trafficChartHistory.download.length = 0
  trafficChartHistory.upload.length = 0
  memoryChartHistory.length = 0
}
