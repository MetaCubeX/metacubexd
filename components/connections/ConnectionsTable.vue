<script setup lang="ts">
import type { FunctionalComponent, VNode } from 'vue'
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
  /**
   * Returns a plain-text representation of the column value for the
   * card mode aux line (single-line ` · `-separated string).
   * REQUIRED for columns whose `render` returns a VNode (toString
   * yields `[object Object]`). Optional for columns whose `render`
   * already returns a string — the card layer will fall back to
   * `String(render(conn))` for those.
   */
  renderText?: (conn: Connection) => string
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

const props = defineProps<{
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

// Render a cell's VNode through a component with a STABLE identity. Passing an
// inline `() => render(...)` straight to `<component :is>` produced a brand new
// component type on every render, so Vue unmounted + remounted every cell on
// each (high-frequency, WebSocket-driven) connections update instead of
// patching it in place. A constant wrapper keeps the vnode type stable; the
// changing `render` prop just triggers a patch. Fallthrough `class` is applied
// to the rendered root as before.
const CellRenderer: FunctionalComponent<{
  render: () => VNode | string | null
}> = (props) => props.render() as VNode
CellRenderer.props = ['render']

const { t } = useI18n()
const configStore = useConfigStore()

function isSortableColumn(
  col: ConnectionColumn,
): col is ConnectionColumn & { sortId: string } {
  return col.sortable && !!col.sortId
}

function isColumnSorted(col: ConnectionColumn, sortColumn: string) {
  return col.sortId ? sortColumn === col.sortId : false
}

const displayMode = computed(() => configStore.connectionsDisplayMode)

const isCardMode = computed(() => displayMode.value === 'card')
const isForceTable = computed(() => displayMode.value === 'table')

// Columns rendered in the card main row (host / process / action).
// The remaining visible columns are concatenated into the aux line.
const MAIN_ROW_COLUMN_IDS = new Set(['close', 'host', 'process', 'hostProcess'])

function getCardText(col: ConnectionColumn, conn: Connection): string {
  if (col.renderText) return col.renderText(conn)
  const result = col.render(conn)
  return typeof result === 'string' ? result : ''
}

function buildAuxLine(conn: Connection, cols: ConnectionColumn[]): string {
  return cols
    .filter((col) => !MAIN_ROW_COLUMN_IDS.has(col.id))
    .map((col) => getCardText(col, conn))
    .filter((text): text is string => text.length > 0)
    .join(' · ')
}

// Pulls the close button VNode out of the visible columns for the card main row.
// Returns null if Close is not visible (user disabled it).
function getCloseButton(
  conn: Connection,
  cols: ConnectionColumn[],
): VNode | string | null {
  const closeCol = cols.find((c) => c.id === 'close')
  if (!closeCol) return null
  return closeCol.render(conn)
}

function getCardHostText(conn: Connection, cols: ConnectionColumn[]): string {
  const hostProcessCol = cols.find((c) => c.id === 'hostProcess')
  if (hostProcessCol) {
    // HostProcess renderText returns "host (process)" or "host" — strip the trailing "(process)" if present
    const text = hostProcessCol.renderText
      ? hostProcessCol.renderText(conn)
      : ''
    const parenIdx = text.indexOf(' (')
    return parenIdx === -1 ? text : text.slice(0, parenIdx)
  }
  const hostCol = cols.find((c) => c.id === 'host')
  if (hostCol) {
    const result = hostCol.render(conn)
    return typeof result === 'string' ? result : ''
  }
  return ''
}

function getCardProcessText(
  conn: Connection,
  cols: ConnectionColumn[],
): string {
  const hostProcessCol = cols.find((c) => c.id === 'hostProcess')
  if (hostProcessCol) {
    const text = hostProcessCol.renderText
      ? hostProcessCol.renderText(conn)
      : ''
    const parenIdx = text.indexOf(' (')
    if (parenIdx === -1) return ''
    return text.slice(parenIdx + 2, -1) // skip " (" and trailing ")"
  }
  const processCol = cols.find((c) => c.id === 'process')
  if (processCol) {
    const result = processCol.render(conn)
    return typeof result === 'string' ? result : ''
  }
  return ''
}
</script>

<template>
  <div class="conn-table-container min-h-0 flex-1 rounded-xl">
    <table
      v-if="!isCardMode"
      class="table w-full border-collapse"
      :class="[tableSizeClass, isForceTable ? 'force-table' : '']"
    >
      <!-- Desktop header - hidden on mobile unless force-table -->
      <thead
        class="md:table-header-group"
        :class="isForceTable ? 'table-header-group' : 'hidden'"
      >
        <tr class="sticky top-0 z-10 bg-base-200">
          <th
            v-for="col in columns"
            :key="col.id"
            class="conn-th resize-x overflow-hidden text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase"
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
            :style="{ animationDelay: `${(index % 20) * 12}ms` }"
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
                :class="{ hidden: isForceTable }"
              >
                {{ t(col.key) }}
              </span>
              <component
                :is="CellRenderer"
                :render="() => col.render(row.original)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <!-- Card mode: column-driven double-line cards -->
    <div v-else class="conn-cards">
      <template
        v-for="(row, index) in rowModel"
        :key="row.type === 'group' ? `group-${row.key}` : row.original.id"
      >
        <!-- Group header card -->
        <div
          v-if="row.type === 'group'"
          class="conn-card-group"
          @click="emit('toggleGroupExpanded', row.key)"
        >
          <div class="conn-card-group-icon">
            <IconZoomOutFilled v-if="expandedGroups[row.key]" :size="14" />
            <IconZoomInFilled v-else :size="14" />
          </div>
          <span class="conn-card-group-title">{{ row.key }}</span>
          <span class="conn-card-group-count">({{ row.subRows.length }})</span>
        </div>
        <!-- Connection card -->
        <div
          v-else
          class="conn-card"
          :style="{ animationDelay: `${(index % 20) * 12}ms` }"
          @click="emit('rowClick', row.original)"
        >
          <div class="conn-card__main">
            <span class="conn-card__host">{{
              getCardHostText(row.original, props.columns)
            }}</span>
            <span class="conn-card__process">{{
              getCardProcessText(row.original, props.columns)
            }}</span>
            <component
              :is="CellRenderer"
              :render="() => getCloseButton(row.original, props.columns)"
              class="conn-card__action"
            />
          </div>
          <div class="conn-card__aux">
            {{ buildAuxLine(row.original, props.columns) }}
          </div>
        </div>
      </template>
    </div>

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

.force-table .conn-data-row {
  display: table-row;
  margin: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.force-table .conn-data-row:nth-child(even) {
  background: color-mix(in oklch, var(--color-base-content) 2%, transparent);
}

.force-table .conn-data-row:hover {
  background: color-mix(in oklch, var(--color-base-content) 5%, transparent);
  box-shadow: none;
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
    padding: 0.5rem 0.625rem; /* tighter vertical to make room for two lines */
    text-align: left !important;
    vertical-align: middle;
    white-space: nowrap;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-base-content) 5%, transparent);
  }
}

