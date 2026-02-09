<script setup lang="ts">
import type { VNode } from 'vue'
import type { ConnectionColumn, TableRow } from '~/components/connections'
import type { Connection } from '~/types'
import { IconChevronRight, IconX } from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { uniq } from 'lodash-es'
import {
  closeAllConnectionsAPI,
  closeSingleConnectionAPI,
} from '~/composables/useApi'
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '~/constants'
import { formatIPv6, formatTimeFromNow } from '~/utils'

const { t, locale } = useI18n()

useHead({ title: computed(() => t('connections')) })
const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()

// Modals
const settingsModal = ref<{ open: () => void; close: () => void }>()
const detailsModal = ref<{ open: () => void; close: () => void }>()
const selectedConnection = ref<Connection | null>(null)

// Tab state
const activeTab = ref<'active' | 'closed'>('active')

// Filter state
const globalFilter = ref('')
const enableQuickFilter = useLocalStorage('enableQuickFilter', false)
const sourceIPFilter = ref('')

// Sort state
const sortColumn = useLocalStorage('connectionsTableSortColumn', 'ConnectTime')
const sortDesc = useLocalStorage('connectionsTableSortDesc', true)

// Grouping state
const groupingColumn = useLocalStorage<string | null>(
  'connectionsTableGrouping',
  null,
)
const expandedGroups = ref<Record<string, boolean>>({})

// Pagination state
const currentPage = ref(0)
const pageSize = useLocalStorage('connectionsTablePageSize', 50)

// Close connections
const isClosingConnections = ref(false)

// Helpers
const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Cell value helpers
function getProcess(conn: Connection) {
  return (
    conn.metadata.process ||
    conn.metadata.processPath?.replace(/^.*[/\\](.*)$/, '$1') ||
    '-'
  )
}

function getHost(conn: Connection) {
  return `${conn.metadata.host || formatIPv6(conn.metadata.destinationIP)}:${conn.metadata.destinationPort}`
}

function getRule(conn: Connection) {
  return !conn.rulePayload ? conn.rule : `${conn.rule} : ${conn.rulePayload}`
}

function getSourceIP(conn: Connection) {
  const src = conn.metadata.sourceIP || t('inner')
  const tag = configStore.clientSourceIPTags.find((tag) => tag.sourceIP === src)
  return tag?.tagName || src
}

function getDestination(conn: Connection) {
  return (
    conn.metadata.remoteDestination ||
    conn.metadata.destinationIP ||
    conn.metadata.host
  )
}

function getInboundUser(conn: Connection) {
  return (
    conn.metadata.inboundUser ||
    conn.metadata.inboundIP ||
    conn.metadata.inboundName ||
    conn.metadata.type ||
    "-"
  )
}

// Close connection handler for render function
function closeConnection(id: string) {
  closeSingleConnectionAPI(id)
}

