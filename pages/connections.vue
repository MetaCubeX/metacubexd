<script setup lang="ts">
import type { VNode } from 'vue'
import type { Connection, ConnectionsTableColumnVisibility } from '~/types'
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconNetwork,
  IconPlayerPause,
  IconPlayerPlay,
  IconSettings,
  IconSortAscending,
  IconSortDescending,
  IconX,
  IconZoomInFilled,
  IconZoomOutFilled,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import { uniq } from 'lodash-es'
import {
  closeAllConnectionsAPI,
  closeSingleConnectionAPI,
} from '~/composables/useApi'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '~/constants'
import { formatIPv6, formatTimeFromNow } from '~/utils'

useHead({ title: 'Connections' })

const { t } = useI18n()
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

// Tag form
const newTagSourceIP = ref('')
const newTagName = ref('')

// Helpers
const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Cell value helpers - moved before column definitions
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

// Close connection handler for render function
function closeConnection(id: string) {
  closeSingleConnectionAPI(id)
}

// Column definition interface
interface ConnectionColumn {
  id: CONNECTIONS_TABLE_ACCESSOR_KEY
  key: string
  groupable: boolean
  sortable: boolean
  sortId?: string
  render: (conn: Connection) => VNode | string
  groupValue?: (conn: Connection) => string
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
          class: 'btn btn-circle btn-xs',
          onClick: (e: Event) => {
            e.stopPropagation()
            closeConnection(conn.id)
          },
        },
        h(IconX, { size: 16 }),
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
    render: (conn: Connection) =>
      formatTimeFromNow(conn.start, configStore.locale),
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
]

const visibleColumns = computed(() =>
  allColumns.filter(
    (col) => configStore.connectionsTableColumnVisibility[col.id] !== false,
  ),
)

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

// Sortable column helpers using column definitions
function isSortableColumn(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
  const col = allColumns.find((c) => c.id === colId)
  return col?.sortable ?? false
}

function isColumnSorted(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
  const col = allColumns.find((c) => c.id === colId)
  return col?.sortId ? sortColumn.value === col.sortId : false
}

