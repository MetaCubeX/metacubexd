<script setup lang="ts">
import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/vue'
import { IconCircleCheckFilled, IconStar } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import {
  filterSpecialProxyType,
  formatProxyType,
  getLatencyClassName,
} from '~/utils'
import {
  calculateNodeScore,
  formatTimeSince,
  getScoreColorClass,
} from '~/utils/nodeScoring'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  isRecommended?: boolean
  providerName?: string
  groupName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  isRecommended: false,
  providerName: '',
  groupName: '',
})

const emit = defineEmits<{
  click: []
}>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()
const nodeRecommendationStore = useNodeRecommendationStore()
const { t } = useI18n()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)

// Node performance data
const nodePerformance = computed(() =>
  nodeRecommendationStore.getNodePerformance(props.proxyName),
)

// Node score
const nodeScore = computed(() => {
  const perf = nodePerformance.value
  if (!perf || perf.history.length === 0) return null
  return calculateNodeScore(perf, nodeRecommendationStore.scoringWeights)
})

// Last test time formatted
const lastTestTimeFormatted = computed(() => {
  const perf = nodePerformance.value
  if (!perf) return null
  return formatTimeSince(perf.lastTestTime)
})

// Latency trend data for mini chart (from nodeRecommendationStore)
const latencyTrendData = computed(() => {
  const perf = nodePerformance.value
  if (!perf || perf.history.length < 2) return null

  // Get successful latency values (most recent first, so reverse for chronological order)
  const latencies = perf.history
    .filter((h) => h.success && h.latency !== null)
    .map((h) => h.latency as number)
    .slice(0, 10)
    .reverse()

  if (latencies.length < 2) return null

  const min = Math.min(...latencies)
  const max = Math.max(...latencies)
  const range = max - min || 1
  const avg = Math.round(
    latencies.reduce((a, b) => a + b, 0) / latencies.length,
  )

  // Calculate jitter (standard deviation)
  const variance =
    latencies.reduce((sum, lat) => sum + (lat - avg) ** 2, 0) / latencies.length
  const jitter = Math.round(Math.sqrt(variance))

  // Calculate success rate
  const totalTests = perf.history.length
  const successTests = perf.history.filter((h) => h.success).length
  const successRate = Math.round((successTests / totalTests) * 100)

  // Normalize to 0-100 for SVG viewBox
  const points = latencies.map((lat, i) => ({
    x: (i / (latencies.length - 1)) * 100,
    y: 100 - ((lat - min) / range) * 80 - 10, // 10-90 range to leave padding
  }))

  return {
    points,
    min,
    max,
    avg,
    jitter,
    successRate,
    totalTests,
    successTests,
  }
})

// SVG path for sparkline
const sparklinePath = computed(() => {
  if (!latencyTrendData.value) return ''
  const { points } = latencyTrendData.value
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

// Score color class
const scoreColorClass = computed(() => {
  if (nodeScore.value === null) return ''
  return getScoreColorClass(nodeScore.value)
})

// Check if this node is being tested (individually, via provider, or via group)
const isProviderTesting = computed(() =>
  props.providerName
    ? proxiesStore.proxyProviderLatencyTestingMap[props.providerName] || false
    : false,
)
const isGroupTesting = computed(() =>
  props.groupName
    ? proxiesStore.proxyGroupLatencyTestingMap[props.groupName] || false
    : false,
)
const isTesting = computed(
  () =>
    proxiesStore.proxyLatencyTestingMap[props.proxyName] ||
    isProviderTesting.value ||
    isGroupTesting.value,
)

const specialTypes = computed(() => {
  if (!filterSpecialProxyType(proxyNode.value?.type)) return null

  return `(${[
    proxyNode.value?.xudp && 'xudp',
    proxyNode.value?.udp && 'udp',
    proxyNode.value?.tfo && 'TFO',
  ]
    .filter(Boolean)
    .join(' / ')})`
})

const latencyTestHistory = computed(() =>
  proxiesStore
    .getLatencyHistoryByName(props.proxyName, props.testUrl)
    .toReversed(),
)

// Stability bar: chronological order, each segment colored by latency quality
const latencyStabilityBar = computed(() => {
  const history = proxiesStore.getLatencyHistoryByName(
    props.proxyName,
    props.testUrl,
  )
  return history.map((result) => ({
    colorClass: result.delay
      ? getLatencyClassName(result.delay, configStore.latencyQualityMap)
      : 'text-neutral-content/30',
  }))
})

// Floating UI for tooltip
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const floatingArrow = ref<HTMLElement | null>(null)
const isTooltipOpen = ref(false)

const { floatingStyles, middlewareData, placement } = useFloating(
  reference,
  floating,
  {
    placement: 'top',
    strategy: 'fixed',
    middleware: [
      offset(10),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: floatingArrow }),
    ],
    whileElementsMounted: autoUpdate,
  },
)

