import { createEventSignal } from '@solid-primitives/event-listener'
import { makePersisted } from '@solid-primitives/storage'
import { createReconnectingWS } from '@solid-primitives/websocket'
import {
  IconCircleX,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
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
import { For, createEffect, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import ConnectionsModal from '~/components/ConnectionsModal'
import { AccessorKey } from '~/config/connection'
import { secret, useRequest, wsEndpointURL } from '~/signals'
import type { Connection } from '~/types'

type ConnectionWithSpeed = Connection & {
  downloadSpeed: number
  uploadSpeed: number
}

type ColumnVisibility = Partial<Record<AccessorKey, boolean>>

const initColumnVisibility = {
  ...Object.fromEntries(Object.values(AccessorKey).map((i) => [i, true])),
  [AccessorKey.ID]: false,
}

export default () => {
  const [columnVisibility, setColumnVisibility] = makePersisted(
    createSignal<ColumnVisibility>(initColumnVisibility),
    {
      name: 'columnVisibility',
      storage: localStorage,
    },
  )

  const request = useRequest()
  const [search, setSearch] = createSignal('')

  const ws = createReconnectingWS(
    `${wsEndpointURL()}/connections?token=${secret()}`,
  )

  const messageEvent = createEventSignal<{
    message: WebSocketEventMap['message']
  }>(ws, 'message')

  const [connectionsWithSpeed, setConnectionsWithSpeed] = createSignal<
    ConnectionWithSpeed[]
  >([])

  createEffect(() => {
    const data = messageEvent()?.data

    if (!data) {
      return
    }

    setConnectionsWithSpeed((prevConnections) => {
      const prevMap = new Map<string, Connection>()
      prevConnections.forEach((prev) => prevMap.set(prev.id, prev))

      const connections = (
        JSON.parse(data) as { connections: Connection[] }
      ).connections.map((connection) => {
        const prevConn = prevMap.get(connection.id)

        if (!prevConn) {
          return { ...connection, downloadSpeed: 0, uploadSpeed: 0 }
        }

        return {
          ...connection,
          downloadSpeed: prevConn.download
            ? connection.download - prevConn.download
            : 0,
          uploadSpeed: prevConn.upload
            ? connection.upload - prevConn.upload
            : 0,
        }
      })

      return connections.slice(-100)
    })
  })

  const onCloseConnection = (id: string) => request.delete(`connections/${id}`)

  const columns: ColumnDef<ConnectionWithSpeed>[] = [
    {
      accessorKey: AccessorKey.Close,
      header: () => (
        <div class="flex h-full items-center">
          <button
            class="btn btn-circle btn-xs"
            onClick={() => request.delete('connections')}
          >
            <IconCircleX size="18" />
          </button>
        </div>
      ),
      cell: ({ row }) => (
        <div class="flex h-full items-center">
          <button
            class="btn btn-circle btn-xs"
            onClick={() => onCloseConnection(row.id)}
          >
            <IconCircleX size="18" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: AccessorKey.ID,
      accessorFn: (row) => row.id,
    },
    {
      accessorKey: AccessorKey.Type,
      accessorFn: (row) => `${row.metadata.type}(${row.metadata.network})`,
    },
    {
      accessorKey: AccessorKey.Process,
      accessorFn: (row) => row.metadata.process || '-',
    },
    {
      accessorKey: AccessorKey.Host,
      accessorFn: (row) =>
        row.metadata.host ? row.metadata.host : row.metadata.destinationIP,
    },
    {
      accessorKey: AccessorKey.Rule,
      accessorFn: (row) =>
        !row.rulePayload ? row.rule : `${row.rule} :: ${row.rulePayload}`,
    },
    {
      accessorKey: AccessorKey.Chains,
      accessorFn: (row) => row.chains.slice().reverse().join(' :: '),
    },
    {
      accessorKey: AccessorKey.DlSpeed,
      accessorFn: (row) => `${byteSize(row.downloadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.downloadSpeed - next.original.downloadSpeed,
    },
    {
      accessorKey: AccessorKey.ULSpeed,
      accessorFn: (row) => `${byteSize(row.uploadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.uploadSpeed - next.original.uploadSpeed,
    },
    {
      accessorKey: AccessorKey.Download,
      accessorFn: (row) => byteSize(row.download),
      sortingFn: (prev, next) =>
        prev.original.download - next.original.download,
    },
    {
      accessorKey: AccessorKey.Upload,
      accessorFn: (row) => byteSize(row.upload),
      sortingFn: (prev, next) => prev.original.upload - next.original.upload,
    },
    {
      accessorKey: AccessorKey.Source,
      accessorFn: (row) =>
        isIPv6(row.metadata.sourceIP)
          ? `[${row.metadata.sourceIP}]:${row.metadata.sourcePort}`
          : `${row.metadata.sourceIP}:${row.metadata.sourcePort}`,
    },
    {
      accessorKey: AccessorKey.Destination,
      accessorFn: (row) =>
        isIPv6(row.metadata.destinationIP)
          ? `[${row.metadata.destinationIP}]:${row.metadata.destinationPort}`
          : `${row.metadata.destinationIP}:${row.metadata.destinationPort}`,
    },
  ]

  const [sorting, setSorting] = createSignal<SortingState>([
    { id: 'ID', desc: true },
  ])

  const table = createSolidTable({
    state: {
      get sorting() {
        return sorting()
      },
      get columnVisibility() {
        return columnVisibility()
      },
    },
    get data() {
      return search()
        ? connectionsWithSpeed().filter((connection) =>
            Object.values(connection).some((conn) =>
              JSON.stringify(conn)
                .toLowerCase()
                .includes(search().toLowerCase()),
            ),
          )
        : connectionsWithSpeed()
    },
    enableHiding: true,
    columns,
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div class="flex flex-col gap-4">
      <div class="flex w-full">
        <input
          class="input input-primary mr-4 w-40 flex-1"
          placeholder="Search"
          onInput={(e) => setSearch(e.target.value)}
        />
        <label htmlFor="connection-modal" class="btn">
          <IconSettings />
        </label>
        <ConnectionsModal
          data={columnVisibility()}
          onChange={(data: ColumnVisibility) =>
            setColumnVisibility({ ...data })
          }
        />
      </div>

      <div class="overflow-x-auto whitespace-nowrap">
        <table class="table table-xs">
          <thead>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <th class="bg-base-200">
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
