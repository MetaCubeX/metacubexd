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
const configStore = useConfigStore()

type SortField = 'ip' | 'duration' | 'upload' | 'download' | 'total'
type SortOrder = 'asc' | 'desc'
type GroupField = 'ip' | 'mac' | null

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
    let key: string
    if (groupingField.value === 'ip') {
      key = entry.sourceIP
    } else if (groupingField.value === 'mac') {
      key = entry.macAddress || t('na')
    } else {
      key = entry.sourceIP
    }

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
  <div class="rounded-box bg-base-300 p-4">
    <div class="mb-4 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold text-base-content">
            {{ t('dataUsage') }}
          </h2>
          <div
            class="tooltip tooltip-top before:ml-4 before:max-w-xs before:rounded-lg before:p-2 before:text-xs before:content-[attr(data-tip)] md:tooltip-right md:before:ml-0 md:before:text-sm lg:before:text-base"
            :data-tip="t('dataUsageInfo')"
          >
            <button class="btn btn-circle text-info btn-ghost btn-xs">
              <IconInfoCircle :size="18" />
            </button>
          </div>
          <input
            v-model="showTable"
            type="checkbox"
            class="toggle toggle-primary"
          />
        </div>
        <button
          v-if="showTable"
          class="btn btn-sm btn-error"
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
          class="stats stats-vertical bg-base-200 shadow sm:stats-horizontal"
        >
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('devices') }}
            </div>
            <div class="stat-value text-lg text-primary">
              {{ totalStats.count }}
            </div>
          </div>
          <div
            v-if="totalStats.firstSeen && totalStats.lastSeen"
            class="stat py-2"
          >
            <div class="stat-title text-xs">
              {{ t('timeRange') }}
            </div>
            <div
              class="stat-value text-sm"
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
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('uploadTotal') }}
            </div>
            <div class="stat-value text-lg">
              {{ formatBytes(totalStats.upload) }}
            </div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('downloadTotal') }}
            </div>
            <div class="stat-value text-lg">
              {{ formatBytes(totalStats.download) }}
            </div>
          </div>
          <div class="stat py-2">
            <div class="stat-title text-xs">
              {{ t('grandTotal') }}
            </div>
            <div class="stat-value text-lg text-secondary">
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
                    <span>{{ t('macAddress') }}</span>
                    <button
                      v-if="groupingField !== 'mac'"
                      class="cursor-pointer"
                      @click="handleToggleGrouping('mac')"
                    >
                      <IconZoomInFilled :size="16" />
                    </button>
                    <button
                      v-else
                      class="cursor-pointer text-primary"
                      @click="handleToggleGrouping('mac')"
                    >
                      <IconZoomOutFilled :size="16" />
                    </button>
                  </div>
                </th>
                <th class="text-base-content">
                  <div class="flex items-center gap-2">
                    <button
                      class="flex items-center gap-1 hover:text-primary"
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
                      class="cursor-pointer"
                      @click.stop="handleToggleGrouping('ip')"
                    >
                      <IconZoomInFilled :size="16" />
                    </button>
                    <button
                      v-else
                      class="cursor-pointer text-primary"
                      @click.stop="handleToggleGrouping('ip')"
                    >
                      <IconZoomOutFilled :size="16" />
                    </button>
                  </div>
                </th>
                <th class="text-base-content">
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
                <th class="text-base-content">
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
                <th class="text-base-content">
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
                <th class="text-base-content">
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
                <th class="text-base-content">
                  {{ t('actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sortedDataUsageEntries.length === 0">
                <td colspan="7" class="text-center text-base-content/70">
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
                  <!-- Group header row -->
                  <tr
                    v-if="row.type === 'group'"
                    class="cursor-pointer bg-base-200 hover:bg-base-300"
                    @click="handleToggleGroupExpanded(row.key)"
                  >
                    <td colspan="7" class="py-2">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-primary">
                          {{
                            groupingField === 'ip'
                              ? t('ipAddress')
                              : t('macAddress')
                          }}:
                          {{ row.key }}
                        </span>
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
                  <!-- Data row -->
                  <tr
                    v-else-if="row.type === 'data'"
                    class="hover"
                    :style="{ paddingLeft: `${row.depth * 1}rem` }"
                  >
                    <td class="text-base-content">
                      {{ row.original.macAddress || t('na') }}
                    </td>
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
                        class="btn text-error btn-ghost btn-xs hover:bg-error/20"
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
          <!-- Mobile Sort and Group Buttons -->
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
                  class="btn flex-1 btn-xs"
                  :class="sortField === 'ip' ? 'btn-primary' : 'btn-ghost'"
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
                  class="btn flex-1 btn-xs"
                  :class="
                    sortField === 'duration' ? 'btn-primary' : 'btn-ghost'
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
                  class="btn flex-1 btn-xs"
                  :class="sortField === 'upload' ? 'btn-primary' : 'btn-ghost'"
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
                  class="btn flex-1 btn-xs"
                  :class="
                    sortField === 'download' ? 'btn-primary' : 'btn-ghost'
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
                  class="btn flex-1 btn-xs"
                  :class="sortField === 'total' ? 'btn-primary' : 'btn-ghost'"
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
                  class="btn flex-1 btn-xs"
                  :class="groupingField === 'ip' ? 'btn-primary' : 'btn-ghost'"
                  @click="handleToggleGrouping('ip')"
                >
                  {{ t('ipShort') }}
                  <IconZoomOutFilled v-if="groupingField === 'ip'" :size="12" />
                  <IconZoomInFilled v-else :size="12" />
                </button>
                <button
                  class="btn flex-1 btn-xs"
                  :class="groupingField === 'mac' ? 'btn-primary' : 'btn-ghost'"
                  @click="handleToggleGrouping('mac')"
                >
                  MAC
                  <IconZoomOutFilled
                    v-if="groupingField === 'mac'"
                    :size="12"
                  />
                  <IconZoomInFilled v-else :size="12" />
                </button>
              </div>
            </div>
          </div>

          <!-- No data -->
          <div
            v-if="sortedDataUsageEntries.length === 0"
            class="rounded-lg bg-base-200 p-4 text-center text-base-content/70"
          >
            {{ t('noDataUsageYet') }}
          </div>

          <!-- Mobile Cards -->
          <template
            v-for="row in dataUsageEntries"
            :key="
              row.type === 'group'
                ? `group-${row.key}`
                : `data-${row.original.sourceIP}`
            "
          >
            <!-- Group header card -->
            <div
              v-if="row.type === 'group'"
              class="card cursor-pointer bg-primary/20 shadow-md"
              @click="handleToggleGroupExpanded(row.key)"
            >
              <div class="card-body p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="font-semibold text-primary">
                      {{
                        groupingField === 'ip'
                          ? t('ipAddress')
                          : t('macAddress')
                      }}:
                      {{ row.key }}
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
            </div>
            <!-- Data card -->
            <div
              v-else-if="row.type === 'data'"
              class="card bg-base-200 shadow-md"
              :style="{ marginLeft: `${row.depth * 1}rem` }"
            >
              <div class="card-body p-4">
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
                    class="btn btn-circle text-error btn-ghost btn-xs"
                    :title="t('remove')"
                    @click.stop="handleRemoveEntry(row.original.sourceIP)"
                  >
                    <IconTrash :size="16" />
                  </button>
                </div>

                <div v-if="row.original.macAddress" class="mb-2">
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('macAddress') }}
                  </div>
                  <div class="text-sm text-base-content">
                    {{ row.original.macAddress }}
                  </div>
                </div>

                <div v-if="row.original.firstSeen" class="mb-2">
                  <div
                    class="text-xs font-semibold text-base-content/60 uppercase"
                  >
                    {{ t('timeRange') }}
                  </div>
                  <div
                    class="flex items-center gap-1 text-sm text-base-content"
                  >
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

                <div class="divider my-2" />

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
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
