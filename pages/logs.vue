<script setup lang="ts">
import type { DataTableColumn } from '~/components/DataTable.vue'
import type { LogWithSeq } from '~/types'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
} from '@tabler/icons-vue'
import { LOG_LEVEL } from '~/constants'

useHead({ title: 'Logs' })

const { t } = useI18n()
const logsStore = useLogsStore()
const configStore = useConfigStore()

const globalFilter = ref('')
const settingsModal = ref<{ open: () => void; close: () => void }>()

// Extract type from payload, e.g. "[dns] xxx" -> "dns"
function extractType(payload: string) {
  const match = payload.match(/^\[([^\]]+)\]/)
  return match ? match[1] : ''
}

// Column definitions
const columns: DataTableColumn<LogWithSeq>[] = [
  {
    id: 'seq',
    label: t('sequence'),
    accessor: 'seq',
    sortable: true,
    groupable: false,
  },
  {
    id: 'level',
    label: t('level'),
    accessor: 'type',
    sortable: true,
    groupable: true,
  },
  {
    id: 'type',
    label: t('type'),
    accessor: (row) => extractType(row.payload),
    sortable: true,
    groupable: true,
  },
  {
    id: 'payload',
    label: t('payload'),
    accessor: 'payload',
    sortable: false,
    groupable: false,
  },
]

// Use data table composable
const { sortState, groupState, handleSort, handleGroup, sortRows, groupRows } =
  useDataTable({
    columns,
    sortingKey: 'logsTableSorting',
    groupingKey: 'logsTableGrouping',
    defaultSort: { column: 'seq', desc: true },
  })

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

// Custom sort value getter for logs
function getSortValue(row: LogWithSeq, columnId: string): unknown {
  switch (columnId) {
    case 'seq':
      return row.seq
    case 'level':
      return row.type
    case 'type':
      return extractType(row.payload)
    default:
      return ''
  }
}

// Custom group value getter for logs
function getGroupValue(row: LogWithSeq, columnId: string): string {
  switch (columnId) {
    case 'level':
      return row.type
    case 'type':
      return extractType(row.payload) || '(empty)'
    default:
      return ''
  }
}

// Processed rows (sorted)
const sortedRows = computed(() => sortRows(filteredLogs.value, getSortValue))

// Grouped rows (if grouping is active)
const groupedRows = computed(() => {
  if (!groupState.value.length) return undefined
  return groupRows(sortedRows.value, getGroupValue)
})

// Final rows to display (non-grouped)
const processedRows = computed(() => sortedRows.value)

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
      <DataTable
        :columns="columns"
        :rows="processedRows"
        :sort-state="sortState"
        :group-state="groupState"
        :grouped-rows="groupedRows"
        :size="configStore.logsTableSize"
        row-key="seq"
        sticky-header
        row-hover
        cell-class="py-2"
        @sort="handleSort"
        @group="handleGroup"
      >
        <template #cell-level="{ row }">
          <span :class="getLevelClass(row.type)"> [{{ row.type }}] </span>
        </template>
        <template #cell-type="{ row }">
          <span class="opacity-70">{{ extractType(row.payload) }}</span>
        </template>
      </DataTable>

      <div
        v-if="processedRows.length === 0"
        class="py-8 text-center text-base-content/70"
      >
        {{ t('noData') }}
      </div>
    </div>

    <!-- Settings Modal -->
    <Modal ref="settingsModal" :title="t('logsSettings')">
      <div class="space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t('tableSize') }}</span>
          </label>
          <select
            v-model="configStore.logsTableSize"
            class="select-bordered select"
          >
            <option value="xs">
              {{ t('xs') }}
            </option>
            <option value="sm">
              {{ t('sm') }}
            </option>
            <option value="md">
              {{ t('md') }}
            </option>
            <option value="lg">
              {{ t('lg') }}
            </option>
          </select>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t('logLevel') }}</span>
          </label>
          <select v-model="configStore.logLevel" class="select-bordered select">
            <option value="debug">
              {{ t('debug') }}
            </option>
            <option value="info">
              {{ t('info') }}
            </option>
            <option value="warning">
              {{ t('warning') }}
            </option>
            <option value="error">
              {{ t('error') }}
            </option>
            <option value="silent">
              {{ t('silent') }}
            </option>
          </select>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">{{ t('logMaxRows') }}</span>
          </label>
          <select
            v-model="configStore.logMaxRows"
            class="select-bordered select"
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