// Arrow positioning based on placement
const arrowStyles = computed(() => {
  const arrowData = middlewareData.value.arrow
  const side = placement.value.split('-')[0] || 'top'

  const staticSide: Record<string, string> = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }

  const sideKey = staticSide[side] || 'bottom'

  return {
    left: arrowData?.x != null ? `${arrowData.x}px` : '',
    top: arrowData?.y != null ? `${arrowData.y}px` : '',
    [sideKey]: '-4px',
  }
})

let openTimeout: ReturnType<typeof setTimeout> | null = null
let closeTimeout: ReturnType<typeof setTimeout> | null = null

function clearTimeouts() {
  if (openTimeout) {
    clearTimeout(openTimeout)
    openTimeout = null
  }
  if (closeTimeout) {
    clearTimeout(closeTimeout)
    closeTimeout = null
  }
}

function openTooltip() {
  isTooltipOpen.value = true
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('touchstart', onDocumentClick, true)
}

function closeTooltip() {
  isTooltipOpen.value = false
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('touchstart', onDocumentClick, true)
}

function onDocumentClick(e: Event) {
  const target = e.target as Node
  if (reference.value?.contains(target) || floating.value?.contains(target)) {
    return
  }
  closeTooltip()
}

function onMouseEnter() {
  clearTimeouts()
  openTimeout = setTimeout(() => {
    openTooltip()
  }, 300)
}

function onMouseLeave() {
  clearTimeouts()
  // Delay closing to allow mouse to move to tooltip
  closeTimeout = setTimeout(() => {
    closeTooltip()
  }, 100)
}

function onTooltipMouseEnter() {
  clearTimeouts()
}

function onTooltipMouseLeave() {
  clearTimeouts()
  closeTooltip()
}

let touchStartX = 0
let touchStartY = 0
let isTouchMoved = false
const TOUCH_MOVE_THRESHOLD = 10

function onTouchStart(e: TouchEvent) {
  if (isTooltipOpen.value) {
    return
  }
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  isTouchMoved = false
}

function onTouchMove(e: TouchEvent) {
  if (isTouchMoved) return
  const touch = e.touches[0]
  if (!touch) return
  const dx = Math.abs(touch.clientX - touchStartX)
  const dy = Math.abs(touch.clientY - touchStartY)
  if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
    isTouchMoved = true
  }
}

function onTouchEnd() {
  if (!isTouchMoved && !isTooltipOpen.value) {
    openTooltip()
  }
}

onBeforeUnmount(() => {
  clearTimeouts()
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('touchstart', onDocumentClick, true)
})

function onClick() {
  emit('click')
}

function handleLatencyTest() {
  proxiesStore.proxyLatencyTest(
    props.proxyName,
    proxyNode.value?.provider || '',
    props.testUrl,
    props.timeout,
  )
}
</script>

