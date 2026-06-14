<script setup lang="ts">
import {
  IconDeviceDesktop,
  IconFilter,
  IconHash,
  IconNetwork,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconServer,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import * as d3 from 'd3'
import { getThemeColors } from '~/utils'

const { t } = useI18n()

const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()
const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Track collapsed state by node id
const collapsedNodes = ref<Set<string>>(new Set())

// Pause state for stopping data updates
const isPaused = ref(false)
// Frozen connections snapshot when paused
const frozenConnections = ref<typeof connectionsStore.activeConnections | null>(
  null,
)

// Get current connections (frozen when paused)
const currentConnections = computed(() => {
  if (isPaused.value && frozenConnections.value) {
    return frozenConnections.value
  }
  return connectionsStore.activeConnections
})

// Cached colors for current theme
let cachedColors: ReturnType<typeof computeNodeColors> | null = null
let cachedTheme: string | null = null

// Canvas context for measuring text width (much faster than DOM)
let measureCanvas: HTMLCanvasElement | null = null
function getTextWidth(
  text: string,
  font: string = '600 11px sans-serif',
): number {
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas')
  }
  const ctx = measureCanvas.getContext('2d')
  if (!ctx) return text.length * 7 // Fallback estimation
  ctx.font = font
  return ctx.measureText(text).width
}

// Throttle render to prevent excessive re-renders
let renderPending = false
function scheduleRender() {
  if (renderPending) return
  renderPending = true
  requestAnimationFrame(() => {
    renderPending = false
    renderTree()
  })
}

// Topology node types
type NodeType = 'root' | 'client' | 'port' | 'rule' | 'group' | 'proxy'

interface TopologyNodeData {
  id: string
  name: string
  type: NodeType
  connections: number
  traffic: number
  children?: TopologyNodeData[]
  _children?: TopologyNodeData[] // Store children when collapsed
  collapsed?: boolean
}

