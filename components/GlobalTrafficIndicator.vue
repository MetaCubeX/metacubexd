<script setup lang="ts">
import {
  IconArrowDown,
  IconArrowUp,
  IconGripVertical,
  IconX,
} from '@tabler/icons-vue'
import byteSize from 'byte-size'
import Highcharts from 'highcharts'
import { getChartThemeColors } from '~/utils'

const globalStore = useGlobalStore()
const connectionsStore = useConnectionsStore()
const configStore = useConfigStore()

// Visibility and collapsed state
const isVisible = useLocalStorage('globalTrafficIndicatorVisible', true)
const isCollapsed = useLocalStorage('globalTrafficIndicatorCollapsed', true)

// Position state for expanded view
const position = useLocalStorage<{ x: number; y: number }>(
  'globalTrafficIndicatorPosition',
  { x: -1, y: -1 }, // -1 means use default position
)

// Dragging state
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const containerRef = ref<HTMLElement | null>(null)

// Chart container ref
const chartContainer = ref<HTMLDivElement | null>(null)
let chart: Highcharts.Chart | undefined

// Traffic data
const downloadSpeed = computed(() => globalStore.latestTraffic?.down ?? 0)
const uploadSpeed = computed(() => globalStore.latestTraffic?.up ?? 0)
const memoryUsage = computed(() => globalStore.latestMemory?.inuse ?? 0)
const activeConnections = computed(
  () => connectionsStore.latestConnectionMsg?.connections?.length ?? 0,
)

// Format bytes helper
const formatBytes = (bytes: number) => byteSize(bytes).toString()

// Computed position style for expanded view
const positionStyle = computed(() => {
  // Default position (bottom-right)
  if (position.value.x === -1 || position.value.y === -1) {
    return { right: '16px', bottom: '16px' }
  }

  // Use absolute left/top positioning
  return {
    left: `${position.value.x}px`,
    top: `${position.value.y}px`,
  }
})

// Toggle visibility
function toggleVisibility() {
  isVisible.value = !isVisible.value
}

// Toggle collapsed state
function toggleCollapsed() {
  isCollapsed.value = !isCollapsed.value
}

// Expand from header
function expandFromHeader() {
  isCollapsed.value = false
  // Reset to default position when expanding from header
  position.value = { x: -1, y: -1 }
}

// Drag handlers
function onDragStart(e: MouseEvent | TouchEvent) {
  if (!containerRef.value) return

  isDragging.value = true

  const rect = containerRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY

  dragOffset.value = {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }

  // Reset to absolute positioning
  if (position.value.x === -1) {
    position.value.x = rect.left
    position.value.y = rect.top
  }

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
  document.addEventListener('touchmove', onDragMove)
  document.addEventListener('touchend', onDragEnd)
}

function onDragMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return

  const clientX = 'touches' in e ? e.touches[0]!.clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0]!.clientY : e.clientY

  let newX = clientX - dragOffset.value.x
  let newY = clientY - dragOffset.value.y

  // Clamp to viewport
  const rect = containerRef.value?.getBoundingClientRect()
  const width = rect?.width || 200
  const height = rect?.height || 150

  newX = Math.max(0, Math.min(window.innerWidth - width, newX))
  newY = Math.max(0, Math.min(window.innerHeight - height, newY))

  position.value.x = newX
  position.value.y = newY
}

function onDragEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('touchmove', onDragMove)
  document.removeEventListener('touchend', onDragEnd)
}

// Create sparkline chart
function createChart() {
  if (!chartContainer.value) return

  // Destroy existing chart if any
  if (chart) {
    chart.destroy()
    chart = undefined
  }

  const themeColors = getChartThemeColors()
  const containerWidth = chartContainer.value.offsetWidth || 200

  chart = Highcharts.chart(chartContainer.value, {
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      spacing: [0, 0, 0, 0],
      margin: [0, 0, 0, 0],
      animation: false,
      width: containerWidth,
      height: 48,
    },
    credits: { enabled: false },
    accessibility: { enabled: false },
    title: { text: undefined },
    legend: { enabled: false },
    xAxis: {
      visible: false,
      type: 'datetime',
    },
    yAxis: {
      visible: false,
      min: 0,
    },
    tooltip: {
      enabled: false,
    },
    plotOptions: {
      areaspline: {
        lineWidth: 1.5,
        marker: { enabled: false },
        fillOpacity: 0.2,
        animation: false,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: 'Upload',
        color: themeColors.seriesColors[0], // info (purple/blue) - matches upload icon, drawn first (behind)
        data:
          globalStore.trafficChartHistory.upload.length > 0
            ? [...globalStore.trafficChartHistory.upload].slice(-30)
            : [[Date.now(), 0]],
      },
      {
        type: 'areaspline',
        name: 'Download',
        color: themeColors.seriesColors[1], // success (green) - matches download icon, drawn last (on top)
        data:
          globalStore.trafficChartHistory.download.length > 0
            ? [...globalStore.trafficChartHistory.download].slice(-30)
            : [[Date.now(), 0]],
      },
    ],
  })
}

