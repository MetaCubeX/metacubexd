import { writeClipboard } from '@solid-primitives/clipboard'
import { createEventSignal } from '@solid-primitives/event-listener'
import { useI18n } from '@solid-primitives/i18n'
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
import { Button, ConnectionsTableOrderingModal } from '~/components'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '~/constants'
import { secret, useRequest, wsEndpointURL } from '~/signals'
import type { Connection } from '~/types'

type ConnectionWithSpeed = Connection & {
  downloadSpeed: number
  uploadSpeed: number
}

type ColumnVisibility = Partial<Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>>
type ColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]

export default () => {
  const [t] = useI18n()
  const [columnVisibility, setColumnVisibility] = makePersisted(
    createSignal<ColumnVisibility>(CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY),
    {
      name: 'columnVisibility',
      storage: localStorage,
    },
  )
  const [columnOrder, setColumnOrder] = makePersisted(
    createSignal<ColumnOrder>(CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER),
    {
      name: 'columnOrder',
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
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
      enableSorting: false,
      header: () => t('close'),
      cell: ({ row }) => (
        <div class="flex h-full items-center">
          <Button
            class="btn-circle btn-xs"
            onClick={() => onCloseConnection(row.id)}
          >
            <IconCircleX size="18" />
          </Button>
        </div>
      ),
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ID,
      accessorFn: (row) => row.id,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
      accessorFn: (row) => `${row.metadata.type}(${row.metadata.network})`,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
      accessorFn: (row) =>
        row.metadata.process ||
        row.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
        '-',
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
      accessorFn: (row) =>
        `${
          row.metadata.host ? row.metadata.host : row.metadata.destinationIP
        }:${row.metadata.destinationPort}`,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
      accessorFn: (row) =>
        !row.rulePayload ? row.rule : `${row.rule} :: ${row.rulePayload}`,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
      accessorFn: (row) => row.chains.slice().reverse().join(' :: '),
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
      accessorFn: (row) => `${byteSize(row.downloadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.downloadSpeed - next.original.downloadSpeed,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ULSpeed,
      accessorFn: (row) => `${byteSize(row.uploadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.uploadSpeed - next.original.uploadSpeed,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
      accessorFn: (row) => byteSize(row.download),
      sortingFn: (prev, next) =>
        prev.original.download - next.original.download,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
      accessorFn: (row) => byteSize(row.upload),
      sortingFn: (prev, next) => prev.original.upload - next.original.upload,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Source,
      accessorFn: (row) =>
        isIPv6(row.metadata.sourceIP)
          ? `[${row.metadata.sourceIP}]:${row.metadata.sourcePort}`
          : `${row.metadata.sourceIP}:${row.metadata.sourcePort}`,
    },
    {
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
      accessorFn: (row) =>
        row.metadata.remoteDestination ||
        row.metadata.destinationIP ||
        row.metadata.host,
    },
  ]

  const [sorting, setSorting] = createSignal<SortingState>([
    { id: 'ID', desc: true },
  ])

  const table = createSolidTable({
    state: {
      get columnOrder() {
        return columnOrder()
      },
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
      <div class="flex w-full items-center gap-2">
        <input
          class="input input-primary flex-1"
          placeholder={t('search')}
          onInput={(e) => setSearch(e.target.value)}
        />

        <Button
          class="btn-circle"
          onClick={() => request.delete('connections')}
        >
          <IconCircleX />
        </Button>

        <label for="connection-modal" class="btn btn-circle">
          <IconSettings />
        </label>

        <ConnectionsTableOrderingModal
          order={columnOrder()}
          visible={columnVisibility()}
          onOrderChange={(data: ColumnOrder) => {
            setColumnOrder([...data])
          }}
          onVisibleChange={(data: ColumnVisibility) =>
            setColumnVisibility({ ...data })
          }
        />
      </div>

      <div class="overflow-x-auto whitespace-nowrap rounded-md">
        <table class="table table-xs rounded-none bg-base-200">
          <thead>
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <th class="bg-base-300">
                        <div
                          class={twMerge(
                            'flex items-center justify-between gap-2',
                            header.column.getCanSort() &&
                              'cursor-pointer select-none',
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {header.column.id ===
                          CONNECTIONS_TABLE_ACCESSOR_KEY.Close ? (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          ) : (
                            <span>{t(header.column.id)}</span>
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
                      <td
                        onContextMenu={(e) => {
                          e.preventDefault()
                          typeof cell.renderValue() === 'string' &&
                            void writeClipboard(cell.renderValue() as string)
                        }}
                      >
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
