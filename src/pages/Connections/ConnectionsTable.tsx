import { writeClipboard } from '@solid-primitives/clipboard'
import {
  IconSortAscending,
  IconSortDescending,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-solidjs'
import type { Table } from '@tanstack/solid-table'
import { flexRender } from '@tanstack/solid-table'
import { twMerge } from 'tailwind-merge'
import { useI18n } from '~/i18n'
import type { Dict } from '~/i18n/dict'
import { connectionsTableSize, tableSizeClassName } from '~/signals'
import type { Connection } from '~/types'

type ColMeta = { headerKey: keyof Dict }

interface ConnectionsTableProps {
  table: Table<Connection>
}

export const ConnectionsTable = (props: ConnectionsTableProps) => {
  const [t] = useI18n()

  return (
    <div class="flex-1 overflow-x-auto rounded-md bg-base-300">
      <table
        class={twMerge(
          tableSizeClassName(connectionsTableSize()),
          'table-pin-rows table table-zebra',
        )}
      >
        {/* Desktop header */}
        <thead class="hidden md:table-header-group">
          <For each={props.table.getHeaderGroups()}>
            {(headerGroup) => (
              <tr>
                <For each={headerGroup.headers}>
                  {(header) => (
                    <th class="bg-base-200 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <div
                          class={twMerge(
                            header.column.getCanSort() &&
                              'cursor-pointer select-none',
                            'text-xs',
                          )}
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
                            class="cursor-pointer"
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

        {/* Table body */}
        <tbody>
          <For each={props.table.getRowModel().rows}>
            {(row) => (
              <tr class="even:bg-base-500 flex flex-wrap rounded-xl border-4 border-base-300 px-2 odd:bg-base-100 md:table-row md:rounded-none md:border-0 md:px-0">
                <For each={row.getVisibleCells()}>
                  {(cell) => (
                    <td
                      class="w-1/2 min-w-[50%] pb-1.5 text-justify align-top wrap-break-word nth-[2n]:text-right nth-last-[2]:mb-3 sm:w-1/3 sm:min-w-[33.333%] sm:nth-[2n]:text-justify sm:nth-[3n]:text-right md:w-auto md:min-w-0 md:text-start md:align-middle md:whitespace-nowrap md:nth-[2n]:text-start md:nth-[3n]:text-start md:nth-last-[2]:mb-0"
                      onContextMenu={(e) => {
                        e.preventDefault()

                        const value = cell.renderValue() as null | string

                        if (value) writeClipboard(value).catch(() => {})
                      }}
                    >
                      {/* Mobile label */}
                      <div class="justify mb-0.5 text-[10px] text-base-content/60 uppercase md:hidden">
                        {(() => {
                          const key = (
                            cell.column.columnDef.meta as ColMeta | undefined
                          )?.headerKey

                          return key ? t(key) : ''
                        })()}
                      </div>

                      {/* Cell content */}
                      {cell.getIsGrouped() ? (
                        <button
                          class={twMerge(
                            row.getCanExpand()
                              ? 'cursor-pointer'
                              : 'cursor-normal',
                            'flex items-center gap-2',
                          )}
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
                        flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                      )}
                    </td>
                  )}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}
