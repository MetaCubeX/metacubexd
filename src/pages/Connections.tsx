import { createEventSignal } from '@solid-primitives/event-listener'
import { createReconnectingWS } from '@solid-primitives/websocket'
import {
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-solidjs'
import {
  ColumnDef,
  SortingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table'
import byteSize from 'byte-size'
import { isIPv6 } from 'is-ip'
import { For, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { secret, useRequest, wsEndpointURL } from '~/signals'
import type { Connection } from '~/types'

export default () => {
  const request = useRequest()
  const [search, setSearch] = createSignal('')

  const ws = createReconnectingWS(
    `${wsEndpointURL()}/connections?token=${secret()}`,
  )

  const messageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(ws, 'message')

  const connections = () => {
    const data = messageEvent()?.data

    if (!data) {
      return []
    }

    return (
      JSON.parse(data) as { connections: Connection[] }
    ).connections.slice(-100)
  }

  const onCloseConnection = (id: string) => request.delete(`connections/${id}`)

  const defaultSorting = Object.freeze({
    id: 'ID',
    desc: true,
  })
  const [sorting, setSorting] = createSignal<SortingState>([defaultSorting])

  const columns: ColumnDef<Connection>[] = [
    {
      id: 'close',
      header: () => (
        <div class="flex h-full items-center">
          <button
            class="btn btn-circle btn-outline btn-xs"
            onClick={() => request.delete('connections')}
          >
            <IconX />
          </button>
        </div>
      ),
      cell: ({ row }) => (
        <div class="flex h-full items-center">
          <button
            class="btn btn-circle btn-outline btn-xs"
            onClick={() => onCloseConnection(row.id)}
          >
            <IconX />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'ID',
      accessorFn: (row) => row.id,
    },
    {
      accessorKey: 'Network',
      accessorFn: (row) => row.metadata.network,
    },
    {
      accessorKey: 'Download',
      accessorFn: (row) => byteSize(row.download),
    },
    {
      accessorKey: 'Upload',
      accessorFn: (row) => byteSize(row.upload),
    },
    {
      accessorKey: 'Rule',
      accessorFn: (row) => row.rule,
    },
    {
      accessorKey: 'Chains',
      accessorFn: (row) => row.chains.join(' -> '),
    },
    {
      accessorKey: 'Remote Destination',
      accessorFn: (row) => row.metadata.remoteDestination,
    },
    {
      accessorKey: 'Host',
      accessorFn: (row) => row.metadata.host,
    },
    {
      accessorKey: 'DNS Mode',
      accessorFn: (row) => row.metadata.dnsMode,
    },
    {
      accessorKey: 'Type',
      accessorFn: (row) => row.metadata.type,
    },
    {
      accessorKey: 'Source',
      accessorFn: (row) =>
        isIPv6(row.metadata.sourceIP)
          ? `[${row.metadata.sourceIP}]:${row.metadata.sourcePort}`
          : `${row.metadata.sourceIP}:${row.metadata.sourcePort}`,
    },
    {
      accessorKey: 'Destination',
      accessorFn: (row) =>
        isIPv6(row.metadata.destinationIP)
          ? `[${row.metadata.destinationIP}]:${row.metadata.destinationPort}`
          : `${row.metadata.destinationIP}:${row.metadata.destinationPort}`,
    },
  ]

  const table = createSolidTable({
    state: {
      get sorting() {
        return sorting()
      },
    },
    get data() {
      return search()
        ? connections().filter((connection) =>
            Object.values(connection).some((conn) =>
              JSON.stringify(conn)
                .toLowerCase()
                .includes(search().toLowerCase()),
            ),
          )
        : connections()
    },
    columns,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
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
        <table class="table table-xs">
          <thead>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <th>
                        <div
                          class={twMerge(
                            'flex items-center justify-between',
                            header.column.getCanSort() &&
                              'cursor-pointer select-none',
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                          {{
                            asc: <IconSortAscending />,
                            desc: <IconSortDescending />,
                          }[header.column.getIsSorted() as string] ?? null}
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