// Update chart data
function updateChart() {
  if (!chart) return

  const downloadData = [...globalStore.trafficChartHistory.download].slice(-30)
  const uploadData = [...globalStore.trafficChartHistory.upload].slice(-30)

  chart.series[0]?.setData(uploadData, false)
  chart.series[1]?.setData(downloadData, true)
}

// Update sidebar chart data
function updateSidebarChart() {
  if (!sidebarChart) return

  const downloadData = [...globalStore.trafficChartHistory.download].slice(-30)
  const uploadData = [...globalStore.trafficChartHistory.upload].slice(-30)

  sidebarChart.series[0]?.setData(uploadData, false)
  sidebarChart.series[1]?.setData(downloadData, true)
}

// Create sidebar chart
function createSidebarChart() {
  if (!sidebarChartContainer.value) return

  // Destroy existing chart if any
  if (sidebarChart) {
    sidebarChart.destroy()
    sidebarChart = undefined
  }

  const themeColors = getChartThemeColors()

  sidebarChart = Highcharts.chart(sidebarChartContainer.value, {
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      spacing: [0, 0, 0, 0],
      margin: [0, 0, 0, 0],
      animation: false,
      height: 40,
    },
    credits: { enabled: false },
    accessibility: { enabled: false },
    title: { text: undefined },
    legend: { enabled: false },
    xAxis: {
      visible: false,
      type: 'datetime',
    },
    yAxis: {
      visible: false,
      min: 0,
    },
    tooltip: {
      enabled: false,
    },
    plotOptions: {
      areaspline: {
        lineWidth: 1.5,
        marker: { enabled: false },
        fillOpacity: 0.2,
        animation: false,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: 'Upload',
        color: themeColors.seriesColors[0], // info (purple/blue) - matches upload icon, drawn first (behind)
        data:
          globalStore.trafficChartHistory.upload.length > 0
            ? [...globalStore.trafficChartHistory.upload].slice(-30)
            : [[Date.now(), 0]],
      },
      {
        type: 'areaspline',
        name: 'Download',
        color: themeColors.seriesColors[1], // success (green) - matches download icon, drawn last (on top)
        data:
          globalStore.trafficChartHistory.download.length > 0
            ? [...globalStore.trafficChartHistory.download].slice(-30)
            : [[Date.now(), 0]],
      },
    ],
  })
}

// Watch for traffic updates - create chart if needed, otherwise update
watch(
  () => globalStore.latestTraffic,
  (traffic) => {
    if (!traffic) return

    if (chart) {
      // Chart exists, just update it
      updateChart()
    } else if (chartContainer.value && isVisible.value && !isCollapsed.value) {
      // Chart doesn't exist but conditions are met - create it
      createChart()
    }

    // Also update sidebar chart
    if (sidebarChart) {
      updateSidebarChart()
    } else if (sidebarChartContainer.value) {
      createSidebarChart()
    }
  },
)

// Watch for theme changes
watch(
  () => configStore.curTheme,
  () => {
    if (chartContainer.value && !isCollapsed.value && isVisible.value) {
      createChart()
    }
    if (sidebarChartContainer.value) {
      createSidebarChart()
    }
  },
)

// Watch collapsed state to create/destroy chart
watch(isCollapsed, (collapsed) => {
  if (!collapsed && isVisible.value) {
    // When expanding, wait for DOM to update then create chart
    nextTick(() => {
      setTimeout(() => {
        if (chartContainer.value && globalStore.latestTraffic) {
          createChart()
        }
      }, 50)
    })
  } else if (collapsed && chart) {
    // When collapsing, destroy chart
    chart.destroy()
    chart = undefined
  }
})

// Watch visibility to create/destroy chart
watch(isVisible, (visible) => {
  if (visible && !isCollapsed.value) {
    nextTick(() => {
      setTimeout(() => {
        if (chartContainer.value && globalStore.latestTraffic) {
          createChart()
        }
      }, 50)
    })
  } else if (!visible && chart) {
    chart.destroy()
    chart = undefined
  }
})