// Column definitions with render functions
const allColumns: ConnectionColumn[] = [
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    key: 'close',
    groupable: false,
    sortable: false,
    render: (conn: Connection) =>
      h(
        'button',
        {
          class: 'conn-close-btn',
          onClick: (e: Event) => {
            e.stopPropagation()
            closeConnection(conn.id)
          },
        },
        h(IconX, { size: 14 }),
      ),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
    key: 'type',
    groupable: true,
    sortable: true,
    sortId: 'Type',
    render: (conn: Connection) =>
      `${conn.metadata.type}(${conn.metadata.network})`,
    groupValue: (conn: Connection) =>
      `${conn.metadata.type}(${conn.metadata.network})`,
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
    key: 'process',
    groupable: true,
    sortable: true,
    sortId: 'Process',
    render: (conn: Connection) => getProcess(conn),
    groupValue: (conn: Connection) => getProcess(conn),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
    key: 'host',
    groupable: true,
    sortable: true,
    sortId: 'Host',
    render: (conn: Connection) => getHost(conn),
    groupValue: (conn: Connection) => getHost(conn),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.SniffHost,
    key: 'sniffHost',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => conn.metadata.sniffHost || '-',
    groupValue: (conn: Connection) => conn.metadata.sniffHost || '-',
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
    key: 'rule',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => getRule(conn),
    groupValue: (conn: Connection) => getRule(conn),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    key: 'chains',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => {
      const reversed = [...conn.chains].reverse()
      const children: VNode[] = []
      reversed.forEach((name, index) => {
        if (index > 0) {
          children.push(
            h(IconChevronRight, { class: 'inline-block', size: 18 }),
          )
        }
        children.push(h('span', { class: 'align-middle' }, name))
      })
      return h('span', children)
    },
    groupValue: (conn: Connection) => conn.chains.join(' > '),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
    key: 'connectTime',
    groupable: false,
    sortable: true,
    sortId: 'ConnectTime',
    render: (conn: Connection) => formatTimeFromNow(conn.start, locale.value),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
    key: 'dlSpeed',
    groupable: false,
    sortable: true,
    sortId: 'DlSpeed',
    render: (conn: Connection) => `${formatBytes(conn.downloadSpeed)}/s`,
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
    key: 'ulSpeed',
    groupable: false,
    sortable: true,
    sortId: 'UlSpeed',
    render: (conn: Connection) => `${formatBytes(conn.uploadSpeed)}/s`,
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
    key: 'dl',
    groupable: false,
    sortable: true,
    sortId: 'Download',
    render: (conn: Connection) => formatBytes(conn.download),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    key: 'ul',
    groupable: false,
    sortable: true,
    sortId: 'Upload',
    render: (conn: Connection) => formatBytes(conn.upload),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP,
    key: 'sourceIP',
    groupable: true,
    sortable: true,
    sortId: 'SourceIP',
    render: (conn: Connection) => getSourceIP(conn),
    groupValue: (conn: Connection) => getSourceIP(conn),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort,
    key: 'sourcePort',
    groupable: false,
    sortable: false,
    render: (conn: Connection) => String(conn.metadata.sourcePort),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
    key: 'destination',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => getDestination(conn),
    groupValue: (conn: Connection) => getDestination(conn),
  },
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.InboundUser,
    key: 'inboundUser',
    groupable: true,
    sortable: true,
    render: (conn: Connection) => getInboundUser(conn),
    groupValue: (conn: Connection) => getInboundUser(conn),
  },
]

const visibleColumns = computed(() => {
  const order = configStore.connectionsTableColumnOrder
  const visibility = configStore.connectionsTableColumnVisibility

  // Sort columns by order, then filter by visibility
  return [...allColumns]
    .sort((a, b) => {
      const aIndex = order.indexOf(a.id)
      const bIndex = order.indexOf(b.id)
      // If not in order, put at the end
      const aOrder = aIndex === -1 ? Infinity : aIndex
      const bOrder = bIndex === -1 ? Infinity : bIndex
      return aOrder - bOrder
    })
    .filter((col) => visibility[col.id] !== false)
})

const sortableColumns = computed(() => allColumns.filter((col) => col.sortable))

// Tabs
const tabs = computed(() => [
  {
    type: 'active' as const,
    name: t('active'),
    count: connectionsStore.activeConnections.length,
  },
  {
    type: 'closed' as const,
    name: t('closed'),
    count: connectionsStore.closedConnections.length,
  },
])

// Source IP related
const uniqueSourceIPs = computed(() => {
  const ips = connectionsStore.allConnections.map((conn) => {
    const src = conn.metadata.sourceIP || t('inner')
    const tagged = configStore.clientSourceIPTags.find(
      (tag) => tag.sourceIP === src,
    )
    return tagged?.tagName || src
  })
  return uniq(ips).sort()
})

const untaggedSourceIPs = computed(() => {
  const ips = uniq(
    connectionsStore.allConnections.map((conn) => conn.metadata.sourceIP),
  ).sort()
  return ips.filter(
    (ip) => !configStore.clientSourceIPTags.some((tag) => tag.sourceIP === ip),
  )
})

// Table size class
const tableSizeClass = computed(() =>
  configStore.tableSizeClassName(configStore.connectionsTableSize),
)