// Build hierarchy data from active connections
// Structure: root -> groups -> proxies -> rules -> clients
const hierarchyData = computed<TopologyNodeData>(() => {
  const connections = currentConnections.value

  // Build a tree structure: root -> groups -> proxies -> rules -> clients
  const groupsMap = new Map<
    string,
    {
      data: TopologyNodeData
      proxies: Map<
        string,
        {
          data: TopologyNodeData
          rules: Map<
            string,
            {
              data: TopologyNodeData
              clients: Map<
                string,
                {
                  data: TopologyNodeData
                  ports: Map<string, TopologyNodeData>
                }
              >
            }
          >
        }
      >
    }
  >()

  connections.forEach((conn) => {
    const clientIP = conn.metadata.sourceIP || 'Unknown'
    const sourcePort = String(conn.metadata.sourcePort || 'Unknown')
    // Combine rule type and payload into full rule string
    const ruleType = conn.rule || 'Direct'
    const rulePayload = conn.rulePayload
    const fullRule = rulePayload ? `${ruleType}: ${rulePayload}` : ruleType
    const chains = conn.chains || []
    const proxy = chains[0] ?? 'Direct'
    const group: string =
      chains.length > 1 ? (chains[1] ?? 'Direct') : (chains[0] ?? 'Direct')
    const traffic = conn.download + conn.upload

    // Get or create group (leftmost)
    if (!groupsMap.has(group)) {
      groupsMap.set(group, {
        data: {
          id: `group-${group}`,
          name: group,
          type: 'group',
          connections: 0,
          traffic: 0,
        },
        proxies: new Map(),
      })
    }
    const groupEntry = groupsMap.get(group)!
    groupEntry.data.connections++
    groupEntry.data.traffic += traffic

    // Get or create proxy under group
    if (!groupEntry.proxies.has(proxy)) {
      groupEntry.proxies.set(proxy, {
        data: {
          id: `proxy-${group}-${proxy}`,
          name: proxy,
          type: 'proxy',
          connections: 0,
          traffic: 0,
        },
        rules: new Map(),
      })
    }
    const proxyEntry = groupEntry.proxies.get(proxy)!
    proxyEntry.data.connections++
    proxyEntry.data.traffic += traffic

    // Get or create rule under proxy
    if (!proxyEntry.rules.has(fullRule)) {
      proxyEntry.rules.set(fullRule, {
        data: {
          id: `rule-${group}-${proxy}-${fullRule}`,
          name: fullRule,
          type: 'rule',
          connections: 0,
          traffic: 0,
        },
        clients: new Map(),
      })
    }
    const ruleEntry = proxyEntry.rules.get(fullRule)!
    ruleEntry.data.connections++
    ruleEntry.data.traffic += traffic

    // Get or create client under rule
    if (!ruleEntry.clients.has(clientIP)) {
      ruleEntry.clients.set(clientIP, {
        data: {
          id: `client-${group}-${proxy}-${fullRule}-${clientIP}`,
          name: clientIP,
          type: 'client',
          connections: 0,
          traffic: 0,
        },
        ports: new Map(),
      })
    }
    const clientEntry = ruleEntry.clients.get(clientIP)!
    clientEntry.data.connections++
    clientEntry.data.traffic += traffic

    // Get or create port under client (rightmost)
    if (!clientEntry.ports.has(sourcePort)) {
      clientEntry.ports.set(sourcePort, {
        id: `port-${group}-${proxy}-${fullRule}-${clientIP}-${sourcePort}`,
        name: sourcePort,
        type: 'port',
        connections: 0,
        traffic: 0,
      })
    }
    const portNode = clientEntry.ports.get(sourcePort)!
    portNode.connections++
    portNode.traffic += traffic
  })

  // Convert to hierarchy structure with collapse support
  const rootChildren: TopologyNodeData[] = []

  // Helper to apply collapse state to a node
  function applyCollapseState(
    node: TopologyNodeData,
    defaultCollapsed: boolean = false,
  ): TopologyNodeData {
    const isCollapsed = collapsedNodes.value.has(node.id) || defaultCollapsed
    if (isCollapsed && node.children && node.children.length > 0) {
      return {
        ...node,
        _children: node.children,
        children: undefined,
        collapsed: true,
      }
    }
    return { ...node, collapsed: false }
  }

  groupsMap.forEach((groupEntry) => {
    const groupNode: TopologyNodeData = {
      ...groupEntry.data,
      children: [] as TopologyNodeData[],
    }

    groupEntry.proxies.forEach((proxyEntry) => {
      const proxyNode: TopologyNodeData = {
        ...proxyEntry.data,
        children: [] as TopologyNodeData[],
      }

      proxyEntry.rules.forEach((ruleEntry) => {
        const ruleNode: TopologyNodeData = {
          ...ruleEntry.data,
          children: [] as TopologyNodeData[],
        }

        ruleEntry.clients.forEach((clientEntry) => {
          const portChildren = Array.from(clientEntry.ports.values())
          // Default collapse client's children (ports)
          const isClientCollapsed = !collapsedNodes.value.has(
            `expanded-${clientEntry.data.id}`,
          )
          const clientNode: TopologyNodeData = isClientCollapsed
            ? {
                ...clientEntry.data,
                _children: portChildren,
                children: undefined,
                collapsed: true,
              }
            : {
                ...clientEntry.data,
                children: portChildren,
                collapsed: false,
              }
          ruleNode.children!.push(clientNode)
        })

        // Default collapse rule's children (clients)
        const isRuleCollapsed = !collapsedNodes.value.has(
          `expanded-${ruleEntry.data.id}`,
        )
        if (isRuleCollapsed && ruleNode.children!.length > 0) {
          ruleNode._children = ruleNode.children
          ruleNode.children = undefined
          ruleNode.collapsed = true
        } else {
          ruleNode.collapsed = false
        }
        proxyNode.children!.push(ruleNode)
      })

      // Apply collapse state for proxy nodes
      const processedProxyNode = applyCollapseState(proxyNode)
      groupNode.children!.push(processedProxyNode)
    })

    // Apply collapse state for group nodes
    const processedGroupNode = applyCollapseState(groupNode)
    rootChildren.push(processedGroupNode)
  })

  return {
    id: 'root',
    name: 'Connections',
    type: 'root',
    connections: connections.length,
    traffic: connections.reduce((sum, c) => sum + c.download + c.upload, 0),
    children: rootChildren,
  }
})

