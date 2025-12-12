<script setup lang="ts">
import type { VNode } from 'vue'
import type { LogWithSeq } from '~/types'
import {
  IconFileStack,
  IconPlayerPause,
  IconPlayerPlay,
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
      return 'text-error'
    case LOG_LEVEL.Warning:
      return 'text-warning'
    case LOG_LEVEL.Info:
      return 'text-info'
    case LOG_LEVEL.Debug:
      return 'text-success'
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
      h('span', { class: 'opacity-70' }, extractType(log.payload)),
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
  <div class="flex h-full flex-col gap-2">
    <!-- Toolbar -->
    <div class="join w-full">
      <input
        v-model="globalFilter"
        type="search"
        class="input input-sm join-item flex-1 shrink-0 input-primary"
        :placeholder="t('search')"
      />

      <Button
        class="btn join-item btn-sm btn-primary"
        @click="logsStore.togglePaused()"
      >
        <IconPlayerPause v-if="!logsStore.paused" />
        <IconPlayerPlay v-else />
      </Button>

      <Button
        class="btn join-item btn-sm btn-primary"
        @click="settingsModal?.open()"
      >
        <IconSettings />
      </Button>
    </div>

    <!-- Logs Table -->
    <div
      class="flex-1 overflow-x-auto rounded-md bg-base-300 whitespace-nowrap"
    >
      <table class="table-pin-rows table table-zebra" :class="tableSizeClass">
        <thead>
          <tr class="bg-base-200">
            <th v-for="col in columns" :key="col.id" class="text-base-content">
              <div class="flex items-center gap-2">
                <div
                  class="flex-1"
                  :class="{
                    'cursor-pointer select-none': isSortableColumn(col.id),
                  }"
                  @click="handleSort(col.id)"
                >
                  {{ col.label }}
                </div>
                <IconSortAscending
                  v-if="isColumnSorted(col.id) && !sortDesc"
                  :size="16"
                />
                <IconSortDescending
                  v-else-if="isColumnSorted(col.id) && sortDesc"
                  :size="16"
                />
                <!-- Grouping button -->
                <button
                  v-if="col.groupable"
                  class="cursor-pointer"
                  @click.stop="toggleGrouping(col.id)"
                >
                  <IconZoomOutFilled
                    v-if="groupingColumn === col.id"
                    :size="18"
                  />
                  <IconZoomInFilled v-else :size="18" />
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="row in rowModel"
            :key="row.type === 'group' ? `group-${row.key}` : row.original.seq"
          >
            <!-- Group header row -->
            <tr
              v-if="row.type === 'group'"
              class="cursor-pointer bg-base-200 hover:bg-base-300"
              @click="toggleGroupExpanded(row.key)"
            >
              <td :colspan="columns.length" class="py-2">
                <div class="flex items-center gap-2">
                  <IconZoomOutFilled
                    v-if="expandedGroups[row.key]"
                    :size="18"
                  />
                  <IconZoomInFilled v-else :size="18" />
                  <span class="font-semibold text-primary">{{ row.key }}</span>
                  <span class="text-xs text-base-content/60"
                    >({{ row.subRows.length }})</span
                  >
                </div>
              </td>
            </tr>
            <!-- Data row -->
            <tr v-else class="hover">
              <td
                v-for="col in columns"
                :key="col.id"
                class="whitespace-nowrap"
              >
                <component :is="() => col.render(row.original)" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div
        v-if="rowModel.length === 0"
        class="py-8 text-center text-base-content/70"
      >
        {{ t('noData') }}
      </div>
    </div>

    <!-- Settings Modal -->
    <Modal ref="settingsModal" :title="t('logsSettings')">
      <template #icon>
        <IconFileStack :size="24" />
      </template>

      <div class="flex flex-col gap-4">
        <div>
          <ConfigTitle with-divider>{{ t('tableSize') }}</ConfigTitle>
          <select v-model="configStore.logsTableSize" class="select w-full">
            <option value="xs">{{ t('xs') }}</option>
            <option value="sm">{{ t('sm') }}</option>
            <option value="md">{{ t('md') }}</option>
            <option value="lg">{{ t('lg') }}</option>
          </select>
        </div>

        <div>
          <ConfigTitle with-divider>{{ t('logLevel') }}</ConfigTitle>
          <select v-model="configStore.logLevel" class="select w-full">
            <option value="info">{{ t('info') }}</option>
            <option value="error">{{ t('error') }}</option>
            <option value="warning">{{ t('warning') }}</option>
            <option value="debug">{{ t('debug') }}</option>
            <option value="silent">{{ t('silent') }}</option>
          </select>
        </div>

        <div>
          <ConfigTitle with-divider>{{ t('logMaxRows') }}</ConfigTitle>
          <select v-model="configStore.logMaxRows" class="select w-full">
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
