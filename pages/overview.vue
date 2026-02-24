<script setup lang="ts">
import type Highcharts from 'highcharts'
import type { ChartRef } from '~/components/RealtimeLineChart.vue'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChevronDown,
  IconCloud,
  IconCpu,
  IconNetwork,
  IconPlugConnected,
  IconServer,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { getChartThemeColors } from '~/utils'

const { t } = useI18n()

useHead({ title: computed(() => t('overview')) })
const globalStore = useGlobalStore()
const connectionsStore = useConnectionsStore()
const endpointStore = useEndpointStore()
const configStore = useConfigStore()
const proxiesStore = useProxiesStore()

const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Ensure proxy data is available for isProxyGroup filtering in top proxies chart
onMounted(() => {
  if (proxiesStore.proxies.length === 0) {
    proxiesStore.fetchProxies()
  }
})

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

  // Get top 5 proxies by speed, excluding proxy groups
  const sortedProxies = Object.entries(speedByName)
    .filter(([name]) => !proxiesStore.isProxyGroup(name))
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
  <div
    class="flex h-full flex-col gap-4 overflow-x-hidden overflow-y-auto p-1 pr-2 sm:pr-3"
  >
    <!-- Stats Grid -->
    <div
      class="-m-1 grid min-w-0 grid-cols-2 gap-3 p-1 sm:grid-cols-3 xl:grid-cols-6"
    >
      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:0ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-success/15 text-success"
        >
          <IconArrowUpRight :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('upload') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{ formatBytes(globalStore.latestTraffic?.up || 0) }}/s
          </span>
        </div>
      </div>

      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:50ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-info/15 text-info"
        >
          <IconArrowDownRight :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('download') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{ formatBytes(globalStore.latestTraffic?.down || 0) }}/s
          </span>
        </div>
      </div>

      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:100ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-secondary/15 text-secondary"
        >
          <IconCloud :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('uploadTotal') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{
              formatBytes(
                connectionsStore.latestConnectionMsg?.uploadTotal || 0,
              )
            }}
          </span>
        </div>
      </div>

      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:150ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-secondary/15 text-secondary"
        >
          <IconCloud :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('downloadTotal') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{
              formatBytes(
                connectionsStore.latestConnectionMsg?.downloadTotal || 0,
              )
            }}
          </span>
        </div>
      </div>

      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:200ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-warning/15 text-warning"
        >
          <IconPlugConnected :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('activeConnections') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{ connectionsStore.latestConnectionMsg?.connections?.length || 0 }}
          </span>
        </div>
      </div>

      <div
        class="overview-stat-card animate-fade-slide-in flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-4 transition-all duration-200 [animation-delay:250ms] hover:z-10 hover:-translate-y-0.5 hover:border-base-content/20"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.625rem] bg-error/15 text-error"
        >
          <IconCpu :size="20" />
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span
            class="overflow-hidden text-xs text-ellipsis whitespace-nowrap text-base-content/60"
            >{{ t('memoryUsage') }}</span
          >
          <span
            class="text-base font-semibold whitespace-nowrap text-base-content tabular-nums"
          >
            {{ formatBytes(globalStore.latestMemory?.inuse || 0) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Endpoint Info -->
    <div
      v-if="endpointStore.currentEndpoint?.url"
      class="animate-fade-slide-in flex items-center justify-center gap-2 rounded-lg border border-primary/15 bg-primary/8 px-4 py-3 [animation-delay:300ms]"
    >
      <IconServer :size="18" class="text-primary" />
      <span class="text-sm text-base-content/60">{{ t('connectedTo') }}:</span>
      <span class="font-mono text-sm font-medium text-base-content">{{
        endpointStore.currentEndpoint?.url
      }}</span>
    </div>

    <!-- Charts Grid -->
    <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:350ms] lg:h-80"
      >
        <RealtimeLineChart
          ref="trafficChartRef"
          :title="t('traffic')"
          :series-config="trafficSeriesConfig"
          :initial-data="trafficInitialData"
          :is-loading="!globalStore.latestTraffic"
        />
      </div>

      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:400ms] lg:h-80"
      >
        <HighchartsAutoSize
          :options="flowChartOptions"
          :is-loading="!connectionsStore.latestConnectionMsg"
        />
      </div>

      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:450ms] lg:h-80"
      >
        <RealtimeLineChart
          ref="memoryChartRef"
          :title="t('memory')"
          :series-config="memorySeriesConfig"
          :initial-data="memoryInitialData"
          :is-loading="!globalStore.latestMemory"
        />
      </div>

      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:500ms] lg:h-80"
      >
        <RealtimeLineChart
          ref="connectionsChartRef"
          :title="t('connectionsChart')"
          :series-config="connectionsSeriesConfig"
          :initial-data="connectionsInitialData"
          :is-loading="!connectionsStore.latestConnectionMsg"
          value-mode="number"
        />
      </div>

      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:550ms] lg:h-80"
      >
        <HighchartsAutoSize
          :options="networkTypesChartOptions"
          :is-loading="!connectionsStore.latestConnectionMsg"
        />
      </div>

      <div
        class="animate-fade-slide-in h-72 min-w-0 overflow-hidden rounded-xl border border-base-content/10 bg-base-200 p-2 [animation-delay:600ms] lg:h-80"
      >
        <HighchartsAutoSize
          :options="topProxiesChartOptions"
          :is-loading="!connectionsStore.latestConnectionMsg"
        />
      </div>
    </div>

    <!-- Network Info Section -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <IPInfoCard />
      <LatencyCard />
    </div>

    <!-- Network Topology -->
    <div class="rounded-xl border border-base-content/10 bg-base-200 p-4">
      <div
        class="flex cursor-pointer items-center justify-between"
        @click="
          configStore.showNetworkTopology = !configStore.showNetworkTopology
        "
      >
        <div class="flex items-center gap-2 font-semibold text-base-content">
          <IconNetwork :size="20" />
          <h3>{{ t('networkTopology') }}</h3>
        </div>
        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-base-content transition-colors duration-200 hover:bg-base-content/10"
        >
          <IconChevronDown
            :size="20"
            class="transition-transform duration-300"
            :class="{ 'rotate-180': configStore.showNetworkTopology }"
          />
        </button>
      </div>
      <NetworkTopology v-if="configStore.showNetworkTopology" class="mt-4" />
    </div>

    <!-- Data Usage Table -->
    <DataUsageTable />
  </div>
</template>

<style>
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-slide-in {
  animation: fade-slide-in 0.4s ease-out backwards;
}
</style>
