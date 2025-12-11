<script setup lang="ts">
import type { VNode } from 'vue'
import type { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import type { Connection } from '~/types'
import {
  IconSortAscending,
  IconSortDescending,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-vue'

// Column definition interface
export interface ConnectionColumn {
  id: CONNECTIONS_TABLE_ACCESSOR_KEY
  key: string
  groupable: boolean
  sortable: boolean
  sortId?: string
  render: (conn: Connection) => VNode | string
  groupValue?: (conn: Connection) => string
}

// Row types for unified row model
export interface GroupRow {
  type: 'group'
  key: string
  depth: number
  subRows: Connection[]
}

export interface DataRow {
  type: 'data'
  original: Connection
  depth: number
}

export type TableRow = GroupRow | DataRow

defineProps<{
  columns: ConnectionColumn[]
  rowModel: TableRow[]
  sortColumn: string
  sortDesc: boolean
  groupingColumn: string | null
  expandedGroups: Record<string, boolean>
  tableSizeClass: string
}>()

const emit = defineEmits<{
  headerClick: [colId: CONNECTIONS_TABLE_ACCESSOR_KEY]
  toggleGrouping: [colId: CONNECTIONS_TABLE_ACCESSOR_KEY]
  toggleGroupExpanded: [key: string]
  rowClick: [conn: Connection]
}>()

const { t } = useI18n()

function isSortableColumn(
  col: ConnectionColumn,
): col is ConnectionColumn & { sortId: string } {
  return col.sortable && !!col.sortId
}

function isColumnSorted(col: ConnectionColumn, sortColumn: string) {
  return col.sortId ? sortColumn === col.sortId : false
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto rounded-md bg-base-300">
    <table class="table-pin-rows table table-zebra" :class="tableSizeClass">
      <!-- Desktop header - hidden on mobile -->
      <thead class="hidden md:table-header-group">
        <tr>
          <th v-for="col in columns" :key="col.id" class="bg-base-200">
            <div class="flex items-center gap-2">
              <div
                class="flex-1"
                :class="{
                  'cursor-pointer select-none': isSortableColumn(col),
                }"
                @click="emit('headerClick', col.id)"
              >
                {{ t(col.key) }}
              </div>
              <IconSortAscending
                v-if="isColumnSorted(col, sortColumn) && !sortDesc"
                :size="16"
              />
              <IconSortDescending
                v-else-if="isColumnSorted(col, sortColumn) && sortDesc"
                :size="16"
              />
              <!-- Grouping button -->
              <button
                v-if="col.groupable"
                class="cursor-pointer"
                @click.stop="emit('toggleGrouping', col.id)"
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
          :key="row.type === 'group' ? `group-${row.key}` : row.original.id"
        >
          <!-- Group header row -->
          <tr
            v-if="row.type === 'group'"
            class="cursor-pointer bg-base-200"
            @click="emit('toggleGroupExpanded', row.key)"
          >
            <td :colspan="columns.length">
              <div class="flex items-center gap-2">
                <IconZoomOutFilled v-if="expandedGroups[row.key]" :size="18" />
                <IconZoomInFilled v-else :size="18" />
                <span>{{ row.key }}</span>
                <span class="text-base-content/60"
                  >({{ row.subRows.length }})</span
                >
              </div>
            </td>
          </tr>
          <!-- Data row - card style on mobile, table row on desktop -->
          <tr
            v-else
            class="flex cursor-pointer flex-wrap rounded-xl border-4 border-base-300 px-2 odd:bg-base-100 even:bg-base-200 md:table-row md:rounded-none md:border-0 md:px-0 md:hover:bg-base-200"
            @click="emit('rowClick', row.original)"
          >
            <td
              v-for="col in columns"
              :key="col.id"
              class="nth-2n:text-right sm:nth-2n:text-left sm:nth-3n:text-right md:nth-2n:text-start md:nth-3n:text-start w-1/2 min-w-1/2 pb-1.5 text-justify align-top wrap-break-word nth-last-2:mb-3 sm:w-1/3 sm:min-w-1/3 md:w-auto md:min-w-0 md:text-start md:align-middle md:whitespace-nowrap md:nth-last-2:mb-0"
            >
              <!-- Mobile label -->
              <span class="block text-xs text-base-content/60 md:hidden">
                {{ t(col.key) }}
              </span>
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
</template>
