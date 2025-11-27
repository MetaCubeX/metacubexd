import { makePersisted } from '@solid-primitives/storage'
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
} from '@tabler/icons-solidjs'
import {
  ColumnDef,
  GroupingState,
  SortingState,
  createSolidTable,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
} from '@tanstack/solid-table'
import {
  DataTable,
  Button,
  DocumentTitle,
  LogsSettingsModal,
} from '~/components'
import { LOG_LEVEL } from '~/constants'
import { fuzzyFilter } from '~/helpers'
import { useI18n } from '~/i18n'
import { logsTableSize, useLogs } from '~/signals'
import { LogWithSeq } from '~/types'

export default () => {
  let logsSettingsModalRef: HTMLDialogElement | undefined
  const [t] = useI18n()
  const [globalFilter, setGlobalFilter] = createSignal('')
  const { logs, paused, setPaused } = useLogs()

  const [sorting, setSorting] = makePersisted(createSignal<SortingState>([]), {
    name: 'logsTableSorting',
    storage: localStorage,
  })

  const [grouping, setGrouping] = createSignal<GroupingState>([])

  // Extract type from payload, e.g. "[dns] xxx" -> "dns"
  const extractType = (payload: string) => {
    const match = payload.match(/^\[([^\]]+)\]/)

    return match ? match[1] : ''
  }

  const columns: ColumnDef<LogWithSeq>[] = [
    {
      id: 'seq',
      header: t('sequence'),
      accessorFn: (row) => row.seq,
      enableGrouping: false,
    },
    {
      id: 'level',
      header: t('level'),
      accessorFn: (row) => row.type,
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
      id: 'type',
      header: t('type'),
      accessorFn: (row) => extractType(row.payload),
      cell: ({ row }) => {
        const logType = extractType(row.original.payload)

        return logType ? <span class="opacity-70">{logType}</span> : null
      },
    },
    {
      id: 'payload',
      header: t('payload'),
      accessorFn: (row) => row.payload,
      enableGrouping: false,
    },
  ]

  const table = createSolidTable({
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    state: {
      get globalFilter() {
        return globalFilter()
      },
      get sorting() {
        return sorting()
      },
      get grouping() {
        return grouping()
      },
    },
    get data() {
      return logs()
    },
    sortDescFirst: true,
    columns,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onGroupingChange: setGrouping,
    globalFilterFn: fuzzyFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <DocumentTitle>{t('logs')}</DocumentTitle>

      <div class="flex h-full flex-col gap-2">
        <div class="join w-full">
          <input
            type="search"
            class="input input-sm join-item flex-1 shrink-0 input-primary"
            placeholder={t('search')}
            onInput={(e) => setGlobalFilter(e.target.value)}
          />

          <Button
            class="join-item btn-sm btn-primary"
            onClick={() => setPaused((paused) => !paused)}
            icon={paused() ? <IconPlayerPlay /> : <IconPlayerPause />}
          />
          <Button
            class="join-item btn-sm btn-primary"
            onClick={() => logsSettingsModalRef?.showModal()}
            icon={<IconSettings />}
          />
        </div>

        <div class="overflow-x-auto rounded-md bg-base-300 whitespace-nowrap">
          <DataTable
            table={table}
            size={logsTableSize()}
            stickyHeader
            rowHover
            cellClass="py-2"
          />
        </div>

        <LogsSettingsModal ref={(el) => (logsSettingsModalRef = el)} />
      </div>
    </>
  )
}
