import { createEventSignal } from '@solid-primitives/event-listener'
import { useI18n } from '@solid-primitives/i18n'
import { createReconnectingWS } from '@solid-primitives/websocket'
import {
  ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from '@tanstack/solid-table'
import { For, createEffect, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { secret, tableSizeClassName, wsEndpointURL } from '~/signals'
import { Log } from '~/types'

type LogWithSeq = Log & { seq: number }

export default () => {
  const [t] = useI18n()
  let seq = 0
  const [search, setSearch] = createSignal('')
  const [logs, setLogs] = createSignal<LogWithSeq[]>([])

  const ws = createReconnectingWS(`${wsEndpointURL()}/logs?token=${secret()}`)

  const messageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(ws, 'message')

  createEffect(() => {
    const data = messageEvent()?.data

    if (!data) {
      return
    }

    setLogs((logs) =>
      [{ ...(JSON.parse(data) as Log), seq }, ...logs].slice(0, 100),
    )

    seq++
  })

  const columns: ColumnDef<LogWithSeq>[] = [
    {
      accessorKey: 'Sequence',
      accessorFn: (row) => row.seq,
    },
    {
      accessorKey: 'Type',
      accessorFn: (row) => row.type,
    },
    {
      accessorKey: 'Payload',
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
    <div class="flex h-full flex-col gap-4 overflow-y-auto p-1">
      <input
        class="input input-primary flex-shrink-0"
        placeholder={t('search')}
        onInput={(e) => setSearch(e.target.value)}
      />

      <div class="overflow-x-auto whitespace-nowrap rounded-md bg-base-300">
        <table
          class={twMerge(tableSizeClassName(), 'table relative rounded-none')}
        >
          <thead class="sticky top-0 z-10">
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
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
                    )}
                  </For>
                </tr>
              )}
            </For>
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
