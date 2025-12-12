<script setup lang="ts">
import type Highcharts from 'highcharts'
import type { ChartRef } from '~/components/RealtimeLineChart.vue'
import byteSize from 'byte-size'
import { getChartThemeColors } from '~/utils'

const { t } = useI18n()

useHead({ title: computed(() => t('overview')) })
const globalStore = useGlobalStore()
const connectionsStore = useConnectionsStore()
const endpointStore = useEndpointStore()
const configStore = useConfigStore()

const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Reactive theme colors - recomputes when theme changes
const themeColors = computed(() => {
  // Access curTheme to create reactive dependency
  void configStore.curTheme
  return getChartThemeColors()
})

// Chart refs
const trafficChartRef = ref<{ chartRef: ChartRef }>()
const memoryChartRef = ref<{ chartRef: ChartRef }>()
const connectionsChartRef = ref<{ chartRef: ChartRef }>()

// Traffic chart config
const trafficSeriesConfig = computed(() => [
  { name: t('down'), color: themeColors.value.seriesColors[0] },
  { name: t('up'), color: themeColors.value.seriesColors[1] },
])

const trafficInitialData = computed(() => [
  [...globalStore.trafficChartHistory.download],
  [...globalStore.trafficChartHistory.upload],
])

// Memory chart config
const memorySeriesConfig = computed(() => [
  { name: t('memory'), color: themeColors.value.seriesColors[2] },
])

const memoryInitialData = computed(() => [[...globalStore.memoryChartHistory]])

// Connections count chart config
const connectionsSeriesConfig = computed(() => [
  { name: t('activeConnections'), color: themeColors.value.seriesColors[3] },
])

const connectionsInitialData = computed(() => [
  [...globalStore.connectionCountHistory],
])

// Flow chart (pie chart) options
const flowChartOptions = computed<Highcharts.Options>(() => ({
  chart: {
    type: 'pie',
    backgroundColor: themeColors.value.backgroundColor,
    animation: false,
  },
  credits: {
    enabled: false,
  },
  accessibility: {
    enabled: false,
  },
  title: {
    text: t('flow'),
    style: {
      color: themeColors.value.textColor,
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
      color: themeColors.value.textColor,
    },
    itemHoverStyle: {
      color: themeColors.value.textColorHover,
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
          color: themeColors.value.seriesColors[0],
        },
        {
          name: t('uploadTotal'),
          y: connectionsStore.latestConnectionMsg?.uploadTotal || 0,
          color: themeColors.value.seriesColors[1],
        },
      ],
    },
  ],
}))

// Network types pie chart options
const networkTypesChartOptions = computed<Highcharts.Options>(() => {
  const connections = connectionsStore.activeConnections

  // Count TCP vs UDP
  let tcpCount = 0
  let udpCount = 0
  let otherCount = 0

  connections.forEach((conn) => {
    const network = conn.metadata.network?.toLowerCase() || ''
    if (network === 'tcp') {
      tcpCount++
    } else if (network === 'udp') {
      udpCount++
    } else {
      otherCount++
    }
  })

  return {
    chart: {
      type: 'pie',
      backgroundColor: themeColors.value.backgroundColor,
      animation: false,
    },
    credits: {
      enabled: false,
    },
    accessibility: {
      enabled: false,
    },
    title: {
      text: t('networkTypes'),
      style: {
        color: themeColors.value.textColor,
      },
    },
    tooltip: {
      pointFormatter() {
        const value = this.y || 0
        const percent =
          (this as Highcharts.Point & { percentage?: number }).percentage || 0

        return `${this.name}: <b>${value}</b> (${percent.toFixed(1)}%)`
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
        color: themeColors.value.textColor,
      },
      itemHoverStyle: {
        color: themeColors.value.textColorHover,
      },
    },
    series: [
      {
        type: 'pie',
        name: t('networkTypes'),
        data: [
          {
            name: t('tcp'),
            y: tcpCount,
            color: themeColors.value.seriesColors[0],
          },
          {
            name: t('udp'),
            y: udpCount,
            color: themeColors.value.seriesColors[1],
          },
          ...(otherCount > 0
            ? [
                {
                  name: t('other'),
                  y: otherCount,
                  color: themeColors.value.seriesColors[2],
                },
              ]
            : []),
        ],
      },
    ],
  }
})

