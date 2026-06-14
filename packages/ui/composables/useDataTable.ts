import type {
  DataTableColumn,
  GroupedRow,
  SortState,
} from '~/components/DataTable.vue'

export interface UseDataTableOptions<T> {
  // Persistence keys for localStorage
  sortingKey?: string
  groupingKey?: string
  // Default sort
  defaultSort?: SortState
  // Columns config
  columns: DataTableColumn<T>[]
}

export function useDataTable<T>(options: UseDataTableOptions<T>) {
  // Sorting state
  const sortState = options.sortingKey
    ? useLocalStorage<SortState | null>(
        options.sortingKey,
        options.defaultSort || null,
      )
    : ref<SortState | null>(options.defaultSort || null)

  // Grouping state
  const groupState = options.groupingKey
    ? useLocalStorage<string[]>(options.groupingKey, [])
    : ref<string[]>([])

  // Handle sort - three state toggle: desc -> asc -> none
  const handleSort = (columnId: string) => {
    const col = options.columns.find((c) => c.id === columnId)

    if (!col?.sortable) return

    if (sortState.value?.column === columnId) {
      // Three-state toggle: desc -> asc -> none
      if (sortState.value.desc) {
        sortState.value = { column: columnId, desc: false }
      } else {
        sortState.value = null
      }
    } else {
      // Start with desc
      sortState.value = { column: columnId, desc: true }
    }
  }

  // Handle grouping toggle
  const handleGroup = (columnId: string) => {
    const col = options.columns.find((c) => c.id === columnId)

    if (!col?.groupable) return

    const idx = groupState.value.indexOf(columnId)

    if (idx >= 0) {
      groupState.value = groupState.value.filter((id) => id !== columnId)
    } else {
      groupState.value = [...groupState.value, columnId]
    }
  }

  // Sort rows
  const sortRows = (
    rows: T[],
    getSortValue?: (row: T, columnId: string) => unknown,
  ): T[] => {
    if (!sortState.value) return rows

    const { column, desc } = sortState.value
    const colDef = options.columns.find((c) => c.id === column)

    if (!colDef) return rows

    return [...rows].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown

      if (getSortValue) {
        aVal = getSortValue(a, column)
        bVal = getSortValue(b, column)
      } else if (colDef.accessor) {
        if (typeof colDef.accessor === 'function') {
          aVal = colDef.accessor(a)
          bVal = colDef.accessor(b)
        } else {
          aVal = a[colDef.accessor as keyof T]
          bVal = b[colDef.accessor as keyof T]
        }
      } else {
        return 0
      }

      let comparison = 0

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal)
      } else if (aVal instanceof Date && bVal instanceof Date) {
        comparison = aVal.getTime() - bVal.getTime()
      }

      return desc ? -comparison : comparison
    })
  }

  // Group rows
  const groupRows = (
    rows: T[],
    getGroupValue?: (row: T, columnId: string) => string,
  ): GroupedRow<T>[] => {
    const groupColumnId = groupState.value[0]
    if (!groupColumnId) return []

    const colDef = options.columns.find((c) => c.id === groupColumnId)

    if (!colDef) return []

    const groups = new Map<string, T[]>()

    for (const row of rows) {
      let key: string

      if (getGroupValue) {
        key = getGroupValue(row, groupColumnId)
      } else if (colDef.accessor) {
        if (typeof colDef.accessor === 'function') {
          key = String(colDef.accessor(row) ?? '')
        } else {
          key = String(row[colDef.accessor as keyof T] ?? '')
        }
      } else {
        key = ''
      }

      if (!groups.has(key)) {
        groups.set(key, [])
      }

      groups.get(key)!.push(row)
    }

    return Array.from(groups.entries()).map(([key, rows]) => ({
      key,
      rows,
    }))
  }

  return {
    sortState,
    groupState,
    handleSort,
    handleGroup,
    sortRows,
    groupRows,
  }
}
