<script setup lang="ts">
import type { VNode } from 'vue'
import type { LogWithSeq } from '~/types'
import {
  IconFileStack,
  IconPlayerPause,
  IconPlayerPlay,
  IconSearch,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-vue'
import { LOG_LEVEL } from '~/constants'

const { t } = useI18n()

useHead({ title: computed(() => t('logs')) })
const logsStore = useLogsStore()
const configStore = useConfigStore()

const globalFilter = ref('')
const settingsModal = ref<{ open: () => void; close: () => void }>()

// Extract type from payload, e.g. "[dns] xxx" -> "dns"
function extractType(payload: string): string {
  const match = payload.match(/^\[([^\]]+)\]/)
  return match?.[1] ?? ''
}

// Get level class for styling
function getLevelClass(type: LOG_LEVEL) {
  switch (type) {
    case LOG_LEVEL.Error:
      return 'text-error font-semibold'
    case LOG_LEVEL.Warning:
      return 'text-warning font-semibold'
    case LOG_LEVEL.Info:
      return 'text-info font-semibold'
    case LOG_LEVEL.Debug:
      return 'text-success font-semibold'
    default:
      return ''
  }
}

// Column definition interface
interface LogColumn {
  id: string
  label: string
  sortable: boolean
  groupable: boolean
  render: (log: LogWithSeq) => VNode | string
  sortValue?: (log: LogWithSeq) => unknown
  groupValue?: (log: LogWithSeq) => string
}

// Column definitions with render functions
const columns: LogColumn[] = [
  {
    id: 'seq',
    label: t('sequence'),
    sortable: true,
    groupable: false,
    render: (log) => String(log.seq),
    sortValue: (log) => log.seq,
  },
  {
    id: 'level',
    label: t('level'),
    sortable: true,
    groupable: true,
    render: (log) =>
      h('span', { class: getLevelClass(log.type) }, `[${log.type}]`),
    sortValue: (log) => log.type,
    groupValue: (log) => log.type,
  },
  {
    id: 'type',
    label: t('type'),
    sortable: true,
    groupable: true,
    render: (log) =>
      h('span', { class: 'text-base-content/60' }, extractType(log.payload)),
    sortValue: (log) => extractType(log.payload),
    groupValue: (log) => extractType(log.payload) || '(empty)',
  },
  {
    id: 'payload',
    label: t('payload'),
    sortable: false,
    groupable: false,
    render: (log) => log.payload,
  },
]

// Sort state
const sortColumn = useLocalStorage('logsTableSortColumn', 'seq')
const sortDesc = useLocalStorage('logsTableSortDesc', true)

// Grouping state
const groupingColumn = useLocalStorage<string | null>('logsTableGrouping', null)
const expandedGroups = ref<Record<string, boolean>>({})

// Filtered logs
const filteredLogs = computed(() => {
  if (!globalFilter.value) return logsStore.logs

  const filter = globalFilter.value.toLowerCase()
  return logsStore.logs.filter(
    (log) =>
      log.payload.toLowerCase().includes(filter) ||
      log.type.toLowerCase().includes(filter) ||
      extractType(log.payload).toLowerCase().includes(filter),
  )
})

// Sorted logs
const sortedLogs = computed(() => {
  const col = columns.find((c) => c.id === sortColumn.value)
  if (!col?.sortValue) return filteredLogs.value

  return [...filteredLogs.value].sort((a, b) => {
    const aVal = col.sortValue!(a)
    const bVal = col.sortValue!(b)

    let comparison = 0
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal
    } else if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal)
    }

    return sortDesc.value ? -comparison : comparison
  })
})

// Get current grouping column definition
const groupingColumnDef = computed(() =>
  groupingColumn.value
    ? columns.find((c) => c.id === groupingColumn.value)
    : null,
)

// Row types for unified row model (similar to TanStack Table)
interface GroupRow {
  type: 'group'
  key: string
  subRows: LogWithSeq[]
}

interface DataRow {
  type: 'data'
  original: LogWithSeq
}

type TableRow = GroupRow | DataRow