// Watch sidebar expanded state to create sidebar chart
watch(
  () => configStore.sidebarExpanded,
  (expanded) => {
    if (expanded) {
      // When sidebar expands, wait for DOM to update then create chart
      nextTick(() => {
        setTimeout(() => {
          if (sidebarChartContainer.value && globalStore.latestTraffic) {
            createSidebarChart()
          }
        }, 100)
      })
    }
  },
)

// Check if teleport target exists
const headerTargetExists = ref(false)
const sidebarTargetExists = ref(false)
const sidebarExpandedTargetExists = ref(false)

// Sidebar chart container ref
const sidebarChartContainer = ref<HTMLDivElement | null>(null)
let sidebarChart: Highcharts.Chart | undefined

// Create chart on mount if conditions are met
onMounted(() => {
  // Check for header target after mount
  nextTick(() => {
    headerTargetExists.value = !!document.getElementById(
      'header-traffic-indicator',
    )
    sidebarTargetExists.value = !!document.getElementById(
      'sidebar-traffic-indicator',
    )
    sidebarExpandedTargetExists.value = !!document.getElementById(
      'sidebar-traffic-expanded',
    )
  })

  // Create chart if visible and expanded
  if (isVisible.value && !isCollapsed.value && globalStore.latestTraffic) {
    setTimeout(() => {
      if (chartContainer.value) {
        createChart()
      }
    }, 100)
  }

  // Create sidebar chart
  if (globalStore.latestTraffic) {
    setTimeout(() => {
      if (sidebarChartContainer.value) {
        createSidebarChart()
      }
    }, 150)
  }
})

// Cleanup on unmount
onBeforeUnmount(() => {
  if (chart) {
    chart.destroy()
    chart = undefined
  }
  if (sidebarChart) {
    sidebarChart.destroy()
    sidebarChart = undefined
  }
})
</script>

