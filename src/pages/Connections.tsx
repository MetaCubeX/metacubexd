import { writeClipboard } from '@solid-primitives/clipboard'
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
import { uniq } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { closeAllConnectionsAPI, closeSingleConnectionAPI } from '~/apis'
import {
  Button,
  ConnectionsSettingsModal,
  ConnectionsTableDetailsModal,
  DocumentTitle,
} from '~/components'
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import { formatTimeFromNow } from '~/helpers'
import { useI18n } from '~/i18n'
import {
  allConnections,
  clientSourceIPTags,
  connectionsTableColumnOrder,
  connectionsTableColumnVisibility,
  connectionsTableSize,
  endpoint,
  quickFilterRegex,
  setConnectionsTableColumnOrder,
  setConnectionsTableColumnVisibility,
  tableSizeClassName,
  useConnections,
} from '~/signals'
import type { Connection } from '~/types'

enum ActiveTab {
  activeConnections,
  closedConnections,
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
  const navigate = useNavigate()

  if (!endpoint()) {
    navigate('/setup', { replace: true })

    return null
  }

  let connectionsSettingsModalRef: HTMLDialogElement | undefined
  let connectionsDetailsModalRef: HTMLDialogElement | undefined

  const [t] = useI18n()

  const [activeTab, setActiveTab] = createSignal(ActiveTab.activeConnections)
  const { activeConnections, closedConnections, paused, setPaused } =
    useConnections()
  const [isClosingConnections, setIsClosingConnections] = createSignal(false)

  const [globalFilter, setGlobalFilter] = createSignal('')
  const [enableQuickFilter, setEnableQuickFilter] = makePersisted(
    createSignal(false),
    {
      name: 'enableQuickFilter',
      storage: localStorage,
    },
  )
  const [selectedConnectionID, setSelectedConnectionID] = createSignal<string>()