// Unified row model
const rowModel = computed<TableRow[]>(() => {
  const col = groupingColumnDef.value

  // No grouping - return data rows
  if (!col?.groupValue) {
    return sortedLogs.value.map((log) => ({
      type: 'data' as const,
      original: log,
    }))
  }

  // Build grouped rows
  const groups = new Map<string, LogWithSeq[]>()
  for (const log of sortedLogs.value) {
    const key = col.groupValue(log)
    const group = groups.get(key)
    if (group) {
      group.push(log)
    } else {
      groups.set(key, [log])
    }
  }

  // Flatten into row model with group headers and expanded data rows
  const rows: TableRow[] = []
  for (const [key, subRows] of groups) {
    rows.push({ type: 'group', key, subRows })

    if (expandedGroups.value[key]) {
      for (const log of subRows) {
        rows.push({ type: 'data', original: log })
      }
    }
  }

  return rows
})

// Sorting
function isSortableColumn(colId: string) {
  return columns.find((c) => c.id === colId)?.sortable ?? false
}

function isColumnSorted(colId: string) {
  return sortColumn.value === colId
}

function handleSort(colId: string) {
  const col = columns.find((c) => c.id === colId)
  if (!col?.sortable) return

  if (sortColumn.value === colId) {
    if (sortDesc.value) {
      sortDesc.value = false
    } else {
      sortColumn.value = ''
      sortDesc.value = true
    }
  } else {
    sortColumn.value = colId
    sortDesc.value = true
  }
}

// Grouping
function toggleGrouping(colId: string) {
  if (groupingColumn.value === colId) {
    groupingColumn.value = null
  } else {
    groupingColumn.value = colId
  }
  expandedGroups.value = {}
}

function toggleGroupExpanded(key: string) {
  expandedGroups.value[key] = !expandedGroups.value[key]
}

