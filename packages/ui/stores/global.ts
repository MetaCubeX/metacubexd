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

  // Chart history buffers, persisted across page navigation. Deliberately
  // NON-reactive: charts read a snapshot once on mount (via initialData) and
  // are then updated imperatively through addPoint/setData. Deep reactivity
  // here only cost CPU — proxying every [time, value] pair and re-running
  // consumer computeds — on each per-second push, for no rendering benefit.
  // markRaw keeps them raw even though Pinia exposes them through a reactive
  // store proxy (which would otherwise deep-proxy these arrays on access).
  const trafficChartHistory = markRaw<{
    download: ChartDataPoint[]
    upload: ChartDataPoint[]
  }>({
    download: [],
    upload: [],
  })

  const memoryChartHistory = markRaw<ChartDataPoint[]>([])

  // Connection count history for chart
  const connectionCountHistory = markRaw<ChartDataPoint[]>([])

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

  const addConnectionCountDataPoint = (time: number, count: number) => {
    connectionCountHistory.push([time, count])

    // Keep only the last CHART_MAX_XAXIS points
    if (connectionCountHistory.length > CHART_MAX_XAXIS) {
      connectionCountHistory.shift()
    }
  }

  const clearChartHistory = () => {
    trafficChartHistory.download.length = 0
    trafficChartHistory.upload.length = 0
    memoryChartHistory.length = 0
    connectionCountHistory.length = 0
  }

  return {
    rootElement,
    latestTraffic,
    latestMemory,
    trafficChartHistory,
    memoryChartHistory,
    connectionCountHistory,
    setLatestTraffic,
    setLatestMemory,
    addTrafficDataPoint,
    addMemoryDataPoint,
    addConnectionCountDataPoint,
    clearChartHistory,
  }
})