<template>
  <!-- Wrapper for glow effect -->
  <div class="relative p-1" :class="isSelected ? 'z-10' : 'z-0'">
    <div
      ref="reference"
      class="relative w-full rounded-[0.625rem] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="[
        isSelected
          ? 'scale-[1.02] animate-[glowPulse_2s_ease-in-out_infinite] bg-primary text-primary-content'
          : 'bg-neutral text-neutral-content hover:scale-[1.01] hover:shadow-[0_4px_12px_color-mix(in_oklch,var(--color-base-content)_15%,transparent)]',
        isTesting
          ? 'animate-[testingPulse_1.5s_ease-in-out_infinite] border border-[color-mix(in_oklch,var(--color-success)_50%,transparent)]'
          : '',
      ]"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- UDP indicator -->
      <div
        v-if="isUDP"
        class="absolute -top-1 -right-1 z-1 flex size-4 items-center justify-center rounded-full bg-info text-[0.625rem] font-bold text-info-content"
      >
        U
      </div>

      <!-- Recommended badge -->
      <div
        v-if="isRecommended"
        class="absolute -top-1 -left-1 z-1 flex size-4 items-center justify-center rounded-full bg-warning text-warning-content"
        :title="t('recommendation.recommended', 'Recommended')"
      >
        <IconStar class="size-3" />
      </div>

      <div
        class="flex flex-col gap-2 p-[0.625rem]"
        :class="{ 'cursor-pointer': !!onClick }"
        @click="onClick"
      >
        <h2
          class="m-0 line-clamp-1 text-start text-sm leading-tight font-semibold break-all"
        >
          {{ proxyName }}
        </h2>

        <div class="flex items-end justify-between gap-1">
          <div class="flex flex-col gap-0.5">
            <div class="text-xs font-semibold uppercase opacity-75">
              {{ proxyType }}
            </div>
            <!-- Score display -->
            <div
              v-if="nodeScore !== null"
              class="flex items-center gap-1 text-[0.625rem]"
            >
              <span :class="scoreColorClass" class="font-bold">
                {{ nodeScore }}
              </span>
              <span v-if="lastTestTimeFormatted" class="opacity-50">
                {{ lastTestTimeFormatted }}
              </span>
            </div>
          </div>

          <Latency
            :proxy-name="proxyName"
            :test-url="testUrl"
            :class="{ 'animate-pulse': isTesting }"
            @click.stop="handleLatencyTest"
          />
        </div>

        <!-- Latency stability bar -->
        <div
          v-if="latencyTestHistory.length > 1"
          class="flex h-1.5 w-full gap-px overflow-hidden rounded-full"
        >
          <div
            v-for="(result, index) in latencyStabilityBar"
            :key="index"
            class="h-full flex-1 bg-current first:rounded-l-full last:rounded-r-full"
            :class="result.colorClass"
          />
        </div>
      </div>

      <!-- Tooltip for latency history -->
      <Teleport to="body">
        <div
          v-if="isTooltipOpen"
          ref="floating"
          :style="floatingStyles"
          class="z-50 w-max max-w-80 rounded-xl bg-primary p-3 text-primary-content shadow-[0_10px_40px_color-mix(in_oklch,var(--color-base-content)_30%,transparent)]"
          @mouseenter="onTooltipMouseEnter"
          @mouseleave="onTooltipMouseLeave"
        >
          <!-- Arrow -->
          <div
            ref="floatingArrow"
            class="absolute size-2 rotate-45 bg-primary"
            :style="arrowStyles"
          />

          <div class="flex flex-col items-center gap-2">
            <h2 class="m-0 text-lg font-bold">{{ proxyName }}</h2>

            <div
              v-if="specialTypes"
              class="w-full text-center text-xs uppercase opacity-80"
            >
              {{ specialTypes }}
            </div>

            <!-- Latency Trend Mini Chart -->
            <div
              v-if="latencyTrendData"
              class="w-full rounded-lg bg-[color-mix(in_oklch,var(--color-primary-content)_10%,transparent)] p-2"
            >
              <div
                class="mb-1 flex items-center justify-between text-[0.625rem] opacity-70"
              >
                <span>{{ latencyTrendData.min }}ms</span>
                <span>avg: {{ latencyTrendData.avg }}ms</span>
                <span>{{ latencyTrendData.max }}ms</span>
              </div>
              <svg
                viewBox="0 0 100 50"
                class="h-8 w-full"
                preserveAspectRatio="none"
              >
                <!-- Grid lines -->
                <line
                  x1="0"
                  y1="25"
                  x2="100"
                  y2="25"
                  stroke="currentColor"
                  stroke-opacity="0.1"
                  stroke-dasharray="2,2"
                />
                <!-- Sparkline -->
                <path
                  :d="sparklinePath"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="opacity-80"
                />
                <!-- Data points -->
                <circle
                  v-for="(point, idx) in latencyTrendData.points"
                  :key="idx"
                  :cx="point.x"
                  :cy="point.y"
                  r="2"
                  fill="currentColor"
                  class="opacity-60"
                />
              </svg>
              <!-- Stability stats -->
              <div
                class="mt-1 flex items-center justify-between text-[0.625rem] opacity-70"
              >
                <span>jitter: {{ latencyTrendData.jitter }}ms</span>
                <span
                  >{{ latencyTrendData.successTests }}/{{
                    latencyTrendData.totalTests
                  }}
                  ({{ latencyTrendData.successRate }}%)</span
                >
              </div>
            </div>

            <template v-if="latencyTestHistory.length > 0">
              <ul
                class="m-0 max-h-48 w-full list-none overflow-y-auto p-0 pr-2 [scrollbar-color:color-mix(in_oklch,var(--color-primary-content)_30%,transparent)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_oklch,var(--color-primary-content)_30%,transparent)] [&::-webkit-scrollbar-track]:bg-transparent"
              >
                <li v-for="(result, index) in latencyTestHistory" :key="index">
                  <div
                    class="flex items-start gap-2 border-b border-[color-mix(in_oklch,var(--color-primary-content)_15%,transparent)] py-1.5 last:border-b-0"
                  >
                    <div class="shrink-0 opacity-80">
                      <IconCircleCheckFilled class="size-4" />
                    </div>
                    <div class="flex min-w-0 flex-1 flex-col gap-1">
                      <time class="text-xs italic opacity-80">
                        {{ dayjs(result.time).format('YYYY-MM-DD HH:mm:ss') }}
                      </time>
                      <div class="flex items-center gap-2">
                        <div
                          class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                          :class="
                            getLatencyClassName(
                              result.delay,
                              configStore.latencyQualityMap,
                            )
                          "
                        >
                          {{ result.delay || '---' }}
                        </div>
                        <div
                          v-if="result.delay && latencyTrendData"
                          class="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--color-primary-content)_15%,transparent)]"
                        >
                          <div
                            class="h-full rounded-full bg-current transition-all duration-300"
                            :class="
                              getLatencyClassName(
                                result.delay,
                                configStore.latencyQualityMap,
                              )
                            "
                            :style="{
                              width: `${Math.min((result.delay / latencyTrendData.max) * 100, 100)}%`,
                            }"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </template>

            <div v-else class="text-center text-sm opacity-75">
              {{ t('noLatencyHistory') }}
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style>
@keyframes testingPulse {
  0%,
  100% {
    box-shadow: 0 0 8px
      color-mix(in oklch, var(--color-success) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 16px
      color-mix(in oklch, var(--color-success) 50%, transparent);
  }
}

@keyframes glowPulse {
  0%,
  100% {
    box-shadow: 0 0 15px
      color-mix(in oklch, var(--color-primary) 40%, transparent);
  }
  50% {
    box-shadow: 0 0 25px
      color-mix(in oklch, var(--color-primary) 60%, transparent);
  }
}
</style>
