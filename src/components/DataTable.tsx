import {
  IconSortAscending,
  IconSortDescending,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-solidjs'
import type { Cell, Row, Table } from '@tanstack/solid-table'
import { flexRender } from '@tanstack/solid-table'
import type { JSX } from 'solid-js'
import { tv, type VariantProps } from 'tailwind-variants'

const dataTable = tv({
  slots: {
    table: 'table',
    thead: '',
    th: 'bg-base-200',
    thContent: 'flex items-center gap-2',
    thLabel: 'flex-1',
    groupButton: 'cursor-pointer',
    tbody: '',
    tr: '',
    td: '',
    mobileLabel:
      'justify mb-0.5 text-[10px] text-base-content/60 uppercase md:hidden',
    groupedCell: 'flex items-center gap-2',
  },
  variants: {
    // Table-level variants
    stickyHeader: {
      true: {
        thead: 'sticky top-0 z-10',
      },
    },
    pinRows: {
      true: {
        table: 'table-pin-rows',
      },
    },
    zebra: {
      true: {
        table: 'table-zebra',
      },
    },
    size: {
      xs: { table: 'table-xs' },
      sm: { table: 'table-sm' },
      md: { table: 'table-md' },
      lg: { table: 'table-lg' },
    },
    // Header visibility (for responsive design)
    hideHeaderOnMobile: {
      true: {
        thead: 'hidden md:table-header-group',
      },
    },
    // Row hover effect
    rowHover: {
      true: {
        tr: 'hover:bg-primary! hover:text-primary-content',
      },
    },
  },
})

export type DataTableVariants = VariantProps<typeof dataTable>

interface DataTableProps<T> extends DataTableVariants {
  table: Table<T>
  class?: string
  rowClass?: string | ((row: Row<T>) => string)
  cellClass?: string | ((cell: Cell<T, unknown>) => string)
  onRowClick?: (row: Row<T>) => void
  onCellContextMenu?: (cell: Cell<T, unknown>, e: MouseEvent) => void
  renderMobileLabel?: (cell: Cell<T, unknown>) => JSX.Element | string | null
}

export const DataTable = <T,>(props: DataTableProps<T>) => {
  const styles = dataTable({
    stickyHeader: props.stickyHeader,
    pinRows: props.pinRows,
    zebra: props.zebra,
    size: props.size,
    hideHeaderOnMobile: props.hideHeaderOnMobile,
    rowHover: props.rowHover,
  })

  const getRowClass = (row: Row<T>) => {
    if (typeof props.rowClass === 'function') {
      return props.rowClass(row)
    }

    return props.rowClass ?? ''
  }

  const getCellClass = (cell: Cell<T, unknown>) => {
    if (typeof props.cellClass === 'function') {
      return props.cellClass(cell)
    }

    return props.cellClass ?? ''
  }

  return (
    <table class={styles.table({ class: props.class })}>
      <thead class={styles.thead()}>
        <For each={props.table.getHeaderGroups()}>
          {(headerGroup) => (
            <tr>
              <For each={headerGroup.headers}>
                {(header) => (
                  <th class={styles.th()}>
                    <div class={styles.thContent()}>
                      <div
                        class={styles.thLabel({
                          class:
                            header.column.getCanSort() &&
                            'cursor-pointer select-none',
                        })}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </div>

                      {{
                        asc: <IconSortAscending />,
                        desc: <IconSortDescending />,
                      }[header.column.getIsSorted() as string] ?? null}

                      {header.column.getCanGroup() ? (
                        <button
                          class={styles.groupButton()}
                          onClick={header.column.getToggleGroupingHandler()}
                        >
                          {header.column.getIsGrouped() ? (
                            <IconZoomOutFilled size={18} />
                          ) : (
                            <IconZoomInFilled size={18} />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </th>
                )}
              </For>
            </tr>
          )}
        </For>
      </thead>

      <tbody class={styles.tbody()}>
        <For each={props.table.getRowModel().rows}>
          {(row) => (
            <tr
              class={styles.tr({ class: getRowClass(row) })}
              onClick={() => props.onRowClick?.(row)}
            >
              <For each={row.getVisibleCells()}>
                {(cell) => (
                  <td
                    class={styles.td({ class: getCellClass(cell) })}
                    onContextMenu={(e) => props.onCellContextMenu?.(cell, e)}
                  >
                    {/* Mobile label */}
                    {props.renderMobileLabel ? (
                      <div class={styles.mobileLabel()}>
                        {props.renderMobileLabel(cell)}
                      </div>
                    ) : null}

                    {/* Cell content */}
                    {cell.getIsGrouped() ? (
                      <button
                        class={styles.groupedCell({
                          class: row.getCanExpand()
                            ? 'cursor-pointer'
                            : 'cursor-normal',
                        })}
                        onClick={row.getToggleExpandedHandler()}
                      >
                        <div>
                          {row.getIsExpanded() ? (
                            <IconZoomOutFilled size={18} />
                          ) : (
                            <IconZoomInFilled size={18} />
                          )}
                        </div>

                        <div>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>

                        <div>({row.subRows.length})</div>
                      </button>
                    ) : cell.getIsAggregated() ? (
                      flexRender(
                        cell.column.columnDef.aggregatedCell ??
                          cell.column.columnDef.cell,
                        cell.getContext(),
                      )
                    ) : cell.getIsPlaceholder() ? null : (
                      flexRender(cell.column.columnDef.cell, cell.getContext())
                    )}
                  </td>
                )}
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  )
}