// Top proxies bar chart options
const topProxiesChartOptions = computed<Highcharts.Options>(() => {
  const speedByName = connectionsStore.speedGroupByName

  // Get top 5 proxies by speed
  const sortedProxies = Object.entries(speedByName)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const categories = sortedProxies.map(([name]) => name)
  const data = sortedProxies.map(([, speed]) => speed)

  return {
    chart: {
      type: 'bar',
      backgroundColor: themeColors.value.backgroundColor,
      animation: false,
    },
    credits: {
      enabled: false,
    },
    accessibility: {
      enabled: false,
    },
    title: {
      text: t('topProxies'),
      style: {
        color: themeColors.value.textColor,
      },
    },
    xAxis: {
      categories,
      labels: {
        style: {
          color: themeColors.value.textColor,
        },
      },
      lineColor: themeColors.value.lineColor,
    },
    yAxis: {
      title: {
        text: undefined,
      },
      labels: {
        style: {
          color: themeColors.value.textColor,
        },
        formatter() {
          return `${byteSize(this.value as number).toString()}/s`
        },
      },
      gridLineColor: themeColors.value.gridLineColor,
      min: 0,
    },
    tooltip: {
      formatter() {
        const categoryName = categories[this.x as number] || this.x
        return `<b>${categoryName}</b><br/>${byteSize(this.y as number).toString()}/s`
      },
    },
    legend: {
      enabled: false,
    },
    plotOptions: {
      bar: {
        dataLabels: {
          enabled: false,
        },
        animation: false,
      },
    },
    series: [
      {
        type: 'bar',
        name: t('traffic'),
        data,
        color: themeColors.value.seriesColors[0],
      },
    ],
  }
})

// Track previous times to prevent duplicate points on remount
let prevTrafficTime = globalStore.trafficChartHistory.download.at(-1)?.[0] ?? 0

let prevMemoryTime = globalStore.memoryChartHistory.at(-1)?.[0] ?? 0

let prevConnectionsTime = globalStore.connectionCountHistory.at(-1)?.[0] ?? 0

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
        // Data points are now added by WebSocket handler in useWebSocket.ts
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
        // Data points are now added by WebSocket handler in useWebSocket.ts
        prevMemoryTime = time
      }
    }
  },
)

// Watch for connection count updates and add to chart
watch(
  () => connectionsStore.latestConnectionMsg?.connections?.length,
  (newCount) => {
    if (newCount !== undefined && connectionsChartRef.value?.chartRef) {
      const time = Date.now()

      // Only add points if time has advanced (prevents duplicate points on remount)
      if (time > prevConnectionsTime) {
        connectionsChartRef.value.chartRef.addPoint(0, time, newCount)
        // Data points are now added by WebSocket handler in useWebSocket.ts
        prevConnectionsTime = time
      }
    }
  },
)
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-y-auto">
    <!-- Stats -->
    <div
      class="stats grid w-full shrink-0 stats-vertical grid-cols-2 bg-primary shadow sm:grid-cols-3 xl:grid-cols-6"
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
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <RealtimeLineChart
          ref="trafficChartRef"
          :title="t('traffic')"
          :series-config="trafficSeriesConfig"
          :initial-data="trafficInitialData"
          :is-loading="!globalStore.latestTraffic"
        />
      </div>

      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <HighchartsAutoSize
          :options="flowChartOptions"
          :is-loading="
            !connectionsStore.latestConnectionMsg?.connections?.length
          "
        />
      </div>

      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <RealtimeLineChart
          ref="memoryChartRef"
          :title="t('memory')"
          :series-config="memorySeriesConfig"
          :initial-data="memoryInitialData"
          :is-loading="!globalStore.latestMemory"
        />
      </div>

      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <RealtimeLineChart
          ref="connectionsChartRef"
          :title="t('connectionsChart')"
          :series-config="connectionsSeriesConfig"
          :initial-data="connectionsInitialData"
          :is-loading="
            !connectionsStore.latestConnectionMsg?.connections?.length
          "
          value-mode="number"
        />
      </div>

      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <HighchartsAutoSize
          :options="networkTypesChartOptions"
          :is-loading="
            !connectionsStore.latestConnectionMsg?.connections?.length
          "
        />
      </div>

      <div class="card h-72 bg-base-200 p-2 shadow-sm lg:h-80">
        <HighchartsAutoSize
          :options="topProxiesChartOptions"
          :is-loading="
            Object.keys(connectionsStore.speedGroupByName).length === 0
          "
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
