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
  <div class="conn-table-container min-h-0 flex-1 rounded-xl">
    <table class="table w-full border-collapse" :class="tableSizeClass">
      <!-- Desktop header - hidden on mobile -->
      <thead class="hidden md:table-header-group">
        <tr class="sticky top-0 z-10 bg-base-200">
          <th
            v-for="col in columns"
            :key="col.id"
            class="conn-th text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
          >
            <div class="flex items-center gap-1.5">
              <div
                class="flex-1"
                :class="{
                  'cursor-pointer transition-colors duration-200 select-none hover:text-primary':
                    isSortableColumn(col),
                }"
                @click="emit('headerClick', col.id)"
              >
                {{ t(col.key) }}
              </div>
              <IconSortAscending
                v-if="isColumnSorted(col, sortColumn) && !sortDesc"
                class="text-primary"
                :size="14"
              />
              <IconSortDescending
                v-else-if="isColumnSorted(col, sortColumn) && sortDesc"
                class="text-primary"
                :size="14"
              />
              <!-- Grouping button -->
              <button
                v-if="col.groupable"
                class="conn-group-btn flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-1 transition-all duration-200"
                @click.stop="emit('toggleGrouping', col.id)"
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
          :key="row.type === 'group' ? `group-${row.key}` : row.original.id"
        >
          <!-- Group header row -->
          <tr
            v-if="row.type === 'group'"
            class="conn-group-row cursor-pointer transition-colors duration-200"
            @click="emit('toggleGroupExpanded', row.key)"
          >
            <td :colspan="columns.length" class="conn-group-cell px-3.5 py-2.5">
              <div class="flex items-center gap-2">
                <div
                  class="conn-group-icon flex h-6 w-6 items-center justify-center rounded-md"
                >
                  <IconZoomOutFilled
                    v-if="expandedGroups[row.key]"
                    :size="16"
                  />
                  <IconZoomInFilled v-else :size="16" />
                </div>
                <span class="font-semibold text-primary">{{ row.key }}</span>
                <span class="conn-group-count text-xs"
                  >({{ row.subRows.length }})</span
                >
              </div>
            </td>
          </tr>
          <!-- Data row - card style on mobile, table row on desktop -->
          <tr
            v-else
            class="conn-data-row cursor-pointer transition-all duration-200"
            :style="{ animationDelay: `${(index % 20) * 15}ms` }"
            @click="emit('rowClick', row.original)"
          >
            <td
              v-for="col in columns"
              :key="col.id"
              class="conn-td break-words"
            >
              <!-- Mobile label -->
              <span
                class="conn-td-label mb-0.5 block text-[0.6875rem] tracking-wide uppercase md:hidden"
              >
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
      class="conn-empty flex items-center justify-center px-4 py-12 text-sm"
    >
      <span>{{ t('noData') }}</span>
    </div>
  </div>
</template>

<style scoped>
/* CSS variables and color-mix utilities that can't be done with Tailwind */
.conn-table-container {
  --conn-border: color-mix(
    in oklch,
    var(--color-base-content) 10%,
    transparent
  );
  background: color-mix(in oklch, var(--color-base-200) 50%, transparent);
}

.conn-th {
  color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
  border-bottom: 1px solid var(--conn-border);
}

.conn-group-btn {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

.conn-group-btn:hover {
  color: var(--color-primary);
  background: color-mix(in oklch, var(--color-primary) 10%, transparent);
}

.conn-group-row {
  background: color-mix(in oklch, var(--color-primary) 5%, transparent);
}

.conn-group-row:hover {
  background: color-mix(in oklch, var(--color-primary) 10%, transparent);
}

.conn-group-cell {
  border-bottom: 1px solid var(--conn-border);
}

.conn-group-icon {
  background: color-mix(in oklch, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.conn-group-count {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

/* Data row - responsive card to table */
.conn-data-row {
  display: flex;
  flex-wrap: wrap;
  padding: 0.5rem;
  margin: 0.25rem;
  border-radius: 0.5rem;
  background: var(--color-base-100);
  animation: fadeIn 0.3s ease-out backwards;
}

.conn-data-row:hover {
  background: color-mix(in oklch, var(--color-base-content) 5%, transparent);
  box-shadow: 0 2px 8px
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
}

@media (min-width: 768px) {
  .conn-data-row {
    display: table-row;
    margin: 0;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .conn-data-row:nth-child(even) {
    background: color-mix(in oklch, var(--color-base-content) 2%, transparent);
  }

  .conn-data-row:hover {
    background: color-mix(in oklch, var(--color-base-content) 5%, transparent);
    box-shadow: none;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Table cells - responsive layout */
.conn-td {
  width: 50%;
  min-width: 50%;
}

.conn-td:nth-child(2n) {
  text-align: right;
}

@media (min-width: 640px) {
  .conn-td {
    width: 33.33%;
    min-width: 33.33%;
  }

  .conn-td:nth-child(2n) {
    text-align: left;
  }

  .conn-td:nth-child(3n) {
    text-align: right;
  }
}

@media (min-width: 768px) {
  .conn-td {
    width: auto;
    min-width: 0;
    text-align: left !important;
    vertical-align: middle;
    white-space: nowrap;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-base-content) 5%, transparent);
  }
}

.conn-td-label {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

.conn-empty {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}
</style>
