<script setup lang="ts">
import type { DataUsageType } from '~/types'
import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconInfoCircle,
  IconTrash,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { formatDateRange, formatDuration } from '~/utils'

const { t, locale } = useI18n()
const connectionsStore = useConnectionsStore()

type SortField = 'label' | 'duration' | 'upload' | 'download' | 'total'
type SortOrder = 'asc' | 'desc'

const sortField = ref<SortField>('total')
const sortOrder = ref<SortOrder>('desc')
const showTable = useLocalStorage('showDataUsageTable', false)
const activeView = useLocalStorage<DataUsageType>('dataUsageView', 'sourceIP')

// Pagination state
const currentPage = ref(0)
const pageSize = useLocalStorage('dataUsageTablePageSize', 50)

const formatBytes = (bytes: number) => byteSize(bytes).toString()

const viewOptions = computed(() => [
  { label: t('devices'), value: 'sourceIP' as DataUsageType },
  { label: t('host'), value: 'host' as DataUsageType },
  { label: t('proxies'), value: 'outbound' as DataUsageType },
  { label: t('process'), value: 'process' as DataUsageType },
])

function handleSort(field: SortField) {
  if (sortField.value === field) {
    // Toggle order if same field
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new field with default desc order
    sortField.value = field
    sortOrder.value = 'desc'
  }
}

const sortedDataUsageEntries = computed(() => {
  const typeMap = connectionsStore.dataUsageMap[activeView.value] || {}
  const entries = Object.values(typeMap)
  const field = sortField.value
  const order = sortOrder.value

  return entries.sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'label':
        comparison = a.label.localeCompare(b.label)
        break
      case 'duration': {
        const durationA = a.firstSeen ? a.lastSeen - a.firstSeen : 0
        const durationB = b.firstSeen ? b.lastSeen - b.firstSeen : 0
        comparison = durationA - durationB
        break
      }
      case 'upload':
        comparison = a.upload - b.upload
        break
      case 'download':
        comparison = a.download - b.download
        break
      case 'total':
        comparison = a.total - b.total
        break
    }

    return order === 'asc' ? comparison : -comparison
  })
})

const totalStats = computed(() => {
  const entries = sortedDataUsageEntries.value
  const totalUpload = entries.reduce((sum, entry) => sum + entry.upload, 0)
  const totalDownload = entries.reduce((sum, entry) => sum + entry.download, 0)

  // Calculate overall time range
  let earliestFirst = Number.MAX_SAFE_INTEGER
  let latestLast = 0

  entries.forEach((entry) => {
    if (entry.firstSeen && entry.firstSeen < earliestFirst) {
      earliestFirst = entry.firstSeen
    }
    if (entry.lastSeen && entry.lastSeen > latestLast) {
      latestLast = entry.lastSeen
    }
  })

  const hasTimeRange =
    earliestFirst !== Number.MAX_SAFE_INTEGER && latestLast > 0

  return {
    count: entries.length,
    upload: totalUpload,
    download: totalDownload,
    total: totalUpload + totalDownload,
    firstSeen: hasTimeRange ? earliestFirst : undefined,
    lastSeen: hasTimeRange ? latestLast : undefined,
  }
})

// Pagination Computed
const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedDataUsageEntries.value.length / pageSize.value)),
)

const visiblePages = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
  const pages: number[] = []

  pages.push(0)

  for (
    let i = Math.max(1, current - 1);
    i <= Math.min(total - 2, current + 1);
    i++
  ) {
    if (!pages.includes(i)) pages.push(i)
  }

  if (total > 1 && !pages.includes(total - 1)) {
    pages.push(total - 1)
  }

  return pages.sort((a, b) => a - b)
})

const paginatedDataUsageEntries = computed(() => {
  const start = currentPage.value * pageSize.value
  return sortedDataUsageEntries.value.slice(start, start + pageSize.value)
})