<template>
  <!-- Collapsed view in header (when target exists) -->
  <Teleport v-if="headerTargetExists" to="#header-traffic-indicator">
    <div
      v-if="isVisible && isCollapsed && globalStore.latestTraffic"
      class="flex cursor-pointer items-center gap-2 rounded-lg bg-[color-mix(in_oklch,var(--color-base-100)_50%,transparent)] px-2 py-1 transition-[background] duration-200 ease-in-out hover:bg-[var(--color-base-100)]"
      @click="expandFromHeader"
    >
      <div class="flex items-center gap-1">
        <IconArrowDown class="size-3 shrink-0 text-[var(--color-success)]" />
        <span class="font-mono text-xs"
          >{{ formatBytes(downloadSpeed) }}/s</span
        >
      </div>
      <div
        class="h-3 w-px bg-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)]"
      />
      <div class="flex items-center gap-1">
        <IconArrowUp class="size-3 shrink-0 text-[var(--color-info)]" />
        <span class="font-mono text-xs">{{ formatBytes(uploadSpeed) }}/s</span>
      </div>
    </div>
  </Teleport>

  <!-- Collapsed view in sidebar (when target exists) -->
  <Teleport v-if="sidebarTargetExists" to="#sidebar-traffic-indicator">
    <div
      v-if="globalStore.latestTraffic"
      class="w-full cursor-pointer rounded-lg bg-[color-mix(in_oklch,var(--color-base-100)_50%,transparent)] p-2 transition-[background] duration-200 ease-in-out hover:bg-[var(--color-base-100)]"
      @click="expandFromHeader"
    >
      <div class="flex items-center justify-center gap-1">
        <IconArrowDown class="size-3 shrink-0 text-[var(--color-success)]" />
        <span class="font-mono text-xs"
          >{{ formatBytes(downloadSpeed) }}/s</span
        >
      </div>
      <div class="flex items-center justify-center gap-1">
        <IconArrowUp class="size-3 shrink-0 text-[var(--color-info)]" />
        <span class="font-mono text-xs">{{ formatBytes(uploadSpeed) }}/s</span>
      </div>
    </div>
  </Teleport>

  <!-- Expanded view in sidebar with chart (when target exists) -->
  <Teleport v-if="sidebarExpandedTargetExists" to="#sidebar-traffic-expanded">
    <div
      v-if="globalStore.latestTraffic"
      class="w-full rounded-lg bg-[color-mix(in_oklch,var(--color-base-100)_50%,transparent)] p-2"
    >
      <!-- Mini chart -->
      <div ref="sidebarChartContainer" class="mb-2 h-10 w-full" />

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-1 text-xs">
        <div class="flex items-center gap-1">
          <IconArrowDown class="size-3 shrink-0 text-[var(--color-success)]" />
          <span class="truncate font-mono text-xs"
            >{{ formatBytes(downloadSpeed) }}/s</span
          >
        </div>
        <div class="flex items-center gap-1">
          <IconArrowUp class="size-3 shrink-0 text-[var(--color-info)]" />
          <span class="truncate font-mono text-xs"
            >{{ formatBytes(uploadSpeed) }}/s</span
          >
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Fallback collapsed view (floating, when no teleport targets exist) -->
  <div
    v-if="
      isVisible &&
      isCollapsed &&
      globalStore.latestTraffic &&
      !headerTargetExists &&
      !sidebarTargetExists
    "
    class="fixed right-4 bottom-4 z-50 flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-base-200)] px-3 py-2 shadow-lg"
    @click="expandFromHeader"
  >
    <div class="flex items-center gap-1">
      <IconArrowDown class="size-3 shrink-0 text-[var(--color-success)]" />
      <span class="font-mono text-xs">{{ formatBytes(downloadSpeed) }}/s</span>
    </div>
    <div
      class="h-3 w-px bg-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)]"
    />
    <div class="flex items-center gap-1">
      <IconArrowUp class="size-3 shrink-0 text-[var(--color-info)]" />
      <span class="font-mono text-xs">{{ formatBytes(uploadSpeed) }}/s</span>
    </div>
  </div>

  <!-- Toggle button when hidden -->
  <button
    v-if="!isVisible"
    class="fixed right-4 bottom-4 z-50 flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-[var(--color-primary)] text-[var(--color-primary-content)] shadow-lg transition-all duration-200 ease-in-out hover:scale-110"
    :title="$t('showTrafficIndicator')"
    @click="toggleVisibility"
  >
    <IconArrowUp class="size-4" />
  </button>

  <!-- Expanded floating view -->
  <Transition name="traffic-expand">
    <div
      v-if="isVisible && !isCollapsed && globalStore.latestTraffic"
      ref="containerRef"
      class="fixed z-50 min-w-56 rounded-xl bg-[var(--color-base-200)] shadow-lg select-none"
      :class="{ 'cursor-grabbing': isDragging }"
      :style="positionStyle"
    >
      <div class="flex flex-col gap-2 p-3">
        <!-- Header with drag handle and close button -->
        <div class="flex items-center justify-between gap-2">
          <div
            class="flex cursor-grab items-center gap-1 active:cursor-grabbing"
            @mousedown="onDragStart"
            @touchstart="onDragStart"
          >
            <IconGripVertical class="size-4 opacity-40" />
            <span class="text-xs font-semibold uppercase opacity-60">
              {{ $t('traffic') }}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <!-- Collapse button -->
            <button
              class="flex size-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--color-base-content)] transition-[background] duration-200 ease-in-out hover:bg-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)]"
              :title="$t('hideTrafficIndicator')"
              @click="toggleCollapsed"
            >
              <span class="text-xs">−</span>
            </button>
            <!-- Close button -->
            <button
              class="flex size-6 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--color-base-content)] transition-[background] duration-200 ease-in-out hover:bg-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)]"
              :title="$t('hideTrafficIndicator')"
              @click="toggleVisibility"
            >
              <IconX class="size-3" />
            </button>
          </div>
        </div>

        <!-- Mini chart -->
        <div ref="chartContainer" class="h-12 w-full" />

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <!-- Download speed -->
          <div class="flex items-center gap-1">
            <IconArrowDown
              class="size-3 shrink-0 text-[var(--color-success)]"
            />
            <span class="font-mono text-xs font-medium">
              {{ formatBytes(downloadSpeed) }}/s
            </span>
          </div>

          <!-- Upload speed -->
          <div class="flex items-center gap-1">
            <IconArrowUp class="size-3 shrink-0 text-[var(--color-info)]" />
            <span class="font-mono text-xs font-medium">
              {{ formatBytes(uploadSpeed) }}/s
            </span>
          </div>

          <!-- Memory -->
          <div class="flex items-center gap-1 opacity-70">
            <span>{{ $t('memory') }}:</span>
            <span class="font-mono text-xs">{{
              formatBytes(memoryUsage)
            }}</span>
          </div>

          <!-- Connections -->
          <div class="flex items-center gap-1 opacity-70">
            <span>{{ $t('connections') }}:</span>
            <span class="font-mono text-xs">{{ activeConnections }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Transition animations */
.traffic-expand-enter-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.traffic-expand-leave-active {
  transition: all 0.2s ease-in;
}

.traffic-expand-enter-from,
.traffic-expand-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
