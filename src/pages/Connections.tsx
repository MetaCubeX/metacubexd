import { writeClipboard } from '@solid-primitives/clipboard'
import { makePersisted } from '@solid-primitives/storage'
import {
  IconChevronRight,
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
  createSolidTable,
  FilterFn,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  GroupingState,
  SortingState,
} from '@tanstack/solid-table'
import byteSize from 'byte-size'
import dayjs from 'dayjs'
import { uniq } from 'lodash'
import { twMerge } from 'tailwind-merge'
import { Virtualizer } from 'virtua/solid'
import { closeAllConnectionsAPI, closeSingleConnectionAPI } from '~/apis'
import {
  Button,
  ConnectionsSettingsModal,
  ConnectionsTableDetailsModal,
  DocumentTitle,
} from '~/components'
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import { formatIPv6, formatTimeFromNow } from '~/helpers'
import { useI18n } from '~/i18n'
import type { Dict } from '~/i18n/dict'
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

type ColMeta = { headerKey: keyof Dict }

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
      meta: { headerKey: 'details' },
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
      meta: { headerKey: 'close' },
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
      meta: { headerKey: 'ID' },
      header: () => t('ID'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ID,
      accessorFn: (original) => original.id,
    },
    {
      meta: { headerKey: 'type' },
      header: () => t('type'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
      accessorFn: (original) =>
        `${original.metadata.type}(${original.metadata.network})`,
    },
    {
      meta: { headerKey: 'process' },
      header: () => t('process'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
      accessorFn: (original) =>
        original.metadata.process ||
        original.metadata.processPath.replace(/^.*[/\\](.*)$/, '$1') ||
        '-',
    },
    {
      meta: { headerKey: 'host' },
      header: () => t('host'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
      accessorFn: (original) =>
        `${
          original.metadata.host
            ? original.metadata.host
            : formatIPv6(original.metadata.destinationIP)
        }:${original.metadata.destinationPort}`,
    },
    {
      meta: { headerKey: 'sniffHost' },
      header: () => t('sniffHost'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost,
      accessorFn: (original) => original.metadata.sniffHost || '-',
    },
    {
      meta: { headerKey: 'rule' },
      header: () => t('rule'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
      accessorFn: (original) =>
        !original.rulePayload
          ? original.rule
          : `${original.rule} : ${original.rulePayload}`,
    },
    {
      meta: { headerKey: 'chains' },
      header: () => t('chains'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
      cell: ({ row }) => (
        <For each={row.original.chains.slice().reverse()}>
          {(name, index) => (
            <>
              <Show when={index()}>
                <IconChevronRight class="inline-block" size={18} />
              </Show>
              <span class="align-middle">{name}</span>
            </>
          )}
        </For>
      ),
    },
    {
      meta: { headerKey: 'connectTime' },
      header: () => t('connectTime'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
      accessorFn: (original) => formatTimeFromNow(original.start),
      sortingFn: (prev, next) =>
        dayjs(prev.original.start).valueOf() -
        dayjs(next.original.start).valueOf(),
    },
    {
      meta: { headerKey: 'dlSpeed' },
      header: () => t('dlSpeed'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
      accessorFn: (original) => `${byteSize(original.downloadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.downloadSpeed - next.original.downloadSpeed,
    },
    {
      meta: { headerKey: 'ulSpeed' },
      header: () => t('ulSpeed'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
      accessorFn: (original) => `${byteSize(original.uploadSpeed)}/s`,
      sortingFn: (prev, next) =>
        prev.original.uploadSpeed - next.original.uploadSpeed,
    },
    {
      meta: { headerKey: 'dl' },
      header: () => t('dl'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
      accessorFn: (original) => byteSize(original.download),
      sortingFn: (prev, next) =>
        prev.original.download - next.original.download,
    },
    {
      meta: { headerKey: 'ul' },
      header: () => t('ul'),
      enableGrouping: false,
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
      accessorFn: (original) => byteSize(original.upload),
      sortingFn: (prev, next) => prev.original.upload - next.original.upload,
    },
    {
      meta: { headerKey: 'sourceIP' },
      header: () => t('sourceIP'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP,
      accessorFn: (original) => {
        const src = original.metadata.sourceIP || t('inner')
        const tag = clientSourceIPTags().find((tag) => tag.sourceIP === src)

        return tag?.tagName || src
      },
    },
    {
      meta: { headerKey: 'sourcePort' },
      header: () => t('sourcePort'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort,
      accessorFn: (original) => original.metadata.sourcePort,
    },
    {
      meta: { headerKey: 'destination' },
      header: () => t('destination'),
      accessorKey: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
      accessorFn: (original) =>
        original.metadata.remoteDestination ||
        original.metadata.destinationIP ||
        original.metadata.host,
    },
    {
      meta: { headerKey: 'inboundUser' },
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

  // Sort controls state synced with table sorting
  const [sortColumn, setSortColumn] = createSignal<string>(
    sorting()[0]?.id || CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
  )
  const [sortDesc, setSortDesc] = createSignal<boolean>(
    sorting()[0]?.desc ?? true,
  )

  createEffect(
    on(sorting, () => {
      const s = sorting()

      if (s.length) {
        setSortColumn(s[0].id)
        setSortDesc(!!s[0].desc)
      }
    }),
  )

  const sortables = createMemo(
    () =>
      table
        .getAllLeafColumns()
        .filter((c) => c.getCanSort())
        .map((c) => ({
          id: c.id,
          key: (c.columnDef.meta as ColMeta | undefined)?.headerKey as
            | keyof Dict
            | undefined,
        }))
        .filter((x) => !!x.key) as { id: string; key: keyof Dict }[],
  )

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

  let scrollRef: HTMLDivElement | undefined

  return (
    <>
      <DocumentTitle>{t('connections')}</DocumentTitle>

      <div class="flex h-full flex-col gap-2">
        <div class="flex w-full flex-wrap items-center gap-2">
          <div class="flex items-center gap-2">
            <div class="tabs-box tabs gap-2 tabs-sm">
              <Index each={tabs()}>
                {(tab) => (
                  <button
                    class={twMerge(
                      activeTab() === tab().type && 'bg-primary text-neutral!',
                      'tab gap-2 px-2',
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
              class="select flex-1 select-sm select-primary"
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

          {/* Sort controls */}
          <div class="flex items-center gap-2">
            <span class="w-32 text-sm sm:inline-block">{t('sortBy')}</span>
            <select
              class="select select-sm select-primary"
              value={sortColumn()}
              onChange={(e) => {
                const id = e.target.value
                setSortColumn(id)
                setSorting([{ id, desc: sortDesc() }])
              }}
            >
              <Index each={sortables()}>
                {(opt) => <option value={opt().id}>{t(opt().key)}</option>}
              </Index>
            </select>
            <Button
              class="btn btn-sm btn-primary"
              onClick={() => {
                const next = !sortDesc()
                setSortDesc(next)
                setSorting([{ id: sortColumn(), desc: next }])
              }}
              icon={sortDesc() ? <IconSortDescending /> : <IconSortAscending />}
            />
          </div>

          <div class="join flex flex-1 items-center">
            <input
              type="search"
              class="input input-sm join-item flex-1 input-primary"
              placeholder={t('search')}
              onInput={(e) => setGlobalFilter(e.target.value)}
            />

            <Button
              class="btn join-item btn-sm btn-primary"
              onClick={() => setPaused((paused) => !paused)}
              icon={paused() ? <IconPlayerPlay /> : <IconPlayerPause />}
            />

            <Button
              class="btn join-item btn-sm btn-primary"
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
              class="btn join-item btn-sm btn-primary"
              onClick={() => connectionsSettingsModalRef?.showModal()}
              icon={<IconSettings />}
            />
          </div>
        </div>

        <div
          class="h-full overflow-x-auto rounded-md bg-base-300"
          ref={scrollRef}
        >
          <table
            class={twMerge(
              tableSizeClassName(connectionsTableSize()),
              'table-pin-rows table table-zebra',
            )}
          >
            <thead class="hidden md:table-header-group">
              <For each={table.getHeaderGroups()}>
                {(headerGroup) => (
                  <tr class="flex">
                    <For each={headerGroup.headers}>
                      {(header) => (
                        <th class="w-36 min-w-36 bg-base-200 sm:w-40 sm:min-w-40 md:w-44 md:min-w-44 lg:w-48 lg:min-w-48">
                          <div
                            class={twMerge(
                              'flex items-center gap-2 text-justify',
                            )}
                          >
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
                                'justify flex-1 text-xs wrap-break-word whitespace-normal',
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

            <Virtualizer
              scrollRef={scrollRef}
              data={table.getRowModel().rows}
              as="tbody"
              item={(props) => (
                <tr {...props} class="flex flex-wrap md:table-row" />
              )}
            >
              {(row) => (
                <For each={row.getVisibleCells()}>
                  {(cell) => {
                    return (
                      <td
                        class="w-1/2 min-w-[50%] py-2 text-justify align-top wrap-break-word nth-[2n]:text-right sm:w-1/3 sm:min-w-[33.333%] sm:nth-[2n]:text-justify sm:nth-[3n]:text-right md:inline-block md:w-44 md:min-w-44 md:text-start lg:w-48 lg:min-w-48"
                        onContextMenu={(e) => {
                          e.preventDefault()

                          const value = cell.renderValue() as null | string

                          if (value) writeClipboard(value).catch(() => {})
                        }}
                      >
                        {/* Mobile label */}
                        <div class="justify mb-1 text-[10px] text-base-content/60 uppercase md:hidden">
                          {(() => {
                            const key = (
                              cell.column.columnDef.meta as ColMeta | undefined
                            )?.headerKey

                            return key ? t(key) : ''
                          })()}
                        </div>
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
              )}
            </Virtualizer>
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
