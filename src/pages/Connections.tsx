import { writeClipboard } from '@solid-primitives/clipboard'
import { useI18n } from '@solid-primitives/i18n'
import { makePersisted } from '@solid-primitives/storage'
import {
  IconInfoSmall,
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-solidjs'
import { rankItem } from '@tanstack/match-sorter-utils'
import {
  ColumnDef,
  FilterFn,
  GroupingState,
  SortingState,
  createSolidTable,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table'
import byteSize from 'byte-size'
import dayjs from 'dayjs'
import { For, Index, createMemo, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { closeAllConnectionsAPI, closeSingleConnectionAPI } from '~/apis'
import {
  Button,
  ConnectionsTableDetailsModal,
  ConnectionsTableOrderingModal,
} from '~/components'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '~/constants'
import { formatTimeFromNow } from '~/helpers'
import { tableSize, tableSizeClassName, useConnections } from '~/signals'
import type { Connection } from '~/types'

type ColumnVisibility = Partial<Record<CONNECTIONS_TABLE_ACCESSOR_KEY, boolean>>
type ColumnOrder = CONNECTIONS_TABLE_ACCESSOR_KEY[]

enum ActiveTab {
  activeConnections = 'activeConnections',
  closedConnections = 'closedConnections',
}

const fuzzyFilter: FilterFn<Connection> = (row, columnId, value, addMeta) => {
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
  const [t] = useI18n()

  const [activeTab, setActiveTab] = createSignal(ActiveTab.activeConnections)
  const { activeConnections, closedConnections, paused, setPaused } =
    useConnections()

  const [globalFilter, setGlobalFilter] = createSignal('')
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

  const [selectedConnectionID, setSelectedConnectionID] = createSignal<string>()

  const columns = createMemo<ColumnDef<Connection>[]>(() => [
    {
      header: () => t('details'),
      enableGrouping: false,
      enableSorting: false,
      enableColumnFilter: false,
      enableGlobalFilter: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Details,
      cell: ({ row }) => (
        <div class="flex h-4 items-center">
          <Button
            class="btn-circle btn-xs"
            onClick={() => {
              setSelectedConnectionID(row.original.id)

              const modal = document.querySelector(
                '#connections-table-details-modal',
              ) as HTMLDialogElement | null

              modal?.showModal()
            }}
          >
            <IconInfoSmall size="16" />
          </Button>
        </div>
      ),
    },
    {
      header: () => t('close'),
      enableGrouping: false,
      enableSorting: false,
      enableColumnFilter: false,
      enableGlobalFilter: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
      cell: ({ row }) => (
        <div class="flex h-4 items-center">
          <Button
            class="btn-circle btn-xs"
            onClick={() => closeSingleConnectionAPI(row.original.id)}
          >
            <IconX size="16" />
          </Button>
        </div>
      ),
    },
    {
      header: () => t('ID'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ID,
      accessorFn: (original) => original.id,
    },
    {
      header: () => t('type'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
      accessorFn: (original) =>
        `${original.metadata.type}(${original.metadata.network})`,
    },
    {
      header: () => t('process'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
      accessorFn: (original) =>
        original.metadata.process ||
        original.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
        '-',
    },
    {
      header: () => t('host'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
      accessorFn: (original) =>
        `${
          original.metadata.host
            ? original.metadata.host
            : original.metadata.destinationIP
        }:${original.metadata.destinationPort}`,
    },
    {
      header: () => t('rules'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
      accessorFn: (original) =>
        !original.rulePayload
          ? original.rule
          : `${original.rule} :: ${original.rulePayload}`,
    },
    {
      header: () => t('chains'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
      accessorFn: (original) => original.chains.slice().reverse().join(' :: '),
    },
    {
      header: () => t('connectTime'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
      accessorFn: (original) => formatTimeFromNow(original.start),
      sortingFn: (prev, next) =>
        dayjs(prev.original.start).valueOf() -
        dayjs(next.original.start).valueOf(),
    },
    {
      header: () => t('dlSpeed'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
      accessorFn: (original) => `${byteSize(original.downloadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.downloadSpeed - next.original.downloadSpeed,
    },
    {
      header: () => t('ulSpeed'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ULSpeed,
      accessorFn: (original) => `${byteSize(original.uploadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.uploadSpeed - next.original.uploadSpeed,
    },
    {
      header: () => t('dl'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
      accessorFn: (original) => byteSize(original.download),
      sortingFn: (prev, next) =>
        prev.original.download - next.original.download,
    },
    {
      header: () => t('ul'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
      accessorFn: (original) => byteSize(original.upload),
      sortingFn: (prev, next) => prev.original.upload - next.original.upload,
    },
    {
      header: () => t('sourceIP'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP,
      accessorFn: (original) => original.metadata.sourceIP,
    },
    {
      header: () => t('sourcePort'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort,
      accessorFn: (original) => original.metadata.sourcePort,
    },
    {
      header: () => t('destination'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
      accessorFn: (original) =>
        original.metadata.remoteDestination ||
        original.metadata.destinationIP ||
        original.metadata.host,
    },
  ])

  const [grouping, setGrouping] = createSignal<GroupingState>([])
  const [sorting, setSorting] = makePersisted(
    createSignal<SortingState>([
      { id: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime, desc: true },
    ]),
    { name: 'connectionsTableSorting', storage: localStorage },
  )

  const table = createSolidTable({
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      get columnOrder() {
        return columnOrder()
      },
      get grouping() {
        return grouping()
      },
      get sorting() {
        return sorting()
      },
      get columnVisibility() {
        return columnVisibility()
      },
      get globalFilter() {
        return globalFilter()
      },
      get columnFilters() {
        return []
      },
    },
    get data() {
      return activeTab() === ActiveTab.activeConnections
        ? activeConnections()
        : closedConnections()
    },
    sortDescFirst: true,
    enableHiding: true,
    columns: columns(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: fuzzyFilter,
    onGroupingChange: setGrouping,
    onSortingChange: setSorting,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  })

  const tabs = createMemo(() => [
    {
      type: ActiveTab.activeConnections,
      name: t('active'),
      count: activeConnections().length,
    },
    {
      type: ActiveTab.closedConnections,
      name: t('closed'),
      count: closedConnections().length,
    },
  ])

  return (
    <div class="flex h-full flex-col gap-2">
      <div class="flex w-full flex-wrap items-center gap-2">
        <div class="tabs-boxed tabs gap-2">
          <Index each={tabs()}>
            {(tab) => (
              <button
                class={twMerge(
                  activeTab() === tab().type && 'tab-active',
                  'tab tab-sm gap-2 sm:tab-md',
                )}
                onClick={() => setActiveTab(tab().type)}
              >
                <span>{tab().name}</span>
                <div class="badge badge-sm">{tab().count}</div>
              </button>
            )}
          </Index>
        </div>

        <div class="join flex w-full items-center md:flex-1">
          <input
            type="search"
            class="input join-item input-primary input-sm min-w-0 flex-1 sm:input-md"
            placeholder={t('search')}
            onInput={(e) => setGlobalFilter(e.target.value)}
          />

          <Button
            class="join-item btn-sm sm:btn-md"
            onClick={() => setPaused((paused) => !paused)}
          >
            {paused() ? <IconPlayerPlay /> : <IconPlayerPause />}
          </Button>

          <Button
            class="join-item btn-sm sm:btn-md"
            onClick={() => {
              if (table.getState().globalFilter) {
                table
                  .getFilteredRowModel()
                  .rows.forEach(({ id }) => closeSingleConnectionAPI(id))
              } else {
                closeAllConnectionsAPI()
              }
            }}
          >
            <IconX />
          </Button>

          <Button
            class="btn join-item btn-sm sm:btn-md"
            onClick={() => {
              const modal = document.querySelector(
                '#connections-table-ordering-modal',
              ) as HTMLDialogElement | null

              modal?.showModal()
            }}
          >
            <IconSettings />
          </Button>
        </div>
      </div>

      <div class="overflow-x-auto whitespace-nowrap rounded-md bg-base-300">
        <table
          class={twMerge(
            tableSizeClassName(tableSize()),
            'table table-zebra relative rounded-none',
          )}
        >
          <thead class="sticky top-0 z-10 h-8">
            <For each={table.getHeaderGroups()}>
              {(headerGroup) => (
                <tr>
                  <For each={headerGroup.headers}>
                    {(header) => (
                      <th class="bg-base-200">
                        <div class={twMerge('flex items-center gap-2')}>
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
                    )}
                  </For>
                </tr>
              )}
            </For>
          </thead>

          <tbody>
            <For each={table.getRowModel().rows}>
              {(row) => (
                <tr class="h-8 hover:!bg-primary hover:text-primary-content">
                  <For each={row.getVisibleCells()}>
                    {(cell) => {
                      return (
                        <td
                          onContextMenu={(e) => {
                            e.preventDefault()

                            const value = cell.renderValue() as null | string
                            value && writeClipboard(value).catch(() => {})
                          }}
                        >
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
                      )
                    }}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <ConnectionsTableOrderingModal
        order={columnOrder()}
        visible={columnVisibility()}
        onOrderChange={(data: ColumnOrder) => setColumnOrder(data)}
        onVisibleChange={(data: ColumnVisibility) =>
          setColumnVisibility({ ...data })
        }
      />

      <ConnectionsTableDetailsModal
        selectedConnectionID={selectedConnectionID()}
      />
    </div>
  )
}