  const columns: ColumnDef<Connection>[] = [
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

              connectionsDetailsModalRef?.showModal()
            }}
            icon={<IconInfoSmall size="16" />}
          />
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
            icon={<IconX size="16" />}
          />
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
      header: () => t('sniffHost'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost,
      accessorFn: (original) => original.metadata.sniffHost || '-',
    },
    {
      header: () => t('rule'),
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
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
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
      accessorFn: (original) => {
        const src = original.metadata.sourceIP || t('inner')
        const tag = clientSourceIPTags().find((tag) => tag.sourceIP === src)

        return tag?.tagName || src
      },
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
    {
      header: () => t('inboundUser'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser,
      accessorFn: (original) =>
        original.metadata.inboundUser ||
        original.metadata.inboundName ||
        original.metadata.inboundPort,
    },
  ]

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
        return connectionsTableColumnOrder()
      },
      get grouping() {
        return grouping()
      },
      get sorting() {
        return sorting()
      },
      get columnVisibility() {
        return connectionsTableColumnVisibility()
      },
      get globalFilter() {
        return globalFilter()
      },
    },
    get data() {
      const connections =
        activeTab() === ActiveTab.activeConnections
          ? activeConnections()
          : closedConnections()

      connections.sort((a, b) => {
        return a.id.localeCompare(b.id)
      })

      if (!enableQuickFilter()) {
        return connections
      }

      const reg = new RegExp(quickFilterRegex(), 'i')

      return connections.filter(
        (connection) => !reg.test(connection.chains.join('')),
      )
    },
    sortDescFirst: true,
    enableHiding: true,
    columns,
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

  const sourceIPHeader = table
    .getFlatHeaders()
    .find(({ id }) => id === CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP)

  const [sourceIPFilter, setSourceIPFilter] = createSignal('')

  createEffect(
    on(sourceIPFilter, () => {
      const tagged = clientSourceIPTags().find(
        (tag) => tag.sourceIP === sourceIPFilter(),
      )

      sourceIPHeader?.column.setFilterValue(
        tagged ? tagged.tagName : sourceIPFilter(),
      )
    }),
  )

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
    <>
      <DocumentTitle>{t('connections')}</DocumentTitle>

      <div class="flex h-full flex-col gap-2">
        <div class="flex w-full flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <div class="tabs-boxed tabs gap-2">
              <Index each={tabs()}>
                {(tab) => (
                  <button
                    class={twMerge(
                      activeTab() === tab().type && 'tab-active',
                      'tab-sm sm:tab-md tab gap-2 px-2',
                    )}
                    onClick={() => setActiveTab(tab().type)}
                  >
                    <span>{tab().name}</span>
                    <div class="badge badge-sm">{tab().count}</div>
                  </button>
                )}
              </Index>
            </div>

            <div class="flex items-center">
              <span class="mr-2 hidden lg:inline-block">
                {t('quickFilter')}:
              </span>
              <input
                type="checkbox"
                class="toggle"
                checked={enableQuickFilter()}
                onChange={(e) => setEnableQuickFilter(e.target.checked)}
              />
            </div>

            <select
              class="select select-bordered select-primary select-sm w-full max-w-full flex-1"
              onChange={(e) => setSourceIPFilter(e.target.value)}
            >
              <option value="">{t('all')}</option>

              <Index
                each={uniq(
                  allConnections().map(({ metadata: { sourceIP } }) => {
                    const src = sourceIP || t('inner')
                    const tagged = clientSourceIPTags().find(
                      (tag) => tag.sourceIP === src,
                    )

                    return tagged?.tagName || src
                  }),
                ).sort()}
              >
                {(sourceIP) => <option value={sourceIP()}>{sourceIP()}</option>}
              </Index>
            </select>
          </div>

          <div class="join flex flex-1 items-center">
            <input
              type="search"
              class="input input-sm join-item input-primary min-w-0 flex-1"
              placeholder={t('search')}
              onInput={(e) => setGlobalFilter(e.target.value)}
            />

            <Button
              class="btn btn-primary join-item btn-sm"
              onClick={() => setPaused((paused) => !paused)}
              icon={paused() ? <IconPlayerPlay /> : <IconPlayerPause />}
            />

            <Button
              class="btn btn-primary join-item btn-sm"
              onClick={async () => {
                setIsClosingConnections(true)

                if (table.getState().globalFilter) {
                  await Promise.allSettled(
                    table
                      .getFilteredRowModel()
                      .rows.map(({ original }) =>
                        closeSingleConnectionAPI(original.id),
                      ),
                  )
                } else {
                  await closeAllConnectionsAPI()
                }

                setIsClosingConnections(false)
              }}
              icon={
                isClosingConnections() ? (
                  <div class="loading loading-spinner" />
                ) : (
                  <IconX />
                )
              }
            />

            <Button
              class="btn btn-primary join-item btn-sm"
              onClick={() => connectionsSettingsModalRef?.showModal()}
              icon={<IconSettings />}
            />
          </div>
        </div>

        <div class="overflow-x-auto whitespace-nowrap rounded-md bg-base-300">
          <table
            class={twMerge(
              tableSizeClassName(connectionsTableSize()),
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
                  <tr class="hover:!bg-primary hover:text-primary-content">
                    <For each={row.getVisibleCells()}>
                      {(cell) => {
                        return (
                          <td
                            class="py-2"
                            onContextMenu={(e) => {
                              e.preventDefault()

                              const value = cell.renderValue() as null | string

                              if (value) writeClipboard(value).catch(() => {})
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

        <ConnectionsSettingsModal
          ref={(el) => (connectionsSettingsModalRef = el)}
          order={connectionsTableColumnOrder()}
          visible={connectionsTableColumnVisibility()}
          onOrderChange={(data) => setConnectionsTableColumnOrder(data)}
          onVisibleChange={(data) =>
            setConnectionsTableColumnVisibility({ ...data })
          }
        />

        <ConnectionsTableDetailsModal
          ref={(el) => (connectionsDetailsModalRef = el)}
          selectedConnectionID={selectedConnectionID()}
        />
      </div>
    </>
  )
}
