<script setup lang="ts">
import type { AggregatedData } from '~/composables/useDataUsage'
import type { DataUsageType } from '~/types'
import {
  IconArrowsExchange,
  IconClock,
  IconCpu,
  IconDevices,
  IconDownload,
  IconSum,
  IconTrash,
  IconUpload,
  IconUser,
  IconWorld,
} from '@tabler/icons-vue'
import dayjs from 'dayjs'
import Highcharts from 'highcharts'
import { throttle } from 'lodash-es'
import { useDataUsage } from '~/composables/useDataUsage'
import { formatBytes, formatDuration } from '~/utils'

// Configure Highcharts to use local time
// In Highcharts v12, useUTC was removed; local timezone is now the default
Highcharts.setOptions({
  time: {},
})

const { t } = useI18n()
const connectionsStore = useConnectionsStore()
const {
  getAggregatedData,
  getSubStatsByHost,
  getProxyStatsByHost,
  getTrafficTrend,
  getDevicesByHost,
  getDevicesByProxyAndHost,
} = useDataUsage()

useHead({ title: computed(() => t('dataUsage')) })
type SortField = 'label' | 'upload' | 'download' | 'total' | 'count'
type SortOrder = 'asc' | 'desc'

const sortField = ref<SortField>('total')
const sortOrder = ref<SortOrder>('desc')
const activeView = useLocalStorage<DataUsageType>(
  'traffic_active_view',
  'sourceIP',
)

const timeRangeOptions = computed(() => [
  { label: t('lastHour'), value: 3600000 },
  { label: t('lastDay'), value: 86400000 },
  { label: t('lastMonth'), value: 2592000000 },
  { label: t('customRange'), value: -1 },
])
const selectedTimeRange = useLocalStorage('traffic_time_range', 3600000)
const retentionOptions = computed(() => [
  { label: t('forever'), value: -1 },
  { label: t('lastHour'), value: 3600000 },
  { label: t('lastDay'), value: 86400000 },
  { label: t('lastMonth'), value: 2592000000 },
])
const selectedDataRetention = useLocalStorage('traffic_data_retention', -1)

// Custom Time Range State (Persisted)
const customStart = useLocalStorage(
  'traffic_custom_start',
  dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm'),
)
const customEnd = useLocalStorage(
  'traffic_custom_end',
  dayjs().format('YYYY-MM-DDTHH:mm'),
)

const dataUsageEntries = ref<AggregatedData[]>([])
const trendData = ref<any[]>([])
const selectedRow = ref<string | null>(null)
const selectedSubRow = ref<string | null>(null)
const subStatsMap = ref<Record<string, AggregatedData[]>>({})
const proxyStatsMap = ref<Record<string, AggregatedData[]>>({})

// Helper: Get active time range
const getTimeRange = () => {
  if (selectedTimeRange.value === -1) {
    return {
      startTime: dayjs(customStart.value).valueOf(),
      endTime: dayjs(customEnd.value).valueOf(),
    }
  }
  const endTime = Date.now()
  return {
    endTime,
    startTime: endTime - selectedTimeRange.value,
  }
}

const fetchData = async () => {
  const { startTime, endTime } = getTimeRange()

  // Dynamic bucket size based on time range to prevent overly dense charts
  const rangeMs = endTime - startTime
  let bucketSizeMs = 60000 // 1 min default

  if (rangeMs <= 3600000)
    bucketSizeMs = 60000 // 1 min for last hour (60 points)
  else if (rangeMs <= 86400000)
    bucketSizeMs = 300000 // 5 min for last day (288 points)
  else if (rangeMs <= 604800000)
    bucketSizeMs = 3600000 // 1 hour for last week (168 points)
  else bucketSizeMs = 86400000 // 1 day for longer periods

  try {
    const [aggregated, trend] = await Promise.all([
      getAggregatedData(activeView.value, startTime, endTime),
      getTrafficTrend(startTime, endTime, bucketSizeMs),
    ])

    dataUsageEntries.value = aggregated
    trendData.value = trend

    // Auto-select first row if nothing is selected
    const sorted = sortedDataUsageEntries.value
    if (!selectedRow.value && sorted.length > 0) {
      handleRowClick(sorted[0]!.label)
    } else if (selectedRow.value) {
      await loadSubStats(selectedRow.value)
    }
  } catch (e) {
    console.error('Failed to fetch traffic data', e)
  }
}

