<script setup lang="ts">
import type Highcharts from 'highcharts'
import type { ChartRef } from '~/components/RealtimeLineChart.vue'
import byteSize from 'byte-size'
import { getChartThemeColors } from '~/utils'

useHead({ title: 'Overview' })

const { t } = useI18n()
const globalStore = useGlobalStore()
const connectionsStore = useConnectionsStore()
const endpointStore = useEndpointStore()

const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Chart refs
const trafficChartRef = ref<{ chartRef: ChartRef }>()
const memoryChartRef = ref<{ chartRef: ChartRef }>()

// Traffic chart config
const trafficSeriesConfig = computed(() => [
  { name: t('down'), color: '#7cb5ec' },
  { name: t('up'), color: '#90ed7d' },
])

const trafficInitialData = computed(() => [
  [...globalStore.trafficChartHistory.download],
  [...globalStore.trafficChartHistory.upload],
])

// Memory chart config
const memorySeriesConfig = computed(() => [
  { name: t('memory'), color: '#f7a35c' },
])

const memoryInitialData = computed(() => [[...globalStore.memoryChartHistory]])

// Flow chart (pie chart) options
const flowChartOptions = computed<Highcharts.Options>(() => {
  const themeColors = getChartThemeColors()

  return {
    chart: {
      type: 'pie',
      backgroundColor: themeColors.backgroundColor,
      animation: false,
    },
    credits: {
      enabled: false,
    },
    title: {
      text: t('flow'),
      style: {
        color: themeColors.textColor,
      },
    },
    tooltip: {
      pointFormatter() {
        const value = this.y || 0
        const percent =
          (this as Highcharts.Point & { percentage?: number }).percentage || 0

        return `${this.name}<br/>${byteSize(value).toString()} (${percent.toFixed(1)}%)`
      },
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: false,
        },
        showInLegend: true,
        animation: false,
      },
    },
    legend: {
      itemStyle: {
        color: themeColors.textColor,
      },
      itemHoverStyle: {
        color: themeColors.textColorHover,
      },
    },
    series: [
      {
        type: 'pie',
        name: t('flow'),
        data: [
          {
            name: t('downloadTotal'),
            y: connectionsStore.latestConnectionMsg?.downloadTotal || 0,
            color: themeColors.seriesColors[0],
          },
          {
            name: t('uploadTotal'),
            y: connectionsStore.latestConnectionMsg?.uploadTotal || 0,
            color: themeColors.seriesColors[1],
          },
        ],
      },
    ],
  }
})

// Track previous times to prevent duplicate points on remount
let prevTrafficTime =
  globalStore.trafficChartHistory.download.length > 0
    ? globalStore.trafficChartHistory.download[
        globalStore.trafficChartHistory.download.length - 1
      ][0]
    : 0

let prevMemoryTime =
  globalStore.memoryChartHistory.length > 0
    ? globalStore.memoryChartHistory[
        globalStore.memoryChartHistory.length - 1
      ][0]
    : 0

// Watch for traffic updates and add to chart
watch(
  () => globalStore.latestTraffic,
  (newTraffic) => {
    if (newTraffic && trafficChartRef.value?.chartRef) {
      const time = Date.now()

      // Only add points if time has advanced (prevents duplicate points on remount)
      if (time > prevTrafficTime) {
        trafficChartRef.value.chartRef.addPoints([
          { seriesIndex: 0, time, value: newTraffic.down },
          { seriesIndex: 1, time, value: newTraffic.up },
        ])
        // Store in global history
        globalStore.addTrafficDataPoint(time, newTraffic.down, newTraffic.up)
        prevTrafficTime = time
      }
    }
  },
)

// Watch for memory updates and add to chart
watch(
  () => globalStore.latestMemory?.inuse,
  (newMemory) => {
    if (newMemory && memoryChartRef.value?.chartRef) {
      const time = Date.now()

      // Only add points if time has advanced (prevents duplicate points on remount)
      if (time > prevMemoryTime) {
        memoryChartRef.value.chartRef.addPoint(0, time, newMemory)
        // Store in global history
        globalStore.addMemoryDataPoint(time, newMemory)
        prevMemoryTime = time
      }
    }
  },
)
</script>

<template>
  <div class="flex flex-col gap-2 lg:h-full">
    <!-- Stats -->
    <div
      class="stats grid w-full shrink-0 stats-vertical grid-cols-2 bg-primary shadow lg:flex lg:stats-horizontal"
    >
      <TrafficWidget :label="t('upload')">
        {{ formatBytes(globalStore.latestTraffic?.up || 0) }}/s
      </TrafficWidget>

      <TrafficWidget :label="t('download')">
        {{ formatBytes(globalStore.latestTraffic?.down || 0) }}/s
      </TrafficWidget>

      <TrafficWidget :label="t('uploadTotal')">
        {{
          formatBytes(connectionsStore.latestConnectionMsg?.uploadTotal || 0)
        }}
      </TrafficWidget>

      <TrafficWidget :label="t('downloadTotal')">
        {{
          formatBytes(connectionsStore.latestConnectionMsg?.downloadTotal || 0)
        }}
      </TrafficWidget>

      <TrafficWidget :label="t('activeConnections')">
        {{ connectionsStore.latestConnectionMsg?.connections?.length || 0 }}
      </TrafficWidget>

      <TrafficWidget :label="t('memoryUsage')">
        {{ formatBytes(globalStore.latestMemory?.inuse || 0) }}
      </TrafficWidget>
    </div>

    <!-- Charts -->
    <div
      class="grid grid-cols-1 gap-2 rounded-box bg-base-300 py-4 lg:grid-cols-3"
    >
      <div class="h-80">
        <RealtimeLineChart
          ref="trafficChartRef"
          :title="t('traffic')"
          :series-config="trafficSeriesConfig"
          :initial-data="trafficInitialData"
          :is-loading="!globalStore.latestTraffic"
        />
      </div>

      <div class="h-80">
        <HighchartsAutoSize
          :options="flowChartOptions"
          :is-loading="
            !connectionsStore.latestConnectionMsg?.connections?.length
          "
        />
      </div>

      <div class="h-80">
        <RealtimeLineChart
          ref="memoryChartRef"
          :title="t('memory')"
          :series-config="memorySeriesConfig"
          :initial-data="memoryInitialData"
          :is-loading="!globalStore.latestMemory"
        />
      </div>
    </div>

    <!-- Data Usage Table -->
    <DataUsageTable />

    <!-- Footer -->
    <footer
      class="mx-auto mt-4 footer block footer-horizontal rounded-box bg-neutral p-4 text-center text-lg font-bold text-neutral-content"
    >
      {{ endpointStore.currentEndpoint?.url }}
    </footer>
  </div>
</template>