const paginationInfo = computed(() => {
  const total = sortedDataUsageEntries.value.length
  const start = currentPage.value * pageSize.value + 1
  const end = Math.min((currentPage.value + 1) * pageSize.value, total)
  return `${start}-${end} / ${total}`
})

// Reset page when view changes
watch([activeView], () => {
  currentPage.value = 0
})

function handleClearAll() {
  if (confirm(t('confirmClearAll'))) {
    connectionsStore.clearDataUsage()
  }
}

function handleRemoveEntry(label: string) {
  connectionsStore.removeDataUsageEntry(activeView.value, label)
}

const currentViewLabel = computed(() => {
  const option = viewOptions.value.find((o) => o.value === activeView.value)
  return option ? option.label : t('name')
})
</script>

<template>
  <div class="rounded-xl border border-base-content/10 bg-base-200/50 p-4">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold">
            {{ t('dataUsage') }}
          </h3>
          <div class="relative">
            <button
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-info hover:bg-base-content/10"
              :title="t('dataUsageInfo')"
            >
              <IconInfoCircle :size="18" />
            </button>
          </div>
          <input
            v-model="showTable"
            type="checkbox"
            class="toggle toggle-primary"
          />
        </div>

        <div v-if="showTable" class="flex items-center gap-2">
          <select
            v-model="activeView"
            class="h-8 rounded-lg border border-base-content/12 bg-base-200/80 px-2 text-sm text-base-content focus:outline-none"
          >
            <option
              v-for="opt in viewOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>

          <button
            class="flex h-8 items-center gap-1 rounded-lg bg-error/15 px-3 text-sm text-error transition-colors hover:bg-error/25"
            @click="handleClearAll"
          >
            <IconTrash :size="16" />
            <span class="hidden sm:inline">{{ t('clearAll') }}</span>
          </button>
        </div>
      </div>

      <template v-if="showTable">
        <!-- Total Stats -->
        <div
          v-if="totalStats.count > 0"
          class="flex flex-col gap-1 rounded-lg border border-base-content/10 bg-base-200/80 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
        >
          <div class="flex flex-col">
            <div class="text-xs text-base-content/60">
              {{ currentViewLabel }}
            </div>
            <div class="text-lg font-bold text-primary">
              {{ totalStats.count }}
            </div>
          </div>
          <div
            v-if="totalStats.firstSeen && totalStats.lastSeen"
            class="flex flex-col"
          >
            <div class="text-xs text-base-content/60">
              {{ t('timeRange') }}
            </div>
            <div
              class="flex items-center gap-1 text-sm font-semibold"
              :title="
                formatDateRange(
                  totalStats.firstSeen,
                  totalStats.lastSeen,
                  locale,
                )
              "
            >
              <IconClock :size="16" />
              <span>{{
                formatDuration(totalStats.firstSeen, totalStats.lastSeen)
              }}</span>
            </div>
          </div>
          <div class="flex flex-col">
            <div class="text-xs text-base-content/60">
              {{ t('uploadTotal') }}
            </div>
            <div class="text-lg font-bold">
              {{ formatBytes(totalStats.upload) }}
            </div>
          </div>
          <div class="flex flex-col">
            <div class="text-xs text-base-content/60">
              {{ t('downloadTotal') }}
            </div>
            <div class="text-lg font-bold">
              {{ formatBytes(totalStats.download) }}
            </div>
          </div>
          <div class="flex flex-col">
            <div class="text-xs text-base-content/60">
              {{ t('grandTotal') }}
            </div>
            <div class="text-lg font-bold text-secondary">
              {{ formatBytes(totalStats.total) }}
            </div>
          </div>
        </div>

        <!-- Mobile Pagination -->
        <div class="flex shrink-0 items-center justify-center py-2 md:hidden">
          <ConnectionsPagination
            :current-page="currentPage"
            :total-pages="totalPages"
            :visible-pages="visiblePages"
            @go-to-page="currentPage = $event"
            @previous="currentPage--"
            @next="currentPage++"
          />
        </div>

        <!-- Desktop Table View -->
        <div class="hidden overflow-x-auto rounded-lg lg:block">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-base-content/10 bg-base-200/80">
                <th class="px-3 py-2 text-left text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('label')"
                  >
                    <span>{{ currentViewLabel }}</span>
                    <IconArrowUp
                      v-if="sortField === 'label' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="sortField === 'label' && sortOrder === 'desc'"
                      :size="14"
                    />
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('duration')"
                  >
                    <span>{{ t('duration') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'duration' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="
                        sortField === 'duration' && sortOrder === 'desc'
                      "
                      :size="14"
                    />
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('upload')"
                  >
                    <span>{{ t('upload') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'upload' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="sortField === 'upload' && sortOrder === 'desc'"
                      :size="14"
                    />
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('download')"
                  >
                    <span>{{ t('download') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'download' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="
                        sortField === 'download' && sortOrder === 'desc'
                      "
                      :size="14"
                    />
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-base-content">
                  <button
                    class="flex items-center gap-1 hover:text-primary"
                    @click="handleSort('total')"
                  >
                    <span>{{ t('total') }}</span>
                    <IconArrowUp
                      v-if="sortField === 'total' && sortOrder === 'asc'"
                      :size="14"
                    />
                    <IconArrowDown
                      v-else-if="sortField === 'total' && sortOrder === 'desc'"
                      :size="14"
                    />
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-base-content">
                  {{ t('actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedDataUsageEntries.length === 0">
                <td
                  colspan="6"
                  class="px-3 py-4 text-center text-base-content/70"
                >
                  {{ t('noDataUsageYet') }}
                </td>
              </tr>
              <template v-else>
                <tr
                  v-for="row in paginatedDataUsageEntries"
                  :key="row.label"
                  class="border-b border-base-content/5 transition-colors hover:bg-base-content/5"
                >
                  <td class="px-3 py-2 font-mono text-base-content">
                    {{ row.label }}
                  </td>
                  <td
                    class="px-3 py-2 text-base-content"
                    :title="
                      row.firstSeen
                        ? formatDateRange(row.firstSeen, row.lastSeen, locale)
                        : '-'
                    "
                  >
                    <div class="flex items-center gap-1">
                      <IconClock :size="14" class="text-base-content/60" />
                      <span class="text-sm">
                        {{
                          row.firstSeen
                            ? formatDuration(row.firstSeen, row.lastSeen)
                            : '-'
                        }}
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-base-content">
                    {{ formatBytes(row.upload) }}
                  </td>
                  <td class="px-3 py-2 text-base-content">
                    {{ formatBytes(row.download) }}
                  </td>
                  <td class="px-3 py-2 font-bold text-primary">
                    {{ formatBytes(row.total) }}
                  </td>
                  <td class="px-3 py-2">
                    <button
                      class="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-error hover:bg-error/20"
                      :title="t('remove')"
                      @click.stop="handleRemoveEntry(row.label)"
                    >
                      <IconTrash :size="14" />
                    </button>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="flex flex-col gap-3 lg:hidden">
          <!-- Mobile Sort -->
          <div
            v-if="paginatedDataUsageEntries.length > 0"
            class="flex flex-col gap-2 rounded-lg border border-base-content/10 bg-base-200/80 p-3"
          >
            <div class="flex items-center gap-2">
              <div class="text-xs font-semibold text-base-content/60">
                {{ t('sortBy') }}
              </div>
              <div class="flex flex-1 gap-2">
                <button
                  class="flex-1 rounded px-2 py-1 text-xs transition-colors"
                  :class="
                    sortField === 'label'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-content/10 hover:bg-base-content/15'
                  "
                  @click="handleSort('label')"
                >
                  {{ t('name') }}
                  <IconArrowUp
                    v-if="sortField === 'label' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'label' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
                <button
                  class="flex-1 rounded px-2 py-1 text-xs transition-colors"
                  :class="
                    sortField === 'duration'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-content/10 hover:bg-base-content/15'
                  "
                  @click="handleSort('duration')"
                >
                  {{ t('duration') }}
                  <IconArrowUp
                    v-if="sortField === 'duration' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'duration' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
                <button
                  class="flex-1 rounded px-2 py-1 text-xs transition-colors"
                  :class="
                    sortField === 'upload'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-content/10 hover:bg-base-content/15'
                  "
                  @click="handleSort('upload')"
                >
                  {{ t('upload') }}
                  <IconArrowUp
                    v-if="sortField === 'upload' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'upload' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
                <button
                  class="flex-1 rounded px-2 py-1 text-xs transition-colors"
                  :class="
                    sortField === 'download'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-content/10 hover:bg-base-content/15'
                  "
                  @click="handleSort('download')"
                >
                  {{ t('download') }}
                  <IconArrowUp
                    v-if="sortField === 'download' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'download' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
                <button
                  class="flex-1 rounded px-2 py-1 text-xs transition-colors"
                  :class="
                    sortField === 'total'
                      ? 'bg-primary text-primary-content'
                      : 'bg-base-content/10 hover:bg-base-content/15'
                  "
                  @click="handleSort('total')"
                >
                  {{ t('total') }}
                  <IconArrowUp
                    v-if="sortField === 'total' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'total' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- No data -->
          <div
            v-if="paginatedDataUsageEntries.length === 0"
            class="rounded-lg border border-base-content/10 bg-base-200/80 p-4 text-center text-base-content/70"
          >
            {{ t('noDataUsageYet') }}
          </div>

          <!-- Mobile Cards -->
          <template v-for="row in paginatedDataUsageEntries" :key="row.label">
            <!-- Data card -->
            <div
              class="rounded-lg border border-base-content/10 bg-base-200/80 p-4"
            >
              <div class="mb-2 flex items-start justify-between">
                <div class="flex-1">
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ currentViewLabel }}
                  </div>
                  <div
                    class="font-mono text-sm font-bold break-all text-base-content"
                  >
                    {{ row.label }}
                  </div>
                </div>
                <button
                  class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-error hover:bg-error/20"
                  :title="t('remove')"
                  @click.stop="handleRemoveEntry(row.label)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>

              <div v-if="row.firstSeen" class="mb-2">
                <div
                  class="text-xs font-semibold text-base-content/60 uppercase"
                >
                  {{ t('timeRange') }}
                </div>
                <div class="flex items-center gap-1 text-sm text-base-content">
                  <IconClock :size="14" class="text-base-content/60" />
                  <span>{{ formatDuration(row.firstSeen, row.lastSeen) }}</span>
                </div>
                <div class="text-xs text-base-content/60">
                  {{ formatDateRange(row.firstSeen, row.lastSeen, locale) }}
                </div>
              </div>

              <div class="my-2 h-px bg-base-content/10" />

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('upload') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(row.upload) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('download') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(row.download) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('total') }}
                  </div>
                  <div class="text-sm font-bold text-primary">
                    {{ formatBytes(row.total) }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Desktop Pagination -->
        <div
          class="hidden shrink-0 items-center justify-between gap-2 pt-2 md:flex"
        >
          <div class="flex shrink-0 items-center gap-1.5">
            <select
              v-model.number="pageSize"
              class="h-7 rounded-lg border border-base-content/12 bg-base-200/80 px-2 text-xs text-base-content focus:outline-none"
            >
              <option
                v-for="size in [20, 50, 100, 200]"
                :key="size"
                :value="size"
              >
                {{ size }}
              </option>
            </select>
            <span class="text-xs whitespace-nowrap text-base-content/60">
              {{ paginationInfo }}
            </span>
          </div>

          <ConnectionsPagination
            :current-page="currentPage"
            :total-pages="totalPages"
            :visible-pages="visiblePages"
            @go-to-page="currentPage = $event"
            @previous="currentPage--"
            @next="currentPage++"
          />
        </div>
      </template>
    </div>
  </div>
</template>
