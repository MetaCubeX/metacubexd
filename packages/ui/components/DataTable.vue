<script setup lang="ts" generic="T extends Record<string, any>">
import {
  IconSortAscending,
  IconSortDescending,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-vue'

export interface DataTableColumn<T> {
  id: string
  label: string
  accessor?: keyof T | ((row: T) => unknown)
  sortable?: boolean
  groupable?: boolean
  mobileLabel?: string
  thClass?: string
  tdClass?: string
}

export interface SortState {
  column: string
  desc: boolean
}

export interface GroupedRow<T> {
  key: string
  rows: T[]
}

interface Props {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey?: keyof T | ((row: T, index: number) => string | number)
  // Sorting
  sortState?: SortState | null
  // Grouping
  groupState?: string[]
  groupedRows?: GroupedRow<T>[]
  // Styling variants
  size?: 'xs' | 'sm' | 'md' | 'lg'
  zebra?: boolean
  pinRows?: boolean
  stickyHeader?: boolean
  hideHeaderOnMobile?: boolean
  rowHover?: boolean
  renderMobileLabel?: boolean
  // Classes
  rowClass?: string
  cellClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: undefined,
  zebra: false,
  pinRows: false,
  stickyHeader: false,
  hideHeaderOnMobile: false,
  rowHover: false,
  renderMobileLabel: false,
  rowClass: '',
  cellClass: '',
})

const emit = defineEmits<{
  sort: [column: string]
  group: [column: string]
  'row-click': [row: T]
  'row-contextmenu': [row: T, event: MouseEvent]
  'cell-contextmenu': [row: T, column: DataTableColumn<T>, event: MouseEvent]
}>()

// Expanded groups state
const expandedGroups = ref(new Set<string>()) as Ref<Set<string>>

function toggleGroupExpanded(key: string) {
  if (expandedGroups.value.has(key)) {
    expandedGroups.value.delete(key)
  } else {
    expandedGroups.value.add(key)
  }
  // Trigger reactivity
  expandedGroups.value = new Set(expandedGroups.value)
}

// Computed classes
const tableClasses = computed(() => {
  const classes: string[] = []
  if (props.size) classes.push(`table-${props.size}`)
  if (props.zebra) classes.push('table-zebra')
  if (props.pinRows) classes.push('table-pin-rows')
  return classes
})

const theadClasses = computed(() => {
  const classes: string[] = []
  if (props.stickyHeader) classes.push('sticky', 'top-0', 'z-10')
  if (props.hideHeaderOnMobile) classes.push('hidden', 'md:table-header-group')
  return classes
})

const rowClasses = computed(() => props.rowClass)

// Get row key
function getRowKey(row: T, index: number): string | number {
  if (!props.rowKey) return index
  if (typeof props.rowKey === 'function') return props.rowKey(row, index)
  return row[props.rowKey] as string | number
}

// Get cell value
function getCellValue(row: T, col: DataTableColumn<T>): unknown {
  if (!col.accessor) return ''
  if (typeof col.accessor === 'function') return col.accessor(row)
  return row[col.accessor]
}

// Handle sort click
function handleSort(columnId: string) {
  emit('sort', columnId)
}

// Handle group click
function handleGroup(columnId: string) {
  emit('group', columnId)
}
</script>

<template>
  <table class="table" :class="tableClasses">
    <thead :class="theadClasses">
      <tr>
        <th
          v-for="col in columns"
          :key="col.id"
          class="bg-base-200 whitespace-nowrap"
          :class="col.thClass"
        >
          <div class="flex items-center gap-2">
            <div
              class="flex-1"
              :class="{ 'cursor-pointer select-none': col.sortable }"
              @click="col.sortable && handleSort(col.id)"
            >
              {{ col.label }}
            </div>

            <!-- Sort icons -->
            <IconSortAscending
              v-if="sortState?.column === col.id && !sortState?.desc"
              :size="16"
            />
            <IconSortDescending
              v-else-if="sortState?.column === col.id && sortState?.desc"
              :size="16"
            />

            <!-- Group button -->
            <button
              v-if="col.groupable"
              class="flex cursor-pointer items-center border-none bg-transparent p-0"
              @click.stop="handleGroup(col.id)"
            >
              <IconZoomOutFilled
                v-if="groupState?.includes(col.id)"
                :size="18"
              />
              <IconZoomInFilled v-else :size="18" />
            </button>
          </div>
        </th>
      </tr>
    </thead>

    <tbody>
      <template v-if="groupedRows && groupState?.length">
        <!-- Grouped rows -->
        <template v-for="group in groupedRows" :key="group.key">
          <tr
            class="cursor-pointer bg-base-200"
            @click="toggleGroupExpanded(group.key)"
          >
            <td :colspan="columns.length">
              <div class="flex items-center gap-2">
                <IconZoomOutFilled
                  v-if="expandedGroups.has(group.key)"
                  :size="18"
                />
                <IconZoomInFilled v-else :size="18" />
                <span>{{ group.key }}</span>
                <span class="text-base-content/60"
                  >({{ group.rows.length }})</span
                >
              </div>
            </td>
          </tr>
          <template v-if="expandedGroups.has(group.key)">
            <tr
              v-for="(row, rowIndex) in group.rows"
              :key="getRowKey(row, rowIndex)"
              :class="[
                rowClasses,
                rowHover ? 'hover:!bg-primary hover:text-primary-content' : '',
              ]"
              @click="$emit('row-click', row)"
              @contextmenu="(e) => $emit('row-contextmenu', row, e)"
            >
              <td
                v-for="col in columns"
                :key="col.id"
                class="whitespace-nowrap"
                :class="[col.tdClass, cellClass]"
                @contextmenu="(e) => $emit('cell-contextmenu', row, col, e)"
              >
                <!-- Mobile label -->
                <div
                  v-if="renderMobileLabel && col.mobileLabel"
                  class="mb-0.5 text-[10px] text-base-content/60 uppercase md:hidden"
                >
                  {{ col.mobileLabel }}
                </div>
                <slot
                  :name="`cell-${col.id}`"
                  :row="row"
                  :value="getCellValue(row, col)"
                >
                  {{ getCellValue(row, col) }}
                </slot>
              </td>
            </tr>
          </template>
        </template>
      </template>
      <template v-else>
        <!-- Non-grouped rows -->
        <tr
          v-for="(row, rowIndex) in rows"
          :key="getRowKey(row, rowIndex)"
          :class="[
            rowClasses,
            rowHover ? 'hover:!bg-primary hover:text-primary-content' : '',
          ]"
          @click="$emit('row-click', row)"
          @contextmenu="(e) => $emit('row-contextmenu', row, e)"
        >
          <td
            v-for="col in columns"
            :key="col.id"
            class="whitespace-nowrap"
            :class="[col.tdClass, cellClass]"
            @contextmenu="(e) => $emit('cell-contextmenu', row, col, e)"
          >
            <!-- Mobile label -->
            <div
              v-if="renderMobileLabel && col.mobileLabel"
              class="mb-0.5 text-[10px] text-base-content/60 uppercase md:hidden"
            >
              {{ col.mobileLabel }}
            </div>
            <slot
              :name="`cell-${col.id}`"
              :row="row"
              :value="getCellValue(row, col)"
            >
              {{ getCellValue(row, col) }}
            </slot>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