.force-table .conn-td {
  width: auto;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  text-align: left !important;
  vertical-align: middle;
  white-space: nowrap;
  border-bottom: 1px solid
    color-mix(in oklch, var(--color-base-content) 5%, transparent);
}

.conn-td-label {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

.conn-empty {
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

/* ============================================================
   Card render mode
   ============================================================ */
.conn-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
}

.conn-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.75rem;
  background: var(--color-base-100);
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
  border-radius: 0.5rem;
  cursor: pointer;
  animation: fadeIn 0.3s ease-out backwards;
  transition:
    transform var(--dur-base, 220ms)
      var(--ease-spring-soft, cubic-bezier(0.5, 1.25, 0.5, 1)),
    box-shadow var(--dur-base, 220ms)
      var(--ease-soft, cubic-bezier(0.4, 0, 0.2, 1)),
    border-color var(--dur-fast, 160ms)
      var(--ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
}

.conn-card:hover {
  transform: translateY(-1px);
  box-shadow: var(
    --lift-1,
    0 2px 6px color-mix(in oklch, var(--color-base-content) 8%, transparent)
  );
  border-color: color-mix(in oklch, var(--color-base-content) 15%, transparent);
}

.conn-card__main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem; /* 13px */
  line-height: 1.4;
}

.conn-card__host {
  font-weight: 600;
  color: var(--color-base-content);
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-card__process {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem; /* 12px */
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 75%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-card__action {
  flex-shrink: 0;
  margin-left: auto;
}

.conn-card__aux {
  font-size: 0.6875rem; /* 11px */
  line-height: 1.35;
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 58%, transparent);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-card-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  margin-top: 0.25rem;
  background: color-mix(in oklch, var(--color-primary) 5%, transparent);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background var(--dur-fast, 160ms) ease;
}

.conn-card-group:hover {
  background: color-mix(in oklch, var(--color-primary) 10%, transparent);
}

.conn-card-group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: color-mix(in oklch, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.conn-card-group-title {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.8125rem;
}

.conn-card-group-count {
  font-size: 0.75rem;
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

/* General sibling: every card after a group header gets indented to
   visually express group membership (spec §8.2). */
.conn-card-group ~ .conn-card {
  margin-left: 1rem;
}
</style>
