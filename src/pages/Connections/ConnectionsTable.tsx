import { writeClipboard } from '@solid-primitives/clipboard'
import type { Cell, Table } from '@tanstack/solid-table'
import { DataTable } from '~/components'
import { useI18n } from '~/i18n'
import type { Dict } from '~/i18n/dict'
import { connectionsTableSize } from '~/signals'
import type { Connection } from '~/types'

type ColMeta = { headerKey: keyof Dict }

interface ConnectionsTableProps {
  table: Table<Connection>
}

export const ConnectionsTable = (props: ConnectionsTableProps) => {
  const [t] = useI18n()

  const handleCellContextMenu = (
    cell: Cell<Connection, unknown>,
    e: MouseEvent,
  ) => {
    e.preventDefault()

    const value = cell.renderValue() as null | string

    if (value) writeClipboard(value).catch(() => {})
  }

  const renderMobileLabel = (cell: Cell<Connection, unknown>) => {
    const key = (cell.column.columnDef.meta as ColMeta | undefined)?.headerKey

    return key ? t(key) : ''
  }

  return (
    <div class="flex-1 overflow-x-auto rounded-md bg-base-300">
      <DataTable
        table={props.table}
        size={connectionsTableSize()}
        pinRows
        rowHover
        zebra
        hideHeaderOnMobile
        rowClass="even:bg-base-500 flex flex-wrap rounded-xl border-4 border-base-300 px-2 odd:bg-base-100 md:table-row md:rounded-none md:border-0 md:px-0"
        cellClass="w-1/2 min-w-[50%] pb-1.5 text-justify align-top wrap-break-word nth-[2n]:text-right nth-last-[2]:mb-3 sm:w-1/3 sm:min-w-[33.333%] sm:nth-[2n]:text-justify sm:nth-[3n]:text-right md:w-auto md:min-w-0 md:text-start md:align-middle md:whitespace-nowrap md:nth-[2n]:text-start md:nth-[3n]:text-start md:nth-last-[2]:mb-0"
        onCellContextMenu={handleCellContextMenu}
        renderMobileLabel={renderMobileLabel}
      />
    </div>
  )
}
