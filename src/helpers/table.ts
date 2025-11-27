import { rankItem } from '@tanstack/match-sorter-utils'
import type { FilterFn } from '@tanstack/solid-table'

/**
 * A fuzzy filter function for TanStack Table that uses match-sorter-utils
 * to rank and filter rows based on the search value.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)

  addMeta({ itemRank })

  return itemRank.passed
}