// Table size class
const tableSizeClass = computed(() =>
  configStore.tableSizeClassName(configStore.logsTableSize),
)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <!-- Toolbar -->
    <div class="flex shrink-0 items-center gap-3">
      <div class="relative flex-1">
        <IconSearch
          class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base-content/40"
          :size="18"
        />
        <input
          v-model="globalFilter"
          type="search"
          class="w-full rounded-lg border border-base-content/10 bg-base-200/60 py-2.5 pr-3.5 pl-10 text-sm text-base-content transition-all duration-200 placeholder:text-base-content/40 focus:border-primary focus:bg-base-100 focus:ring-3 focus:ring-primary/15 focus:outline-none"
          :placeholder="t('search')"
        />
      </div>

      <div class="flex gap-2">
        <button
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-base-content/10 bg-base-200/60 text-base-content transition-all duration-200 hover:border-base-content/20 hover:bg-base-300"
          :class="{
            'border-warning/30 bg-warning/15 text-warning': logsStore.paused,
          }"
          @click="logsStore.togglePaused()"
        >
          <IconPlayerPause v-if="!logsStore.paused" :size="18" />
          <IconPlayerPlay v-else :size="18" />
        </button>

        <button
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-base-content/10 bg-base-200/60 text-base-content transition-all duration-200 hover:border-base-content/20 hover:bg-base-300"
          @click="settingsModal?.open()"
        >
          <IconSettings :size="18" />
        </button>
      </div>
    </div>

    <!-- Logs Table -->
    <div
      class="min-h-0 flex-1 overflow-auto rounded-xl border border-base-content/10 bg-base-200/50"
    >
      <table
        class="table w-full border-collapse whitespace-nowrap"
        :class="tableSizeClass"
      >
        <thead>
          <tr class="sticky top-0 z-10 bg-base-200">
            <th
              v-for="col in columns"
              :key="col.id"
              class="border-b border-base-content/10 text-left font-semibold text-base-content"
            >
              <div class="flex items-center gap-2">
                <div
                  class="flex-1"
                  :class="{
                    'cursor-pointer select-none hover:text-primary':
                      isSortableColumn(col.id),
                  }"
                  @click="handleSort(col.id)"
                >
                  {{ col.label }}
                </div>
                <IconSortAscending
                  v-if="isColumnSorted(col.id) && !sortDesc"
                  class="text-primary"
                  :size="16"
                />
                <IconSortDescending
                  v-else-if="isColumnSorted(col.id) && sortDesc"
                  class="text-primary"
                  :size="16"
                />
                <!-- Grouping button -->
                <button
                  v-if="col.groupable"
                  class="flex cursor-pointer items-center justify-center border-none bg-transparent p-1 text-base-content/60 transition-colors duration-200 hover:text-primary"
                  @click.stop="toggleGrouping(col.id)"
                >
                  <IconZoomOutFilled
                    v-if="groupingColumn === col.id"
                    :size="16"
                  />
                  <IconZoomInFilled v-else :size="16" />
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(row, index) in rowModel"
            :key="row.type === 'group' ? `group-${row.key}` : row.original.seq"
          >
            <!-- Group header row -->
            <tr
              v-if="row.type === 'group'"
              class="cursor-pointer bg-primary/5 hover:bg-primary/10"
              @click="toggleGroupExpanded(row.key)"
            >
              <td
                :colspan="columns.length"
                class="border-b border-base-content/10"
              >
                <div class="flex items-center gap-2 text-primary">
                  <IconZoomOutFilled
                    v-if="expandedGroups[row.key]"
                    :size="16"
                  />
                  <IconZoomInFilled v-else :size="16" />
                  <span class="font-semibold">{{ row.key }}</span>
                  <span class="text-xs text-base-content/60"
                    >({{ row.subRows.length }})</span
                  >
                </div>
              </td>
            </tr>
            <!-- Data row -->
            <tr
              v-else
              class="animate-fade-in transition-colors duration-150 hover:bg-base-content/5"
              :style="{ animationDelay: `${(index % 20) * 15}ms` }"
            >
              <td
                v-for="col in columns"
                :key="col.id"
                class="border-b border-base-content/5"
              >
                <component :is="() => col.render(row.original)" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div
        v-if="rowModel.length === 0"
        class="flex flex-col items-center justify-center gap-4 px-4 py-12 text-base-content/40"
      >
        <IconFileStack :size="48" class="opacity-50" />
        <span>{{ t('noData') }}</span>
      </div>
    </div>

    <!-- Settings Modal -->
    <Modal ref="settingsModal" :title="t('logsSettings')">
      <template #icon>
        <IconFileStack :size="24" />
      </template>

      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-base-content/70">{{
            t('tableSize')
          }}</label>
          <select
            v-model="configStore.logsTableSize"
            class="w-full cursor-pointer rounded-lg border border-base-content/10 bg-base-100 px-3.5 py-2.5 text-sm text-base-content transition-colors duration-200 focus:border-primary focus:outline-none"
          >
            <option value="xs">{{ t('xs') }}</option>
            <option value="sm">{{ t('sm') }}</option>
            <option value="md">{{ t('md') }}</option>
            <option value="lg">{{ t('lg') }}</option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-base-content/70">{{
            t('logLevel')
          }}</label>
          <select
            v-model="configStore.logLevel"
            class="w-full cursor-pointer rounded-lg border border-base-content/10 bg-base-100 px-3.5 py-2.5 text-sm text-base-content transition-colors duration-200 focus:border-primary focus:outline-none"
          >
            <option value="info">{{ t('info') }}</option>
            <option value="error">{{ t('error') }}</option>
            <option value="warning">{{ t('warning') }}</option>
            <option value="debug">{{ t('debug') }}</option>
            <option value="silent">{{ t('silent') }}</option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-base-content/70">{{
            t('logMaxRows')
          }}</label>
          <select
            v-model="configStore.logMaxRows"
            class="w-full cursor-pointer rounded-lg border border-base-content/10 bg-base-100 px-3.5 py-2.5 text-sm text-base-content transition-colors duration-200 focus:border-primary focus:outline-none"
          >
            <option :value="200">200</option>
            <option :value="300">300</option>
            <option :value="500">500</option>
            <option :value="800">800</option>
            <option :value="1000">1000</option>
          </select>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out backwards;
}
</style>