// Filtered and sorted connections
const filteredConnections = computed(() => {
  let connections =
    activeTab.value === 'active'
      ? connectionsStore.activeConnections
      : connectionsStore.closedConnections

  // Apply quick filter
  if (enableQuickFilter.value && configStore.quickFilterRegex) {
    try {
      const regex = new RegExp(configStore.quickFilterRegex, 'i')
      connections = connections.filter(
        (conn) => !conn.chains.some((c) => regex.test(c)),
      )
    } catch {
      // Invalid regex, ignore
    }
  }

  // Apply source IP filter
  if (sourceIPFilter.value) {
    connections = connections.filter((conn) => {
      const src = conn.metadata.sourceIP || t('inner')
      const tagged = configStore.clientSourceIPTags.find(
        (tag) => tag.sourceIP === src,
      )
      const displayIP = tagged?.tagName || src
      return displayIP === sourceIPFilter.value
    })
  }

  // Apply global filter
  if (globalFilter.value) {
    const filter = globalFilter.value.toLowerCase()
    connections = connections.filter(
      (conn) =>
        conn.metadata.host?.toLowerCase().includes(filter) ||
        conn.metadata.process?.toLowerCase().includes(filter) ||
        conn.metadata.sourceIP?.toLowerCase().includes(filter) ||
        conn.rule?.toLowerCase().includes(filter) ||
        conn.chains.some((c) => c.toLowerCase().includes(filter)),
    )
  }

  // Sort
  const sorted = [...connections].sort((a, b) => {
    let comparison = 0
    switch (sortColumn.value) {
      case 'ConnectTime':
        comparison = new Date(a.start).getTime() - new Date(b.start).getTime()
        break
      case 'DlSpeed':
        comparison = a.downloadSpeed - b.downloadSpeed
        break
      case 'UlSpeed':
        comparison = a.uploadSpeed - b.uploadSpeed
        break
      case 'Download':
        comparison = a.download - b.download
        break
      case 'Upload':
        comparison = a.upload - b.upload
        break
      case 'Host':
        comparison = (a.metadata.host || '').localeCompare(
          b.metadata.host || '',
        )
        break
      case 'Type':
        comparison = a.metadata.type.localeCompare(b.metadata.type)
        break
      case 'Process':
        comparison = (a.metadata.process || '').localeCompare(
          b.metadata.process || '',
        )
        break
      case 'SourceIP':
        comparison = (a.metadata.sourceIP || '').localeCompare(
          b.metadata.sourceIP || '',
        )
        break
    }
    return sortDesc.value ? -comparison : comparison
  })

  return sorted
})

// Pagination
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredConnections.value.length / pageSize.value)),
)

const visiblePages = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
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

const paginatedConnections = computed(() => {
  const start = currentPage.value * pageSize.value
  return filteredConnections.value.slice(start, start + pageSize.value)
})

const paginationInfo = computed(() => {
  const total = filteredConnections.value.length
  const start = currentPage.value * pageSize.value + 1
  const end = Math.min((currentPage.value + 1) * pageSize.value, total)
  return `${start}-${end} / ${total}`
})

// Reset page when filters change
watch([activeTab, globalFilter, sourceIPFilter, enableQuickFilter], () => {
  currentPage.value = 0
})

// Get current grouping column definition
const groupingColumnDef = computed(() =>
  groupingColumn.value
    ? allColumns.find((c) => c.id === groupingColumn.value)
    : null,
)

// Unified row model (like TanStack's getRowModel)
const rowModel = computed<TableRow[]>(() => {
  const col = groupingColumnDef.value

  // No grouping - return paginated data rows
  if (!col?.groupValue) {
    return paginatedConnections.value.map((conn) => ({
      type: 'data' as const,
      original: conn,
      depth: 0,
    }))
  }

  // Build grouped rows
  const groups = new Map<string, Connection[]>()
  for (const conn of filteredConnections.value) {
    const key = col.groupValue(conn)
    const group = groups.get(key)
    if (group) {
      group.push(conn)
    } else {
      groups.set(key, [conn])
    }
  }

  // Flatten into row model with group headers and expanded data rows
  const rows: TableRow[] = []
  for (const [key, subRows] of groups) {
    // Group header row
    rows.push({ type: 'group', key, depth: 0, subRows })

    // Data rows (only if expanded)
    if (expandedGroups.value[key]) {
      for (const conn of subRows) {
        rows.push({ type: 'data', original: conn, depth: 1 })
      }
    }
  }

  return rows
})

// Handlers
function handleHeaderClick(colId: string) {
  const col = allColumns.find((c) => c.id === colId)
  if (!col?.sortable || !col.sortId) return

  if (sortColumn.value === col.sortId) {
    // Three-state toggle: desc -> asc -> none
    if (sortDesc.value) {
      sortDesc.value = false
    } else {
      // Clear sorting
      sortColumn.value = ''
      sortDesc.value = true
    }
  } else {
    // Change sort column, start with desc
    sortColumn.value = col.sortId
    sortDesc.value = true
  }
}

function toggleGrouping(colId: string) {
  if (groupingColumn.value === colId) {
    groupingColumn.value = null
  } else {
    groupingColumn.value = colId
  }
  expandedGroups.value = {}
}

