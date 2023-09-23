import { makePersisted } from '@solid-primitives/storage'
import {
  IconSettings,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-solidjs'
import { rankItem } from '@tanstack/match-sorter-utils'
import {
  ColumnDef,
  FilterFn,
  SortingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table'
import { For, Index, createEffect, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button, LogsSettingsModal } from '~/components'
import { LOG_LEVEL } from '~/constants'
import { useI18n } from '~/i18n'
import { logsTableSize, tableSizeClassName, useWsRequest } from '~/signals'
import { logLevel, logMaxRows } from '~/signals/config'
import { Log } from '~/types'

type LogWithSeq = Log & { seq: number }

const fuzzyFilter: FilterFn<LogWithSeq> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value)

  // Store the itemRank info
  addMeta({
    itemRank,
  })

  // Return if the item should be filtered in/out
  return itemRank.passed
}

export default () => {
  let logsSettingsModalRef: HTMLDialogElement | undefined

  const [t] = useI18n()

  let seq = 1
  const [logs, setLogs] = createSignal<LogWithSeq[]>([])

  const logsData = useWsRequest<Log>('logs', { level: logLevel() })

  createEffect(() => {
    const data = logsData()

    if (!data) {
      return
    }

    setLogs((logs) => [{ ...data, seq }, ...logs].slice(0, logMaxRows()))

    seq++
  })

  const [globalFilter, setGlobalFilter] = createSignal('')

  const [sorting, setSorting] = makePersisted(createSignal<SortingState>([]), {
    name: 'logsTableSorting',
    storage: localStorage,
  })

  const columns: ColumnDef<LogWithSeq>[] = [
    {
      header: t('sequence'),
      accessorFn: (row) => row.seq,
    },
    {
      header: t('type'),
      accessorFn: (row) => row.type,
      cell: ({ row }) => {
        const type = row.original.type as LOG_LEVEL

        let className = ''

        switch (type) {
          case LOG_LEVEL.Error:
            className = 'text-error'
            break
          case LOG_LEVEL.Warning:
            className = 'text-warning'
            break
          case LOG_LEVEL.Info:
            className = 'text-info'
            break
          case LOG_LEVEL.Debug:
            className = 'text-success'
            break
        }

        return <span class={className}>{`[${row.original.type}]`}</span>
      },
    },
    {
      header: t('payload'),
      accessorFn: (row) => row.payload,
    },
  ]

  const table = createSolidTable({
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      get globalFilter() {
        return globalFilter()
      },
      get sorting() {
        return sorting()
      },
    },
    get data() {
      return logs()
    },
    sortDescFirst: true,
    columns,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: fuzzyFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div class="flex h-full flex-col gap-2">
      <div class="join w-full">
        <input
          type="search"
          class="input join-item input-primary input-sm flex-1 flex-shrink-0 sm:input-md"
          placeholder={t('search')}
          onInput={(e) => setGlobalFilter(e.target.value)}
        />

        <Button
          class="join-item btn-sm sm:btn-md"
          onClick={() => logsSettingsModalRef?.showModal()}
          icon={<IconSettings />}
        />
      </div>

      <div class="overflow-x-auto whitespace-nowrap rounded-md bg-base-300">
        <table
          class={twMerge(
            tableSizeClassName(logsTableSize()),
            'table relative rounded-none',
          )}
        >
          <thead class="sticky top-0 z-10">
            <Index each={table.getHeaderGroups()}>
              {(keyedHeaderGroup) => {
                const headerGroup = keyedHeaderGroup()

                return (
                  <tr>
                    <Index each={headerGroup.headers}>
                      {(keyedHeader) => {
                        const header = keyedHeader()

                        return (
                          <th class="bg-base-200">
                            <div class="flex items-center">
                              <div
                                class={twMerge(
                                  header.column.getCanSort() &&
                                    'cursor-pointer select-none',
                                  'flex-1',
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
                            </div>
                          </th>
                        )
                      }}
                    </Index>
                  </tr>
                )
              }}
            </Index>
          </thead>

          <tbody>
            <For each={table.getRowModel().rows}>
              {(row) => (
                <tr class="hover:!bg-primary hover:text-primary-content">
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <td class="py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
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

      <LogsSettingsModal ref={(el) => (logsSettingsModalRef = el)} />
    </div>
  )
}
