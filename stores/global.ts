import type { ChartDataPoint, MemoryData, TrafficData } from '~/types'
import { defineStore } from 'pinia'
import { CHART_MAX_XAXIS } from '~/constants'

export const useGlobalStore = defineStore('global', () => {
  // Root element ref (for portal mounting, etc.)
  const rootElement = ref<HTMLElement | null>(null)

  // Traffic data
  const latestTraffic = ref<TrafficData | null>(null)

  // Memory data
  const latestMemory = ref<MemoryData | null>(null)

  // Chart history data for persistence across page navigation
  const trafficChartHistory = reactive<{
    download: ChartDataPoint[]
    upload: ChartDataPoint[]
  }>({
    download: [],
    upload: [],
  })

  const memoryChartHistory = reactive<ChartDataPoint[]>([])

  // Helper functions
  const setLatestTraffic = (data: TrafficData | null) => {
    latestTraffic.value = data
  }

  const setLatestMemory = (data: MemoryData | null) => {
    latestMemory.value = data
  }

  const addTrafficDataPoint = (
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

  const addMemoryDataPoint = (time: number, value: number) => {
    memoryChartHistory.push([time, value])

    // Keep only the last CHART_MAX_XAXIS points
    if (memoryChartHistory.length > CHART_MAX_XAXIS) {
      memoryChartHistory.shift()
    }
  }

  const clearChartHistory = () => {
    trafficChartHistory.download.length = 0
    trafficChartHistory.upload.length = 0
    memoryChartHistory.length = 0
  }

  return {
    rootElement,
    latestTraffic,
    latestMemory,
    trafficChartHistory,
    memoryChartHistory,
    setLatestTraffic,
    setLatestMemory,
    addTrafficDataPoint,
    addMemoryDataPoint,
    clearChartHistory,
  }
})