function toggleGroupExpanded(key: string) {
  expandedGroups.value[key] = !expandedGroups.value[key]
}

function toggleSortOrder() {
  sortDesc.value = !sortDesc.value
}

async function handleCloseConnections() {
  isClosingConnections.value = true
  try {
    if (globalFilter.value) {
      await Promise.allSettled(
        filteredConnections.value.map((conn) =>
          closeSingleConnectionAPI(conn.id),
        ),
      )
    } else {
      await closeAllConnectionsAPI()
    }
  } finally {
    isClosingConnections.value = false
  }
}

function showConnectionDetails(conn: Connection) {
  selectedConnection.value = conn
  detailsModal.value?.open()
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <!-- Toolbar -->
    <ConnectionsToolbar
      class="shrink-0"
      :tabs="tabs"
      :active-tab="activeTab"
      :enable-quick-filter="enableQuickFilter"
      :source-i-p-filter="sourceIPFilter"
      :unique-source-i-ps="uniqueSourceIPs"
      :sort-column="sortColumn"
      :sort-desc="sortDesc"
      :sortable-columns="sortableColumns"
      :global-filter="globalFilter"
      :paused="connectionsStore.paused"
      :is-closing-connections="isClosingConnections"
      @update:active-tab="activeTab = $event"
      @update:enable-quick-filter="enableQuickFilter = $event"
      @update:source-i-p-filter="sourceIPFilter = $event"
      @update:sort-column="sortColumn = $event"
      @update:global-filter="globalFilter = $event"
      @toggle-sort-order="toggleSortOrder"
      @toggle-paused="connectionsStore.paused = !connectionsStore.paused"
      @close-connections="handleCloseConnections"
      @open-settings="settingsModal?.open()"
    />

    <!-- Mobile Pagination - Top -->
    <div class="flex shrink-0 justify-center md:hidden">
      <ConnectionsPagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :visible-pages="visiblePages"
        @go-to-page="currentPage = $event"
        @previous="currentPage--"
        @next="currentPage++"
      />
    </div>

    <!-- Connections Table -->
    <div
      class="min-h-0 flex-1 overflow-auto rounded-xl border border-base-content/10 bg-base-200/50"
    >
      <ConnectionsTable
        :columns="visibleColumns"
        :row-model="rowModel"
        :sort-column="sortColumn"
        :sort-desc="sortDesc"
        :grouping-column="groupingColumn"
        :expanded-groups="expandedGroups"
        :table-size-class="tableSizeClass"
        @header-click="handleHeaderClick"
        @toggle-grouping="toggleGrouping"
        @toggle-group-expanded="toggleGroupExpanded"
        @row-click="showConnectionDetails"
      />
    </div>

    <!-- Desktop Pagination - Bottom -->
    <div class="hidden shrink-0 items-center justify-between gap-4 md:flex">
      <div class="flex items-center gap-3">
        <select
          v-model.number="pageSize"
          class="cursor-pointer rounded-md border border-base-content/10 bg-base-100 px-2.5 py-1.5 text-[0.8125rem] text-base-content transition-colors duration-200 focus:border-primary focus:outline-none"
        >
          <option v-for="size in [20, 50, 100, 200]" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
        <span class="text-xs whitespace-nowrap text-base-content/60">
          {{ paginationInfo }}
        </span>
      </div>

      <ConnectionsPagination
        :current-page="currentPage"
        :total-pages="totalPages"
        :visible-pages="visiblePages"
        @go-to-page="currentPage = $event"
        @previous="currentPage--"
        @next="currentPage++"
      />
    </div>

    <!-- Settings Modal -->
    <ConnectionsSettingsModal
      ref="settingsModal"
      :all-columns="allColumns"
      :untagged-source-i-ps="untaggedSourceIPs"
    />

    <!-- Details Modal -->
    <ConnectionDetailsModal
      ref="detailsModal"
      :connection="selectedConnection"
    />
  </div>
</template>

<style>
/* Close button in table - uses :deep styles from parent, kept as global CSS
   because it's rendered via h() function and needs specific styling */
.conn-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: color-mix(in oklch, var(--color-error) 10%, transparent);
  color: var(--color-error);
  cursor: pointer;
  transition: all 0.2s ease;
}

.conn-close-btn:hover {
  background: color-mix(in oklch, var(--color-error) 20%, transparent);
  transform: scale(1.1);
}
</style>