watch(
  [activeView, selectedTimeRange],
  ([_, timeRange], [__, prevTimeRange]) => {
    if (timeRange === -1 && prevTimeRange !== -1) {
      const { startTime, endTime } = getTimeRange()
      customStart.value = dayjs(startTime).format('YYYY-MM-DDTHH:mm')
      customEnd.value = dayjs(endTime).format('YYYY-MM-DDTHH:mm')
    }

    selectedRow.value = null
    selectedSubRow.value = null
    subStatsMap.value = {}
    proxyStatsMap.value = {}
    fetchData()
  },
  { immediate: true },
)

// Enable window focus refetch for traffic data with throttling
watch(
  useWindowFocus(),
  throttle((focused) => {
    if (focused && selectedTimeRange.value !== -1) fetchData()
  }, 30000),
)

const viewOptions = computed(() => [
  { label: t('devices'), value: 'sourceIP', icon: IconDevices },
  { label: t('user'), value: 'inboundUser', icon: IconUser },
  { label: t('host'), value: 'host', icon: IconWorld },
  { label: t('proxies'), value: 'outbound', icon: IconArrowsExchange },
  { label: t('process'), value: 'process', icon: IconCpu },
])
const currentViewOption = computed(() =>
  viewOptions.value.find((o) => o.value === activeView.value),
)

const sortedDataUsageEntries = computed(() => {
  const entries = [...dataUsageEntries.value]
  const field = sortField.value
  const order = sortOrder.value

  return entries.sort((a, b) => {
    let comparison = 0
    if (field === 'label') comparison = a.label.localeCompare(b.label)
    else comparison = (a[field] as number) - (b[field] as number)
    return order === 'asc' ? comparison : -comparison
  })
})

const totalStats = computed(() => {
  const entries = dataUsageEntries.value
  const totalUpload = entries.reduce((sum, entry) => sum + entry.upload, 0)
  const totalDownload = entries.reduce((sum, entry) => sum + entry.download, 0)

  const { startTime, endTime } = getTimeRange()
  const durationText = formatDuration(startTime, endTime)

  return {
    count: entries.length,
    upload: totalUpload,
    download: totalDownload,
    total: totalUpload + totalDownload,
    durationText,
  }
})

async function handleClearAll() {
  if (confirm(t('confirmClearAll'))) {
    await connectionsStore.clearDataUsage()
    await fetchData()
  }
}

const handleRowClick = async (label: string) => {
  selectedRow.value = label
  selectedSubRow.value = null
  await loadSubStats(label)
}

const loadSubStats = async (label: string) => {
  const { startTime, endTime } = getTimeRange()

  if (activeView.value === 'host') {
    subStatsMap.value[label] = await getDevicesByHost(label, startTime, endTime)
  } else {
    subStatsMap.value[label] = await getSubStatsByHost(
      activeView.value as Exclude<DataUsageType, 'host'>,
      label,
      startTime,
      endTime,
    )
  }
}

const handleSubRowClick = async (parentLabel: string, subLabel: string) => {
  const compositeKey = `${parentLabel}:${subLabel}`
  if (selectedSubRow.value === compositeKey) {
    selectedSubRow.value = null
    return
  }
  selectedSubRow.value = compositeKey
  const { startTime, endTime } = getTimeRange()

  if (activeView.value === 'host') {
    proxyStatsMap.value[compositeKey] = await getProxyStatsByHost(
      'sourceIP',
      subLabel,
      parentLabel,
      startTime,
      endTime,
    )
  } else if (activeView.value === 'outbound') {
    proxyStatsMap.value[compositeKey] = await getDevicesByProxyAndHost(
      parentLabel, // Proxy
      subLabel, // Host
      startTime,
      endTime,
    )
  } else {
    proxyStatsMap.value[compositeKey] = await getProxyStatsByHost(
      activeView.value as DataUsageType,
      parentLabel,
      subLabel,
      startTime,
      endTime,
    )
  }
}