// Statistics
const stats = computed(() => {
  const connections = currentConnections.value
  const clientSet = new Set<string>()
  const ruleSet = new Set<string>()
  const groupSet = new Set<string>()
  const proxySet = new Set<string>()

  connections.forEach((conn) => {
    clientSet.add(conn.metadata.sourceIP || 'Unknown')
    ruleSet.add(conn.rule || 'Direct')
    const chains = conn.chains || []
    proxySet.add(chains[0] ?? 'Direct')
    groupSet.add(
      chains.length > 1 ? (chains[1] ?? 'Direct') : (chains[0] ?? 'Direct'),
    )
  })

  return {
    clientCount: clientSet.size,
    ruleCount: ruleSet.size,
    groupCount: groupSet.size,
    proxyCount: proxySet.size,
    totalTraffic: connections.reduce(
      (sum, c) => sum + c.download + c.upload,
      0,
    ),
  }
})

// Compute node colors from theme
function computeNodeColors() {
  const theme = getThemeColors()
  return {
    root: {
      fill: theme.neutral,
      bg: `color-mix(in oklch, ${theme.neutral} 15%, transparent)`,
    },
    client: {
      fill: theme.primary,
      bg: `color-mix(in oklch, ${theme.primary} 15%, transparent)`,
    },
    port: {
      fill: theme.warning,
      bg: `color-mix(in oklch, ${theme.warning} 15%, transparent)`,
    },
    rule: {
      fill: theme.secondary,
      bg: `color-mix(in oklch, ${theme.secondary} 15%, transparent)`,
    },
    group: {
      fill: theme.accent,
      bg: `color-mix(in oklch, ${theme.accent} 15%, transparent)`,
    },
    proxy: {
      fill: theme.info,
      bg: `color-mix(in oklch, ${theme.info} 15%, transparent)`,
    },
    baseContent: theme.baseContent,
  }
}

// Get cached node colors (only recompute on theme change)
function getNodeColors() {
  const currentTheme = configStore.curTheme
  if (cachedColors && cachedTheme === currentTheme) {
    return cachedColors
  }
  cachedColors = computeNodeColors()
  cachedTheme = currentTheme
  return cachedColors
}

// Get color for node type - returns CSS color values
function getNodeFillColor(type: NodeType): string {
  return getNodeColors()[type].fill
}

// Get background color for node type (with opacity)
function getNodeBgColor(type: NodeType): string {
  return getNodeColors()[type].bg
}

// Get icon component for node type
function getNodeIcon(type: NodeType) {
  switch (type) {
    case 'client':
      return IconDeviceDesktop
    case 'port':
      return IconHash
    case 'rule':
      return IconFilter
    case 'group':
      return IconNetwork
    case 'proxy':
      return IconServer
    default:
      return IconNetwork
  }
}

// Toggle collapse state of a node
function toggleCollapse(nodeId: string, isCurrentlyCollapsed: boolean) {
  // For rule and client nodes, we use 'expanded-{id}' pattern
  // because they default to collapsed
  const expandedKey = `expanded-${nodeId}`

  if (isCurrentlyCollapsed) {
    // Expand: add to expanded set (for default-collapsed nodes)
    // or remove from collapsed set (for default-expanded nodes)
    if (nodeId.startsWith('rule-') || nodeId.startsWith('client-')) {
      collapsedNodes.value.add(expandedKey)
    } else {
      collapsedNodes.value.delete(nodeId)
    }
  } else {
    // Collapse: remove from expanded set (for default-collapsed nodes)
    // or add to collapsed set (for default-expanded nodes)
    if (nodeId.startsWith('rule-') || nodeId.startsWith('client-')) {
      collapsedNodes.value.delete(expandedKey)
    } else {
      collapsedNodes.value.add(nodeId)
    }
  }
}