function handleHeaderClick(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
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

// Grouping
function toggleGrouping(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
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

// Get current grouping column definition
const groupingColumnDef = computed(() =>
  groupingColumn.value
    ? allColumns.find((c) => c.id === groupingColumn.value)
    : null,
)

// Row types for unified row model (similar to TanStack Table)
interface GroupRow {
  type: 'group'
  key: string
  depth: number
  subRows: Connection[]
}

interface DataRow {
  type: 'data'
  original: Connection
  depth: number
}

type TableRow = GroupRow | DataRow

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

// Actions
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

function toggleColumnVisibility(colId: CONNECTIONS_TABLE_ACCESSOR_KEY) {
  configStore.connectionsTableColumnVisibility = {
    ...configStore.connectionsTableColumnVisibility,
    [colId]: !configStore.connectionsTableColumnVisibility[colId],
  } as ConnectionsTableColumnVisibility
}

function addTag() {
  if (newTagName.value && newTagSourceIP.value) {
    const exists = configStore.clientSourceIPTags.some(
      (tag) =>
        tag.tagName === newTagName.value ||
        tag.sourceIP === newTagSourceIP.value,
    )
    if (!exists) {
      configStore.clientSourceIPTags = [
        ...configStore.clientSourceIPTags,
        { tagName: newTagName.value, sourceIP: newTagSourceIP.value },
      ]
    }
    newTagName.value = ''
    newTagSourceIP.value = ''
  }
}

function removeTag(tagName: string) {
  configStore.clientSourceIPTags = configStore.clientSourceIPTags.filter(
    (tag) => tag.tagName !== tagName,
  )
}

function resetSettings() {
  configStore.connectionsTableColumnVisibility = {
    ...CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  }
}

// Pagination Buttons Component
const PaginationButtons = defineComponent({
  props: {
    currentPage: { type: Number, required: true },
    totalPages: { type: Number, required: true },
    visiblePages: { type: Array as () => number[], required: true },
  },
  emits: ['goToPage', 'previous', 'next'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'join shrink-0' }, [
        h(
          'button',
          {
            class: 'btn join-item btn-xs',
            disabled: props.currentPage === 0,
            onClick: () => emit('goToPage', 0),
          },
          h(IconChevronsLeft, { size: 14 }),
        ),
        h(
          'button',
          {
            class: 'btn join-item btn-xs',
            disabled: props.currentPage === 0,
            onClick: () => emit('previous'),
          },
          h(IconChevronLeft, { size: 14 }),
        ),
        ...props.visiblePages.flatMap((page, index) => {
          const elements = []
          const prevPage = props.visiblePages[index - 1]
          if (index > 0 && prevPage !== undefined && page - prevPage > 1) {
            elements.push(
              h(
                'span',
                {
                  class: 'flex items-center px-1 text-xs text-base-content/40',
                  key: `ellipsis-${page}`,
                },
                '···',
              ),
            )
          }
          elements.push(
            h(
              'button',
              {
                key: page,
                class: [
                  'btn join-item min-w-8 btn-xs',
                  { 'btn-active': props.currentPage === page },
                ],
                onClick: () => emit('goToPage', page),
              },
              page + 1,
            ),
          )
          return elements
        }),
        h(
          'button',
          {
            class: 'btn join-item btn-xs',
            disabled: props.currentPage >= props.totalPages - 1,
            onClick: () => emit('next'),
          },
          h(IconChevronRight, { size: 14 }),
        ),
        h(
          'button',
          {
            class: 'btn join-item btn-xs',
            disabled: props.currentPage >= props.totalPages - 1,
            onClick: () => emit('goToPage', props.totalPages - 1),
          },
          h(IconChevronsRight, { size: 14 }),
        ),
      ])
  },
})
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <!-- Toolbar Row 1: Tabs + Quick filter + Source IP filter -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="tabs-box tabs gap-2 tabs-sm">
        <button
          v-for="tab in tabs"
          :key="tab.type"
          class="tab gap-2 px-2"
          :class="{ 'bg-primary text-neutral!': activeTab === tab.type }"
          @click="activeTab = tab.type"
        >
          <span>{{ tab.name }}</span>
          <div class="badge badge-sm">
            {{ tab.count }}
          </div>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <span class="hidden text-sm sm:inline-block">{{
          t('quickFilter')
        }}</span>
        <input
          v-model="enableQuickFilter"
          type="checkbox"
          class="toggle toggle-sm"
        />
      </div>

      <select
        v-model="sourceIPFilter"
        class="select max-w-40 flex-1 select-sm select-primary"
      >
        <option value="">
          {{ t('all') }}
        </option>
        <option v-for="ip in uniqueSourceIPs" :key="ip" :value="ip">
          {{ ip }}
        </option>
      </select>
    </div>

    <!-- Toolbar Row 2: Sort + Search + Actions -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex shrink-0 items-center gap-1">
        <span class="hidden text-sm whitespace-nowrap sm:inline-block">
          {{ t('sortBy') }}
        </span>
        <select v-model="sortColumn" class="select select-sm select-primary">
          <option
            v-for="col in allColumns.filter((c) => c.sortable)"
            :key="col.id"
            :value="col.sortId"
          >
            {{ t(col.key) }}
          </option>
        </select>
        <Button class="btn btn-sm btn-primary" @click="toggleSortOrder">
          <IconSortDescending v-if="sortDesc" />
          <IconSortAscending v-else />
        </Button>
      </div>

      <div class="join flex min-w-0 flex-1 items-center">
        <input
          v-model="globalFilter"
          type="search"
          class="input input-sm join-item min-w-0 flex-1 input-primary"
          :placeholder="t('search')"
        />

        <Button
          class="btn join-item btn-sm btn-primary"
          @click="connectionsStore.paused = !connectionsStore.paused"
        >
          <IconPlayerPlay v-if="connectionsStore.paused" />
          <IconPlayerPause v-else />
        </Button>

        <Button
          class="btn join-item btn-sm btn-primary"
          :loading="isClosingConnections"
          @click="handleCloseConnections"
        >
          <IconX />
        </Button>

        <Button
          class="btn join-item btn-sm btn-primary"
          @click="settingsModal?.open()"
        >
          <IconSettings />
        </Button>
      </div>
    </div>

    <!-- Mobile Pagination - Top -->
    <div class="flex shrink-0 items-center justify-center md:hidden">
      <PaginationButtons
        :current-page="currentPage"
        :total-pages="totalPages"
        :visible-pages="visiblePages"
        @go-to-page="currentPage = $event"
        @previous="currentPage--"
        @next="currentPage++"
      />
    </div>

    <!-- Connections Table -->
    <div class="flex-1 overflow-x-auto rounded-md bg-base-300">
      <table class="table-pin-rows table table-zebra" :class="tableSizeClass">
        <thead>
          <tr>
            <th v-for="col in visibleColumns" :key="col.id" class="bg-base-200">
              <div class="flex items-center gap-2">
                <div
                  class="flex-1"
                  :class="{
                    'cursor-pointer select-none': isSortableColumn(col.id),
                  }"
                  @click="handleHeaderClick(col.id)"
                >
                  {{ t(col.key) }}
                </div>
                <IconSortAscending
                  v-if="isColumnSorted(col.id) && !sortDesc"
                  :size="16"
                />
                <IconSortDescending
                  v-else-if="isColumnSorted(col.id) && sortDesc"
                  :size="16"
                />
                <!-- Grouping button -->
                <button
                  v-if="col.groupable"
                  class="cursor-pointer"
                  @click.stop="toggleGrouping(col.id)"
                >
                  <IconZoomOutFilled
                    v-if="groupingColumn === col.id"
                    :size="18"
                  />
                  <IconZoomInFilled v-else :size="18" />
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="row in rowModel"
            :key="row.type === 'group' ? `group-${row.key}` : row.original.id"
          >
            <!-- Group header row -->
            <tr
              v-if="row.type === 'group'"
              class="cursor-pointer bg-base-200"
              @click="toggleGroupExpanded(row.key)"
            >
              <td :colspan="visibleColumns.length">
                <div class="flex items-center gap-2">
                  <IconZoomOutFilled
                    v-if="expandedGroups[row.key]"
                    :size="18"
                  />
                  <IconZoomInFilled v-else :size="18" />
                  <span>{{ row.key }}</span>
                  <span class="text-base-content/60"
                    >({{ row.subRows.length }})</span
                  >
                </div>
              </td>
            </tr>
            <!-- Data row -->
            <tr
              v-else
              class="hover cursor-pointer"
              @click="showConnectionDetails(row.original)"
            >
              <td
                v-for="col in visibleColumns"
                :key="col.id"
                class="whitespace-nowrap"
              >
                <component :is="() => col.render(row.original)" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div
        v-if="rowModel.length === 0"
        class="py-8 text-center text-base-content/70"
      >
        {{ t('noData') }}
      </div>
    </div>

    <!-- Desktop Pagination - Bottom -->
    <div class="hidden shrink-0 items-center justify-between gap-2 md:flex">
      <div class="flex shrink-0 items-center gap-1.5">
        <select
          v-model.number="pageSize"
          class="select-bordered select select-xs"
        >
          <option v-for="size in [20, 50, 100, 200]" :key="size" :value="size">
            {{ size }}
          </option>
        </select>
        <span class="text-xs whitespace-nowrap text-base-content/60">
          {{ paginationInfo }}
        </span>
      </div>

      <PaginationButtons
        :current-page="currentPage"
        :total-pages="totalPages"
        :visible-pages="visiblePages"
        @go-to-page="currentPage = $event"
        @previous="currentPage--"
        @next="currentPage++"
      />
    </div>

    <!-- Settings Modal -->
    <Modal ref="settingsModal" :title="t('connectionsSettings')">
      <template #icon>
        <IconNetwork :size="24" />
      </template>

      <div class="flex flex-col gap-4">
        <div>
          <ConfigTitle with-divider>
            {{ t('quickFilter') }}
          </ConfigTitle>
          <input
            v-model="configStore.quickFilterRegex"
            type="text"
            class="input w-full"
            placeholder="DIRECT|direct|dns-out"
          />
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('tableSize') }}
          </ConfigTitle>
          <select
            v-model="configStore.connectionsTableSize"
            class="select w-full"
          >
            <option value="xs">
              {{ t('xs') }}
            </option>
            <option value="sm">
              {{ t('sm') }}
            </option>
            <option value="md">
              {{ t('md') }}
            </option>
            <option value="lg">
              {{ t('lg') }}
            </option>
          </select>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('tagClientSourceIPWithName') }}
          </ConfigTitle>
          <div class="flex flex-col gap-4">
            <div class="join flex">
              <select v-model="newTagSourceIP" class="select join-item">
                <option value="" />
                <option v-for="ip in untaggedSourceIPs" :key="ip" :value="ip">
                  {{ ip || t('inner') }}
                </option>
              </select>
              <input
                v-model="newTagName"
                class="input join-item flex-1"
                placeholder="name"
              />
              <Button class="join-item" @click="addTag">
                {{ t('tag') }}
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <div
                v-for="tag in configStore.clientSourceIPTags"
                :key="tag.tagName"
                class="badge w-full items-center justify-between gap-2 py-4 badge-primary"
              >
                <span class="truncate"
                  >{{ tag.tagName }} ({{ tag.sourceIP }})</span
                >
                <Button
                  class="btn-circle btn-ghost btn-xs"
                  @click="removeTag(tag.tagName)"
                >
                  <IconX :size="12" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <ConfigTitle with-divider>
            {{ t('columns') }}
          </ConfigTitle>
          <div class="flex flex-col">
            <div
              v-for="col in allColumns"
              :key="col.id"
              class="flex items-center justify-between py-2"
            >
              <span>{{ t(col.key) }}</span>
              <input
                type="checkbox"
                class="toggle"
                :checked="configStore.connectionsTableColumnVisibility[col.id]"
                @change="toggleColumnVisibility(col.id)"
              />
            </div>
          </div>
        </div>

        <Button class="btn-sm btn-neutral" @click="resetSettings">
          {{ t('reset') }}
        </Button>
      </div>
    </Modal>

    <!-- Details Modal -->
    <Modal ref="detailsModal" :title="t('connectionsDetails')">
      <template #icon>
        <IconNetwork :size="24" />
      </template>

      <pre v-if="selectedConnection" class="overflow-auto text-sm">
        <code>{{ JSON.stringify(selectedConnection, null, 2) }}</code>
      </pre>
    </Modal>
  </div>
</template>
