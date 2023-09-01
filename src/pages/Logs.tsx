import { createEventSignal } from '@solid-primitives/event-listener'
import { createReconnectingWS } from '@solid-primitives/websocket'
import {
  ColumnDef,
  createSolidTable,
  flexRender,
  getCoreRowModel,
} from '@tanstack/solid-table'
import { For, createEffect, createSignal } from 'solid-js'
import { secret, wsEndpointURL } from '~/signals'
import { Log } from '~/types'

type LogWithSeq = Log & { seq: number }

export default () => {
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
    <div class="flex flex-col gap-4">
      <input
        class="input input-primary"
        placeholder="Search"
        onInput={(e) => setSearch(e.target.value)}
      />

      <div class="overflow-x-auto whitespace-nowrap">
        <table class="table table-zebra-zebra table-xs bg-base-200">
          <thead>
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
                <tr>
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