const currentViewLabel = computed(
  () =>
    viewOptions.value.find((o) => o.value === activeView.value)?.label ||
    t('name'),
)
</script>

<template>
  <div class="flex h-full flex-col gap-4 overflow-hidden">
    <!-- Header Row -->
    <div
      class="animate-fade-slide-in flex shrink-0 flex-wrap items-center justify-between gap-3 px-1"
    >
      <div
        class="flex shrink-0 gap-1 rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 p-1"
      >
        <button
          v-for="opt in viewOptions"
          :key="opt.value"
          class="flex cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-3 py-1.5 text-[0.8125rem] font-medium text-base-content/60 transition-all duration-200 hover:bg-base-content/5 hover:text-base-content"
          :class="{
            'bg-primary! text-primary-content! shadow-[0_2px_8px_color-mix(in_oklch,var(--color-primary)_30%,transparent)]':
              activeView === opt.value,
          }"
          @click="activeView = opt.value as DataUsageType"
        >
          <component :is="opt.icon" :size="16" />
          <span class="hidden sm:inline">{{ opt.label }}</span>
        </button>
      </div>

      <!-- Time & Action Area -->
      <div class="flex items-center gap-2">
        <div
          v-if="selectedTimeRange === -1"
          class="animate-in fade-in zoom-in-95 flex items-center gap-1"
        >
          <input
            v-model="customStart"
            type="datetime-local"
            class="rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 px-2 py-1.5 text-[0.75rem] text-base-content focus:border-primary focus:outline-none"
            @change="fetchData"
          />
          <span class="text-[10px] opacity-30">→</span>
          <input
            v-model="customEnd"
            type="datetime-local"
            class="rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 px-2 py-1.5 text-[0.75rem] text-base-content focus:border-primary focus:outline-none"
            @change="fetchData"
          />
        </div>

        <div class="flex items-center gap-1">
          <span class="hidden text-[0.75rem] text-base-content/50 md:inline">
            {{ t('timeRange') }}
          </span>
          <div class="relative">
            <select
              v-model.number="selectedTimeRange"
              :title="t('timeRange')"
              class="cursor-pointer appearance-none rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 py-1.5 pr-8 pl-3 text-[0.8125rem] text-base-content transition-all duration-200 hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] focus:border-primary focus:outline-none"
              style="
                background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;);
                background-repeat: no-repeat;
                background-position: right 0.5rem center;
                background-size: 1rem;
              "
            >
              <option
                v-for="opt in timeRangeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <span class="hidden text-[0.75rem] text-base-content/50 md:inline">
            {{ t('dataRetention') }}
          </span>
          <div class="relative">
            <select
              v-model.number="selectedDataRetention"
              :title="t('dataRetention')"
              class="cursor-pointer appearance-none rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 py-1.5 pr-8 pl-3 text-[0.8125rem] text-base-content transition-all duration-200 hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] focus:border-primary focus:outline-none"
              style="
                background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;);
                background-repeat: no-repeat;
                background-position: right 0.5rem center;
                background-size: 1rem;
              "
            >
              <option
                v-for="opt in retentionOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <button
          class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[color-mix(in_oklch,var(--color-base-content)_12%,transparent)] bg-base-200/60 text-base-content transition-all duration-200 hover:border-error/30 hover:bg-error/15 hover:text-error"
          :title="t('clearAll')"
          @click="handleClearAll"
        >
          <IconTrash :size="18" />
        </button>
      </div>
    </div>

    <!-- Main Workspace (Internal Scroll) -->
    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <div class="flex flex-col gap-4">
        <!-- Summary Cards -->
        <div class="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <div
            class="animate-fade-slide-in flex h-16 items-center gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-3 shadow-sm [animation-delay:50ms] xl:h-20"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary xl:h-10 xl:w-10 xl:rounded-xl"
            >
              <component
                :is="currentViewOption?.icon || IconDevices"
                :size="18"
              />
            </div>
            <div class="flex min-w-0 flex-col">
              <span
                class="mb-1 truncate text-[7px] leading-none font-black tracking-widest uppercase opacity-40 xl:text-[9px]"
                >{{ currentViewLabel }}</span
              >
              <span class="text-sm leading-tight font-black xl:text-lg">{{
                totalStats.count
              }}</span>
            </div>
          </div>
          <div
            class="animate-fade-slide-in flex h-16 items-center gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-3 shadow-sm [animation-delay:100ms] xl:h-20"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success xl:h-10 xl:w-10 xl:rounded-xl"
            >
              <IconUpload :size="18" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span
                class="mb-1 truncate text-[7px] leading-none font-black tracking-widest uppercase opacity-40 xl:text-[9px]"
                >{{ t('upload') }}</span
              >
              <span class="text-sm leading-tight font-black xl:text-lg">{{
                formatBytes(totalStats.upload)
              }}</span>
            </div>
          </div>
          <div
            class="animate-fade-slide-in flex h-16 items-center gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-3 shadow-sm [animation-delay:150ms] xl:h-20"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info xl:h-10 xl:w-10 xl:rounded-xl"
            >
              <IconDownload :size="18" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span
                class="mb-1 truncate text-[7px] leading-none font-black tracking-widest uppercase opacity-40 xl:text-[9px]"
                >{{ t('download') }}</span
              >
              <span class="text-sm leading-tight font-black xl:text-lg">{{
                formatBytes(totalStats.download)
              }}</span>
            </div>
          </div>
          <div
            class="animate-fade-slide-in relative flex h-16 items-center gap-3 overflow-hidden rounded-2xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200/50 p-3 shadow-sm [animation-delay:200ms] xl:h-20"
          >
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary xl:h-10 xl:w-10 xl:rounded-xl"
            >
              <IconSum :size="18" />
            </div>
            <div class="flex min-w-0 flex-col">
              <span
                class="mb-1 truncate text-[7px] leading-none font-black tracking-widest uppercase opacity-40 xl:text-[9px]"
                >{{ t('total') }}</span
              >
              <span
                class="text-sm leading-tight font-black text-secondary xl:text-lg"
                >{{ formatBytes(totalStats.total) }}</span
              >
            </div>
            <div
              class="absolute top-1 right-2 flex origin-right scale-75 items-center gap-1 opacity-30 xl:top-2 xl:right-3 xl:scale-100"
            >
              <IconClock :size="12" />
              <span
                class="text-[8px] font-black tracking-wider uppercase xl:text-[10px]"
                >{{ totalStats.durationText }}</span
              >
            </div>
          </div>
        </div>

        <!-- Row 1: Rankings & Trend Chart -->
        <div
          class="grid h-auto shrink-0 grid-cols-1 gap-4 xl:h-[320px] xl:grid-cols-4"
        >
          <div
            class="animate-fade-slide-in col-span-1 min-h-[300px] w-full overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200 p-4 shadow-sm transition-all duration-200 [animation-delay:250ms] hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] xl:h-full"
          >
            <TrafficRankings
              :title="t('topProxies').slice(0, 2) + currentViewLabel"
              :icon="currentViewOption?.icon"
              :data="sortedDataUsageEntries"
              :selected-row="selectedRow"
              @select="handleRowClick"
            />
          </div>

          <div
            class="animate-fade-slide-in col-span-1 min-h-[320px] min-w-0 overflow-hidden rounded-xl border border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-base-200 p-2 shadow-sm transition-all duration-200 [animation-delay:300ms] hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] xl:col-span-3 xl:h-full"
          >
            <TrafficTrendChart
              :data="trendData"
              :start-time="getTimeRange().startTime"
              :end-time="getTimeRange().endTime"
              :title="t('traffic')"
            />
          </div>
        </div>

        <!-- Row 3: Full-width Detail Table -->
        <div class="animate-fade-slide-in [animation-delay:350ms]">
          <TrafficDetailsTable
            v-if="selectedRow"
            :selected-row="selectedRow"
            :active-view="activeView"
            :sub-stats="subStatsMap[selectedRow] || []"
            :proxy-stats-map="proxyStatsMap"
            :selected-sub-row="selectedSubRow"
            @sub-row-click="handleSubRowClick"
          />
        </div>
      </div>
    </div>
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