// Render the tree using D3
function renderTree() {
  if (!svgRef.value || !containerRef.value) return

  const data = hierarchyData.value
  if (!data.children || data.children.length === 0) return

  // Clear previous content
  d3.select(svgRef.value).selectAll('*').remove()

  // Node dimensions
  const nodeHeight = 30
  const nodePaddingX = 16 // Horizontal padding inside node
  const nodeSpacingY = 50 // Vertical spacing between nodes
  const levelGap = 40 // Gap between levels

  // Create hierarchy
  const root = d3.hierarchy(data)

  const containerWidth = containerRef.value.clientWidth

  // Use d3.tree with nodeSize for consistent vertical spacing
  // Horizontal spacing will be adjusted manually based on node widths
  const treeLayout = d3
    .tree<TopologyNodeData>()
    .nodeSize([nodeSpacingY, 100]) // [vertical spacing, initial horizontal - will be adjusted]
    .separation((a, b) => {
      // Ensure minimum separation between nodes
      return a.parent === b.parent ? 1 : 1.5
    })

  // Apply layout
  treeLayout(root)

  // Calculate width for each node based on its name using Canvas (faster than DOM)
  const nodeWidths = new Map<string, number>()
  const descendants = root.descendants()
  for (const d of descendants) {
    if (d.data.type !== 'root') {
      const textWidth = getTextWidth(d.data.name)
      // Add padding and extra space for collapse indicator if needed
      const hasChildren =
        (d.data.children && d.data.children.length > 0) ||
        (d.data._children && d.data._children.length > 0)
      const indicatorSpace = hasChildren ? 20 : 0
      nodeWidths.set(d.data.id, textWidth + nodePaddingX * 2 + indicatorSpace)
    }
  }

  // Helper function to get node width
  function getNodeWidth(d: d3.HierarchyNode<TopologyNodeData>): number {
    return nodeWidths.get(d.data.id) ?? 80
  }

  // Calculate max width per depth level
  const maxWidthPerLevel = new Map<number, number>()
  root.descendants().forEach((d) => {
    if (d.data.type !== 'root') {
      const width = getNodeWidth(d)
      const currentMax = maxWidthPerLevel.get(d.depth) ?? 0
      maxWidthPerLevel.set(d.depth, Math.max(currentMax, width))
    }
  })

  // Calculate cumulative x offset for each level based on max widths
  // Each level's center position = previous level center + half of previous level's max width + gap + half of current level's max width
  const levelXOffset = new Map<number, number>()
  let cumulativeX = 0
  // Start from depth 1 (skip root at depth 0)
  for (let depth = 1; depth <= maxWidthPerLevel.size; depth++) {
    const currentLevelWidth = maxWidthPerLevel.get(depth) ?? 100
    // For first visible level, start at half its width
    if (depth === 1) {
      cumulativeX = currentLevelWidth / 2
    } else {
      const prevLevelWidth = maxWidthPerLevel.get(depth - 1) ?? 100
      cumulativeX += prevLevelWidth / 2 + levelGap + currentLevelWidth / 2
    }
    levelXOffset.set(depth, cumulativeX)
  }

  // Adjust node positions based on calculated offsets
  root.descendants().forEach((d) => {
    if (d.data.type !== 'root' && d.depth > 0) {
      // Override the y position (horizontal in our rotated tree)
      d.y = levelXOffset.get(d.depth) ?? d.y
    }
  })

  // Calculate bounds to properly position the tree
  let minX = Infinity
  let maxX = -Infinity
  root.each((d) => {
    const x = d.x ?? 0
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  })

  // Add padding for connection count badge on top of nodes
  const topPadding = 25

  // Calculate actual height needed
  const treeHeight = maxX - minX + nodeSpacingY
  const actualHeight = Math.max(400, treeHeight + topPadding + 40)

  // Root offset is 0 since we manually adjusted node positions to start from 0
  const rootOffset = 0

  // Calculate the actual width needed for the tree content
  // Find the maximum x position (horizontal in our rotated tree) plus the node width at that position
  let maxY = 0
  root.each((d) => {
    if (d.data.type !== 'root') {
      const nodeWidth = nodeWidths.get(d.data.id) ?? 80
      const rightEdge = (d.y ?? 0) + nodeWidth / 2
      if (rightEdge > maxY) maxY = rightEdge
    }
  })

  // Add left padding (60) and right padding (40)
  const actualWidth = Math.max(containerWidth, maxY + 60 + 40)

  const svg = d3
    .select(svgRef.value)
    .attr('width', actualWidth)
    .attr('height', actualHeight)

  // Translate to center vertically and account for negative x values, plus top padding
  const g = svg
    .append('g')
    .attr(
      'transform',
      `translate(60, ${-minX + nodeSpacingY / 2 + topPadding})`,
    )

  // Get cached theme colors
  const colors = getNodeColors()

  // Filter out links from root node
  const visibleLinks = root
    .links()
    .filter((link) => link.source.data.type !== 'root')

  // Draw links - connect to node edges, not centers (with offset applied)
  g.selectAll('.link')
    .data(visibleLinks)
    .join('path')
    .attr('class', 'link')
    .attr('d', (d) => {
      const source = d.source as d3.HierarchyPointNode<TopologyNodeData>
      const target = d.target as d3.HierarchyPointNode<TopologyNodeData>
      const sourceWidth = getNodeWidth(source)
      const targetWidth = getNodeWidth(target)
      // Source point: right edge of source node (with offset)
      const sourceX = source.y - rootOffset + sourceWidth / 2
      const sourceY = source.x
      // Target point: left edge of target node (with offset)
      const targetX = target.y - rootOffset - targetWidth / 2
      const targetY = target.x
      // Control points for smooth curve
      const midX = (sourceX + targetX) / 2
      return `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`
    })
    .attr('fill', 'none')
    .attr('stroke', colors.baseContent)
    .attr('stroke-opacity', 0.3)
    .attr('stroke-width', (d) =>
      Math.max(1, Math.min(4, d.target.data.connections / 5)),
    )

  // Draw nodes - filter out root node (with offset applied)
  const nodes = g
    .selectAll('.node')
    .data(root.descendants().filter((d) => d.data.type !== 'root'))
    .join('g')
    .attr('class', 'node')
    .attr('transform', (d) => `translate(${(d.y ?? 0) - rootOffset},${d.x})`)
    .style('cursor', (d) => {
      // Show pointer cursor if node has children (visible or hidden)
      const hasChildren =
        (d.data.children && d.data.children.length > 0) ||
        (d.data._children && d.data._children.length > 0)
      return hasChildren ? 'pointer' : 'default'
    })
    .on('click', (_event, d) => {
      // Toggle collapse if node has children
      const hasChildren =
        (d.data.children && d.data.children.length > 0) ||
        (d.data._children && d.data._children.length > 0)
      if (hasChildren) {
        toggleCollapse(d.data.id, d.data.collapsed ?? false)
      }
    })

  // Connection count badge (on top of node)
  nodes
    .append('text')
    .attr('dy', -nodeHeight / 2 - 4)
    .attr('text-anchor', 'middle')
    .attr('fill', (d) => getNodeFillColor(d.data.type))
    .attr('font-size', '10px')
    .attr('font-weight', '500')
    .text((d) => `${d.data.connections}`)

  // Node rectangles
  nodes
    .append('rect')
    .attr('x', (d) => -getNodeWidth(d) / 2)
    .attr('y', -nodeHeight / 2)
    .attr('width', (d) => getNodeWidth(d))
    .attr('height', nodeHeight)
    .attr('rx', 6)
    .attr('fill', (d) => getNodeBgColor(d.data.type))
    .attr('stroke', (d) => getNodeFillColor(d.data.type))
    .attr('stroke-width', 2)

  // Collapse indicator (+ or -) on the right side of nodes with children
  nodes
    .filter((d: d3.HierarchyNode<TopologyNodeData>): boolean => {
      const hasChildren =
        (d.data.children && d.data.children.length > 0) ||
        (d.data._children && d.data._children.length > 0)
      return Boolean(hasChildren)
    })
    .append('text')
    .attr('x', (d) => getNodeWidth(d) / 2 - 12)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'middle')
    .attr('fill', (d) => getNodeFillColor(d.data.type))
    .attr('font-size', '14px')
    .attr('font-weight', '700')
    .text((d) => (d.data.collapsed ? '+' : '−'))

  // Node labels
  nodes
    .append('text')
    .attr('dy', '0.31em')
    .attr('text-anchor', 'middle')
    .attr('fill', (d) => getNodeFillColor(d.data.type))
    .attr('font-size', '11px')
    .attr('font-weight', '600')
    .text((d) => d.data.name)

  // Tooltips using title
  nodes
    .append('title')
    .text(
      (d) =>
        `${d.data.name}\n${d.data.connections} connections\n${byteSize(d.data.traffic).toString()}`,
    )
}

