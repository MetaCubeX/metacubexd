import { makePersisted } from '@solid-primitives/storage'
import { IconChevronRight, IconInfoSmall, IconX } from '@tabler/icons-solidjs'
import {
  ColumnDef,
  createSolidTable,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  GroupingState,
  SortingState,
} from '@tanstack/solid-table'
import byteSize from 'byte-size'
import dayjs from 'dayjs'
import { closeSingleConnectionAPI } from '~/apis'
import { Button } from '~/components'
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import { formatIPv6, formatTimeFromNow, fuzzyFilter } from '~/helpers'
import { useI18n } from '~/i18n'
import type { Dict } from '~/i18n/dict'
import {
  clientSourceIPTags,
  connectionsTableColumnOrder,
  connectionsTableColumnVisibility,
  quickFilterRegex,
  useConnections,
} from '~/signals'
import type { Connection } from '~/types'
import { ActiveTab } from './ConnectionsToolbar'

type ColMeta = { headerKey: keyof Dict }

interface UseConnectionsTableOptions {
  onShowDetails: (id: string) => void
}

export const useConnectionsTable = (options: UseConnectionsTableOptions) => {
  const [t] = useI18n()

  const { activeConnections, closedConnections, paused, setPaused } =
    useConnections()

  const [activeTab, setActiveTab] = createSignal(ActiveTab.activeConnections)
  const [globalFilter, setGlobalFilter] = createSignal('')
  const [enableQuickFilter, setEnableQuickFilter] = makePersisted(
    createSignal(false),
    { name: 'enableQuickFilter', storage: localStorage },
  )

  const [grouping, setGrouping] = createSignal<GroupingState>([])
  const [sorting, setSorting] = makePersisted(
    createSignal<SortingState>([
      { id: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime, desc: true },
    ]),
    { name: 'connectionsTableSorting', storage: localStorage },
  )

  const [pageSize, setPageSize] = makePersisted(createSignal(50), {
    name: 'connectionsTablePageSize',
    storage: localStorage,
  })

  // Memoize filtered data to avoid unnecessary recalculations
  const filteredData = createMemo(() => {
    const rawConnections =
      activeTab() === ActiveTab.activeConnections
        ? activeConnections()
        : closedConnections()

    // Create a copy to avoid mutating the original signal array
    const connections = rawConnections
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))

    if (!enableQuickFilter()) {
      return connections
    }

    try {
      const reg = new RegExp(quickFilterRegex(), 'i')

      return connections.filter(
        (connection) => !reg.test(connection.chains.join('')),
      )
    } catch {
      // Invalid regex, return all connections
      return connections
    }
  })

  // Column definitions
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
        <div class="flex items-center">
          <Button
            class="btn-circle btn-xs"
            onClick={() => options.onShowDetails(row.original.id)}
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
        <div class="flex items-center">
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

  // Create table instance
  const table = createSolidTable({
    filterFns: { fuzzy: fuzzyFilter },
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
      return filteredData()
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: pageSize() },
    },
  })

  // Sync page size changes
  createEffect(() => {
    table.setPageSize(pageSize())
  })

  // Sort controls
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

  // Sortable columns
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

  // Source IP filter
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

  // Tabs data
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

  // Visible pages for pagination
  const visiblePages = createMemo(() => {
    const current = table.getState().pagination.pageIndex
    const total = table.getPageCount()
    const pages: number[] = []

    pages.push(0)

    for (
      let i = Math.max(1, current - 1);
      i <= Math.min(total - 2, current + 1);
      i++
    ) {
      if (!pages.includes(i)) pages.push(i)
    }

    if (total > 1 && !pages.includes(total - 1)) {
      pages.push(total - 1)
    }

    return pages.sort((a, b) => a - b)
  })

  return {
    table,
    // Tab state
    activeTab,
    setActiveTab,
    tabs,
    // Filter state
    enableQuickFilter,
    setEnableQuickFilter,
    globalFilter,
    setGlobalFilter,
    sourceIPFilter,
    setSourceIPFilter,
    // Sort state
    sorting,
    setSorting,
    sortColumn,
    setSortColumn,
    sortDesc,
    setSortDesc,
    sortables,
    // Pagination state
    pageSize,
    setPageSize,
    visiblePages,
    // Connection state
    paused,
    setPaused,
  }
}
