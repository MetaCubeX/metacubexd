<script setup lang="ts">
import {
  IconArrowDown,
  IconArrowUp,
  IconClock,
  IconInfoCircle,
  IconTrash,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { formatDateRange, formatDuration } from '~/utils'

const { t, locale } = useI18n()
const connectionsStore = useConnectionsStore()

type SortField = 'ip' | 'duration' | 'upload' | 'download' | 'total'
type SortOrder = 'asc' | 'desc'
type GroupField = 'ip' | null

const sortField = ref<SortField>('total')
const sortOrder = ref<SortOrder>('desc')
const groupingField = ref<GroupField>(null)
const expandedGroups = ref<Record<string, boolean>>({})
const showTable = useLocalStorage('showDataUsageTable', false)

const formatBytes = (bytes: number) => byteSize(bytes).toString()

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

function handleToggleGrouping(field: GroupField) {
  if (groupingField.value === field) {
    // Toggle off grouping
    groupingField.value = null
    expandedGroups.value = {}
  } else {
    // Set new grouping field
    groupingField.value = field
    expandedGroups.value = {}
  }
}

function handleToggleGroupExpanded(key: string) {
  expandedGroups.value[key] = !expandedGroups.value[key]
}

const sortedDataUsageEntries = computed(() => {
  const entries = Object.values(connectionsStore.dataUsageMap)
  const field = sortField.value
  const order = sortOrder.value

  return entries.sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'ip':
        comparison = a.sourceIP.localeCompare(b.sourceIP)
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

// Grouped row model
interface GroupRow {
  type: 'group'
  key: string
  depth: number
  subRows: (typeof connectionsStore.dataUsageMap)[string][]
}

interface DataRow {
  type: 'data'
  original: (typeof connectionsStore.dataUsageMap)[string]
  depth: number
}

type TableRow = GroupRow | DataRow

const dataUsageEntries = computed<TableRow[]>(() => {
  const entries = sortedDataUsageEntries.value

  // No grouping - return data rows
  if (!groupingField.value) {
    return entries.map((entry) => ({
      type: 'data' as const,
      original: entry,
      depth: 0,
    }))
  }

  // Build grouped rows
  const groups = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = entry.sourceIP

    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  // Flatten into row model with group headers and expanded data rows
  const rows: TableRow[] = []
  for (const [key, subRows] of groups) {
    // Group header row
    rows.push({ type: 'group', key, depth: 0, subRows })

    // Data rows (only if expanded)
    if (expandedGroups.value[key]) {
      for (const entry of subRows) {
        rows.push({ type: 'data', original: entry, depth: 1 })
      }
    }
  }

  return rows
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

function handleClearAll() {
  if (confirm(t('confirmClearAll'))) {
    connectionsStore.clearDataUsage()
  }
}

function handleRemoveEntry(sourceIP: string) {
  connectionsStore.removeDataUsageEntry(sourceIP)
}
</script>

<template>
  <div class="rounded-xl bg-base-300 p-4">
    <div class="flex flex-col gap-2">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-xl font-bold text-base-content">
            {{ t('dataUsage') }}
          </h2>
          <div class="group relative">
            <button
              class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-info hover:bg-info/20"
              :data-tip="t('dataUsageInfo')"
            >
              <IconInfoCircle :size="18" />
            </button>
            <div
              class="invisible absolute bottom-full left-1/2 z-50 max-w-48 -translate-x-1/2 rounded-lg bg-neutral p-2 text-xs whitespace-normal text-neutral-content opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 md:bottom-auto md:left-full md:max-w-64 md:translate-x-2 md:text-sm"
            >
              {{ t('dataUsageInfo') }}
            </div>
          </div>
          <input
            v-model="showTable"
            type="checkbox"
            class="toggle toggle-primary"
          />
        </div>
        <button
          v-if="showTable"
          class="flex cursor-pointer items-center gap-1 rounded-md border-none bg-error px-2 py-1 text-xs text-error-content transition-all duration-200 hover:brightness-110"
          @click="handleClearAll"
        >
          <IconTrash :size="16" />
          <span class="hidden sm:inline">{{ t('clearAll') }}</span>
        </button>
      </div>

      <template v-if="showTable">
        <!-- Total Stats -->
        <div
          v-if="totalStats.count > 0"
          class="mb-2 flex flex-col rounded-lg bg-base-200 shadow-sm sm:flex-row"
        >
          <div
            class="border-b border-base-content/10 px-4 py-2 last:border-r-0 sm:border-r sm:border-b-0"
          >
            <div class="text-xs text-base-content/60">{{ t('devices') }}</div>
            <div class="text-lg font-bold text-primary">
              {{ totalStats.count }}
            </div>
          </div>
          <div
            v-if="totalStats.firstSeen && totalStats.lastSeen"
            class="border-b border-base-content/10 px-4 py-2 sm:border-r sm:border-b-0"
          >
            <div class="text-xs text-base-content/60">{{ t('timeRange') }}</div>
            <div
              class="text-sm"
              :title="
                formatDateRange(
                  totalStats.firstSeen,
                  totalStats.lastSeen,
                  locale,
                )
              "
            >
              <div class="flex items-center gap-1">
                <IconClock :size="16" />
                <span>{{
                  formatDuration(totalStats.firstSeen, totalStats.lastSeen)
                }}</span>
              </div>
            </div>
          </div>
          <div
            class="border-b border-base-content/10 px-4 py-2 sm:border-r sm:border-b-0"
          >
            <div class="text-xs text-base-content/60">
              {{ t('uploadTotal') }}
            </div>
            <div class="text-lg font-bold">
              {{ formatBytes(totalStats.upload) }}
            </div>
          </div>
          <div
            class="border-b border-base-content/10 px-4 py-2 sm:border-r sm:border-b-0"
          >
            <div class="text-xs text-base-content/60">
              {{ t('downloadTotal') }}
            </div>
            <div class="text-lg font-bold">
              {{ formatBytes(totalStats.download) }}
            </div>
          </div>
          <div class="px-4 py-2">
            <div class="text-xs text-base-content/60">
              {{ t('grandTotal') }}
            </div>
            <div class="text-lg font-bold text-secondary">
              {{ formatBytes(totalStats.total) }}
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden overflow-x-auto rounded-md lg:block">
          <table class="table w-full table-zebra">
            <thead>
              <tr class="bg-base-200">
                <th class="text-base-content">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-inherit transition-colors duration-200 hover:text-primary"
                      @click="handleSort('ip')"
                    >
                      <span>{{ t('ipAddress') }}</span>
                      <IconArrowUp
                        v-if="sortField === 'ip' && sortOrder === 'asc'"
                        :size="14"
                      />
                      <IconArrowDown
                        v-else-if="sortField === 'ip' && sortOrder === 'desc'"
                        :size="14"
                      />
                    </button>
                    <button
                      v-if="groupingField !== 'ip'"
                      class="flex cursor-pointer items-center border-none bg-transparent text-inherit"
                      @click.stop="handleToggleGrouping('ip')"
                    >
                      <IconZoomInFilled :size="16" />
                    </button>
                    <button
                      v-else
                      class="flex cursor-pointer items-center border-none bg-transparent text-primary"
                      @click.stop="handleToggleGrouping('ip')"
                    >
                      <IconZoomOutFilled :size="16" />
                    </button>
                  </div>
                </th>
                <th class="text-base-content">
                  <button
                    class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-inherit transition-colors duration-200 hover:text-primary"
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
                <th class="text-base-content">
                  <button
                    class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-inherit transition-colors duration-200 hover:text-primary"
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
                <th class="text-base-content">
                  <button
                    class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-inherit transition-colors duration-200 hover:text-primary"
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
                <th class="text-base-content">
                  <button
                    class="flex cursor-pointer items-center gap-1 border-none bg-transparent text-inherit transition-colors duration-200 hover:text-primary"
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
                <th class="text-base-content">{{ t('actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sortedDataUsageEntries.length === 0">
                <td colspan="6" class="text-center text-base-content/70">
                  {{ t('noDataUsageYet') }}
                </td>
              </tr>
              <template v-else>
                <template
                  v-for="row in dataUsageEntries"
                  :key="
                    row.type === 'group'
                      ? `group-${row.key}`
                      : `data-${row.original.sourceIP}`
                  "
                >
                  <tr
                    v-if="row.type === 'group'"
                    class="cursor-pointer bg-base-200 hover:bg-base-300"
                    @click="handleToggleGroupExpanded(row.key)"
                  >
                    <td colspan="6" class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-primary"
                          >{{ t('ipAddress') }}: {{ row.key }}</span
                        >
                        <span class="text-xs text-base-content/60">
                          ({{ row.subRows.length }}
                          {{
                            row.subRows.length === 1
                              ? t('devices').slice(0, -1)
                              : t('devices')
                          }})
                        </span>
                        <span class="text-xs text-base-content/60">
                          {{ t('total') }}:
                          {{
                            formatBytes(
                              row.subRows.reduce((sum, e) => sum + e.total, 0),
                            )
                          }}
                        </span>
                        <IconArrowDown
                          v-if="expandedGroups[row.key]"
                          :size="14"
                          class="ml-auto"
                        />
                        <IconArrowUp v-else :size="14" class="ml-auto" />
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-else-if="row.type === 'data'"
                    class="hover:bg-base-200"
                    :style="{ paddingLeft: `${row.depth * 1}rem` }"
                  >
                    <td class="font-mono text-base-content">
                      {{ row.original.sourceIP }}
                    </td>
                    <td
                      class="text-base-content"
                      :title="
                        row.original.firstSeen
                          ? formatDateRange(
                              row.original.firstSeen,
                              row.original.lastSeen,
                              locale,
                            )
                          : '-'
                      "
                    >
                      <div class="flex items-center gap-1">
                        <IconClock :size="14" class="text-base-content/60" />
                        <span class="text-sm">
                          {{
                            row.original.firstSeen
                              ? formatDuration(
                                  row.original.firstSeen,
                                  row.original.lastSeen,
                                )
                              : '-'
                          }}
                        </span>
                      </div>
                    </td>
                    <td class="text-base-content">
                      {{ formatBytes(row.original.upload) }}
                    </td>
                    <td class="text-base-content">
                      {{ formatBytes(row.original.download) }}
                    </td>
                    <td class="font-bold text-primary">
                      {{ formatBytes(row.original.total) }}
                    </td>
                    <td>
                      <button
                        class="flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 text-error transition-colors duration-200 hover:bg-error/20"
                        :title="t('remove')"
                        @click.stop="handleRemoveEntry(row.original.sourceIP)"
                      >
                        <IconTrash :size="14" />
                      </button>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Mobile Card View -->
        <div class="flex flex-col gap-3 lg:hidden">
          <div
            v-if="sortedDataUsageEntries.length > 0"
            class="flex flex-col gap-2 rounded-lg bg-base-200 p-3"
          >
            <div class="flex items-center gap-2">
              <div class="text-xs font-semibold text-base-content/60">
                {{ t('sortBy') }}
              </div>
              <div class="flex flex-1 gap-2">
                <button
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    sortField === 'ip'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
                  "
                  @click="handleSort('ip')"
                >
                  {{ t('ipShort') }}
                  <IconArrowUp
                    v-if="sortField === 'ip' && sortOrder === 'asc'"
                    :size="12"
                  />
                  <IconArrowDown
                    v-else-if="sortField === 'ip' && sortOrder === 'desc'"
                    :size="12"
                  />
                </button>
                <button
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    sortField === 'duration'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
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
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    sortField === 'upload'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
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
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    sortField === 'download'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
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
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    sortField === 'total'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
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
            <div class="flex items-center gap-2">
              <div class="text-xs font-semibold text-base-content/60">
                {{ t('groupBy') }}
              </div>
              <div class="flex flex-1 gap-2">
                <button
                  class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-base-content/20 bg-transparent px-2 py-1 text-xs text-base-content transition-all duration-200 hover:bg-base-content/10"
                  :class="
                    groupingField === 'ip'
                      ? '!border-primary bg-primary text-primary-content'
                      : ''
                  "
                  @click="handleToggleGrouping('ip')"
                >
                  {{ t('ipShort') }}
                  <IconZoomOutFilled v-if="groupingField === 'ip'" :size="12" />
                  <IconZoomInFilled v-else :size="12" />
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="sortedDataUsageEntries.length === 0"
            class="rounded-lg bg-base-200 p-4 text-center text-base-content/70"
          >
            {{ t('noDataUsageYet') }}
          </div>

          <template
            v-for="row in dataUsageEntries"
            :key="
              row.type === 'group'
                ? `group-${row.key}`
                : `data-${row.original.sourceIP}`
            "
          >
            <div
              v-if="row.type === 'group'"
              class="cursor-pointer rounded-lg bg-primary/20 shadow-md"
              @click="handleToggleGroupExpanded(row.key)"
            >
              <div class="flex items-center justify-between p-4">
                <div>
                  <div class="font-semibold text-primary">
                    {{ t('ipAddress') }}: {{ row.key }}
                  </div>
                  <div class="text-xs text-base-content/60">
                    {{ row.subRows.length }}
                    {{
                      row.subRows.length === 1
                        ? t('devices').slice(0, -1)
                        : t('devices')
                    }}
                    · {{ t('total') }}:
                    {{
                      formatBytes(
                        row.subRows.reduce((sum, e) => sum + e.total, 0),
                      )
                    }}
                  </div>
                </div>
                <IconArrowDown v-if="expandedGroups[row.key]" :size="16" />
                <IconArrowUp v-else :size="16" />
              </div>
            </div>
            <div
              v-else-if="row.type === 'data'"
              class="rounded-lg bg-base-200 p-4 shadow-md"
              :style="{ marginLeft: `${row.depth * 1}rem` }"
            >
              <div class="mb-2 flex items-start justify-between">
                <div class="flex-1">
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('ipAddress') }}
                  </div>
                  <div class="font-mono text-sm font-bold text-base-content">
                    {{ row.original.sourceIP }}
                  </div>
                </div>
                <button
                  class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-error hover:bg-error/20"
                  :title="t('remove')"
                  @click.stop="handleRemoveEntry(row.original.sourceIP)"
                >
                  <IconTrash :size="16" />
                </button>
              </div>

              <div v-if="row.original.firstSeen" class="mb-2">
                <div
                  class="text-xs font-semibold text-base-content/60 uppercase"
                >
                  {{ t('timeRange') }}
                </div>
                <div class="flex items-center gap-1 text-sm text-base-content">
                  <IconClock :size="14" class="text-base-content/60" />
                  <span>{{
                    formatDuration(
                      row.original.firstSeen,
                      row.original.lastSeen,
                    )
                  }}</span>
                </div>
                <div class="text-xs text-base-content/60">
                  {{
                    formatDateRange(
                      row.original.firstSeen,
                      row.original.lastSeen,
                      locale,
                    )
                  }}
                </div>
              </div>

              <div class="my-2 h-px bg-base-content/15" />

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('upload') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(row.original.upload) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('download') }}
                  </div>
                  <div class="text-sm font-medium text-base-content">
                    {{ formatBytes(row.original.download) }}
                  </div>
                </div>
                <div>
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('total') }}
                  </div>
                  <div class="text-sm font-bold text-primary">
                    {{ formatBytes(row.original.total) }}
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