// Toggle pause state
function togglePause() {
  if (isPaused.value) {
    // Resuming: clear frozen data
    frozenConnections.value = null
  } else {
    // Pausing: freeze current connections data
    frozenConnections.value = [...connectionsStore.activeConnections]
  }
  isPaused.value = !isPaused.value
}

// Watch for data changes, collapse state, and theme changes - use single combined watch
watch(
  [() => hierarchyData.value, () => configStore.curTheme],
  () => {
    nextTick(scheduleRender)
  },
  { deep: true },
)

// Initial render
onMounted(() => {
  nextTick(scheduleRender)

  // Handle resize with throttling
  const resizeObserver = new ResizeObserver(() => scheduleRender())
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  onUnmounted(() => {
    resizeObserver.disconnect()
    measureCanvas = null
    cachedColors = null
  })
})
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-base-content transition-all duration-200 ease-in-out hover:bg-base-content/10"
          :class="{ 'text-warning': isPaused }"
          :title="isPaused ? t('resume') : t('pause')"
          @click="togglePause"
        >
          <IconPlayerPlay v-if="isPaused" class="h-4 w-4" />
          <IconPlayerPause v-else class="h-4 w-4" />
        </button>
      </div>
      <div class="flex flex-wrap gap-2 text-sm text-base-content/60">
        <span>{{ stats.clientCount }} {{ t('clients') }}</span>
        <span>·</span>
        <span>{{ stats.ruleCount }} {{ t('rules') }}</span>
        <span>·</span>
        <span>{{ stats.groupCount }} {{ t('groups') }}</span>
        <span>·</span>
        <span>{{ stats.proxyCount }} {{ t('nodes') }}</span>
        <span>·</span>
        <span>{{ byteSize(stats.totalTraffic).toString() }}</span>
      </div>
    </div>

    <!-- Legend - order: Group -> Proxy -> Rule -> Client -> Port (left to right) -->
    <div class="mb-4 flex flex-wrap gap-4 text-xs">
      <div class="flex items-center gap-1">
        <component :is="getNodeIcon('group')" class="h-4 w-4 text-accent" />
        <span>{{ t('proxyGroups') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <component :is="getNodeIcon('proxy')" class="h-4 w-4 text-info" />
        <span>{{ t('proxyNodes') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <component :is="getNodeIcon('rule')" class="h-4 w-4 text-secondary" />
        <span>{{ t('rules') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <component :is="getNodeIcon('client')" class="h-4 w-4 text-primary" />
        <span>{{ t('sourceIP') }}</span>
      </div>
      <div class="flex items-center gap-1">
        <component :is="getNodeIcon('port')" class="h-4 w-4 text-warning" />
        <span>{{ t('sourcePort') }}</span>
      </div>
    </div>

    <div
      v-if="currentConnections.length === 0"
      class="flex flex-col items-center justify-center py-8 text-base-content/60"
    >
      <IconRefresh class="mb-2 h-8 w-8 animate-pulse" />
      <span>{{ t('waitingForConnections') }}</span>
    </div>

    <div
      v-else
      ref="containerRef"
      class="touch-pan-x touch-pan-y overflow-x-auto"
    >
      <svg ref="svgRef" class="min-h-[25rem]" />
    </div>
  </div>
</template>
