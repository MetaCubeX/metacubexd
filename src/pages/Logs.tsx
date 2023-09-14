import { useI18n } from '@solid-primitives/i18n'
import {
  ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from '@tanstack/solid-table'
import { For, Index, createEffect, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { LOG_LEVEL } from '~/constants'
import { tableSize, tableSizeClassName, useWsRequest } from '~/signals'
import { logLevel, logMaxRows } from '~/signals/config'
import { Log } from '~/types'

type LogWithSeq = Log & { seq: number }

export default () => {
  const [t] = useI18n()
  let seq = 1
  const [search, setSearch] = createSignal('')
  const [logs, setLogs] = createSignal<LogWithSeq[]>([])

  const logsData = useWsRequest<Log>('logs', { level: logLevel() })
  const maxRows = logMaxRows()

  createEffect(() => {
    const data = logsData()

    if (!data) {
      return
    }

    setLogs((logs) => [{ ...data, seq }, ...logs].slice(0, maxRows))

    seq++
  })

  const columns: ColumnDef<LogWithSeq>[] = [
    {
      header: t('sequence'),
      accessorFn: (row) => row.seq,
    },
    {
      header: t('type'),
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
    get data() {
      return search()
        ? logs().filter((log) =>
            log.payload.toLowerCase().includes(search().toLowerCase()),
          )
        : logs()
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div class="flex h-full flex-col gap-4 p-1">
      <input
        type="search"
        class="input input-primary input-sm flex-shrink-0 sm:input-md"
        placeholder={t('search')}
        onInput={(e) => setSearch(e.target.value)}
      />

      <div class="overflow-x-auto whitespace-nowrap rounded-md bg-base-300">
        <table
          class={twMerge(
            tableSizeClassName(tableSize()),
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
                          <th class="bg-base-300">
                            <div>
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
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
                <tr class="hover">
                  <For each={row.getVisibleCells()}>
                    {(cell) => (
                      <td>
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
    </div>
  )
}
