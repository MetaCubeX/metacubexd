import {
  ConnectionsSettingsModal,
  ConnectionsTableDetailsModal,
  DocumentTitle,
} from '~/components'
import {
  connectionsTableColumnOrder,
  connectionsTableColumnVisibility,
  setConnectionsTableColumnOrder,
  setConnectionsTableColumnVisibility,
} from '~/signals'
import { useI18n } from '~/i18n'
import { ConnectionsToolbar } from './ConnectionsToolbar'
import { ConnectionsTable } from './ConnectionsTable'
import { MobilePagination, DesktopPagination } from './ConnectionsPagination'
import { useConnectionsTable } from './useConnectionsTable'

export default () => {
  const [t] = useI18n()

  let connectionsSettingsModalRef: HTMLDialogElement | undefined
  let connectionsDetailsModalRef: HTMLDialogElement | undefined

  const [selectedConnectionID, setSelectedConnectionID] = createSignal<string>()

  const {
    table,
    activeTab,
    setActiveTab,
    tabs,
    enableQuickFilter,
    setEnableQuickFilter,
    setGlobalFilter,
    setSourceIPFilter,
    setSorting,
    sortColumn,
    setSortColumn,
    sortDesc,
    setSortDesc,
    sortables,
    pageSize,
    setPageSize,
    visiblePages,
    paused,
    setPaused,
  } = useConnectionsTable({
    onShowDetails: (id) => {
      setSelectedConnectionID(id)
      connectionsDetailsModalRef?.showModal()
    },
  })

  return (
    <>
      <DocumentTitle>{t('connections')}</DocumentTitle>

      <div class="flex h-full flex-col gap-2">
        {/* Toolbar */}
        <ConnectionsToolbar
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          enableQuickFilter={enableQuickFilter}
          setEnableQuickFilter={setEnableQuickFilter}
          setSourceIPFilter={setSourceIPFilter}
          sortColumn={sortColumn}
          setSortColumn={setSortColumn}
          sortDesc={sortDesc}
          setSortDesc={setSortDesc}
          setSorting={setSorting}
          sortables={sortables}
          setGlobalFilter={setGlobalFilter}
          paused={paused}
          setPaused={setPaused}
          table={table}
          onOpenSettings={() => connectionsSettingsModalRef?.showModal()}
        />

        {/* Mobile Pagination - Top */}
        <MobilePagination table={table} visiblePages={visiblePages} />

        {/* Table */}
        <ConnectionsTable table={table} />

        {/* Desktop Pagination - Bottom */}
        <DesktopPagination
          table={table}
          visiblePages={visiblePages}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />

        {/* Modals */}
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
