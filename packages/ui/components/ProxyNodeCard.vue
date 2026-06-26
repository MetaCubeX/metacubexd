<script setup lang="ts">
import { IconCircleCheckFilled, IconStar } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import { getLatencyClassName } from '~/utils'
import { computeLatencyTrend, svgPathFromPoints } from '~/utils/latencyTrend'
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

// Latency trend for the mini chart — derived from the SAME kernel history the
// detail list renders (getLatencyHistoryByName), so sparkline, stats and list
// always agree.
const latencyTrendData = computed(() =>
  computeLatencyTrend(
    proxiesStore.getLatencyHistoryByName(props.proxyName, props.testUrl),
  ),
)

const sparklinePath = computed(() =>
  latencyTrendData.value
    ? svgPathFromPoints(latencyTrendData.value.points)
    : '',
)

// Score color class
const scoreColorClass = computed(() => {
  if (nodeScore.value === null) return ''
  return getScoreColorClass(nodeScore.value)
})

const {
  proxyType,
  isUDP,
  specialTypes,
  isTesting,
  stabilityBar,
  historyReversed,
  runLatencyTest,
} = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName, groupName: () => props.groupName },
)

// Anchor element for the lazily-mounted tooltip
const reference = ref<HTMLElement | null>(null)
const isTooltipOpen = ref(false)

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
  acquireSingletonPopover(closeTooltip)
  isTooltipOpen.value = true
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('touchstart', onDocumentClick, true)
}

function closeTooltip() {
  isTooltipOpen.value = false
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('touchstart', onDocumentClick, true)
  releaseSingletonPopover(closeTooltip)
}

function onDocumentClick(e: Event) {
  const target = e.target as Node
  if (reference.value?.contains(target)) return
  if (target instanceof Element && target.closest('[data-proxy-tooltip]'))
    return
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

// Mobile: a quick tap selects the node; a long-press opens the tooltip.
// Tap and the synthetic click that follows touchend must NOT both fire —
// long-press sets longPressFired so the resulting click skips selection.
let touchStartX = 0
let touchStartY = 0
let longPressFired = false
let longPressTimeout: ReturnType<typeof setTimeout> | null = null
const TOUCH_MOVE_THRESHOLD = 10
const LONG_PRESS_DURATION = 500

function clearLongPress() {
  if (longPressTimeout) {
    clearTimeout(longPressTimeout)
    longPressTimeout = null
  }
}

function onTouchStart(e: TouchEvent) {
  if (isTooltipOpen.value) return
  const touch = e.touches[0]
  if (!touch) return
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  longPressFired = false
  clearLongPress()
  longPressTimeout = setTimeout(() => {
    longPressFired = true
    openTooltip()
  }, LONG_PRESS_DURATION)
}

function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  const dx = Math.abs(touch.clientX - touchStartX)
  const dy = Math.abs(touch.clientY - touchStartY)
  // Moved past the threshold — this is a scroll, not a long-press.
  if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
    clearLongPress()
  }
}

function onTouchEnd() {
  // Lifted before the timer fired — a tap; let the click select the node.
  clearLongPress()
}

onBeforeUnmount(() => {
  clearTimeouts()
  clearLongPress()
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('touchstart', onDocumentClick, true)
  releaseSingletonPopover(closeTooltip)
})

function onClick() {
  // Long-press already opened the tooltip; swallow the trailing synthetic click.
  if (longPressFired) {
    longPressFired = false
    return
  }
  emit('click')
}

function handleLatencyTest() {
  clearTimeouts()
  openTooltip()
  runLatencyTest()
}
</script>

<template>
  <!-- Wrapper lifts the selected card above its neighbours -->
  <div class="relative h-full p-0.5" :class="isSelected ? 'z-10' : 'z-0'">
    <div
      ref="reference"
      class="proxy-card relative h-full w-full rounded-[0.625rem] select-none"
      :class="[
        isSelected
          ? 'proxy-card--selected bg-primary/15 text-base-content'
          : 'bg-neutral text-neutral-content',
        isTesting
          ? 'animate-[testingPulse_1.5s_ease-in-out_infinite] border border-[color-mix(in_oklch,var(--color-success)_50%,transparent)]'
          : isSelected
            ? 'border border-primary'
            : 'border border-transparent',
      ]"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- Top-edge light catch (subtle highlight) -->
      <span aria-hidden="true" class="proxy-card__highlight" />
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
        class="flex h-full flex-col gap-2 p-[0.625rem]"
        :class="{ 'cursor-pointer': !!onClick }"
        role="button"
        tabindex="0"
        :aria-pressed="isSelected"
        :aria-label="proxyName"
        @click="onClick"
        @keydown.enter.prevent="onClick"
        @keydown.space.prevent="onClick"
      >
        <h2
          class="m-0 line-clamp-1 text-start text-sm leading-tight font-semibold break-all"
        >
          <ProxyNodeName :name="proxyName" />
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
            :provider-name="providerName"
            :group-name="groupName"
            :class="{ 'animate-pulse': isTesting }"
            interactive
            @click.stop="handleLatencyTest"
          />
        </div>

        <div class="mt-auto min-h-[0.375rem]">
          <!-- Latency stability bar -->
          <div
            v-if="stabilityBar.length > 0"
            class="flex h-1.5 w-full gap-px overflow-hidden rounded-full"
          >
            <div
              v-for="(result, index) in stabilityBar"
              :key="index"
              class="h-full flex-1 bg-current first:rounded-l-full last:rounded-r-full"
              :class="result.colorClass"
            />
          </div>
          <div
            v-else
            class="h-1.5 w-full rounded-full bg-current opacity-[0.15]"
            aria-hidden="true"
          />
        </div>
      </div>

      <!-- Tooltip for latency history (mounted lazily while open) -->
      <ProxyNodeTooltip
        v-if="isTooltipOpen"
        :reference="reference"
        @mouse-enter="onTooltipMouseEnter"
        @mouse-leave="onTooltipMouseLeave"
      >
        <div class="flex flex-col items-center gap-2">
          <h2 class="m-0 w-full text-center text-lg font-bold break-all">
            <ProxyNodeName :name="proxyName" />
          </h2>

          <div
            v-if="specialTypes"
            class="w-full text-center text-xs uppercase opacity-80"
          >
            ({{ specialTypes }})
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

          <template v-if="historyReversed.length > 0">
            <ul
              class="m-0 max-h-48 w-full [scrollbar-width:thin] [scrollbar-color:color-mix(in_oklch,var(--color-primary-content)_30%,transparent)_transparent] list-none overflow-y-auto p-0 pr-2 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-sm [&::-webkit-scrollbar-thumb]:bg-[color-mix(in_oklch,var(--color-primary-content)_30%,transparent)] [&::-webkit-scrollbar-track]:bg-transparent"
            >
              <li v-for="(result, index) in historyReversed" :key="index">
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
      </ProxyNodeTooltip>
    </div>
  </div>
</template>

<style>
.proxy-card {
  transition:
    transform var(--dur-base) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-soft),
    background-color var(--dur-base) var(--ease-soft);
  will-change: transform;
}
.proxy-card:hover {
  transform: translateY(-2px) scale(1.015);
  box-shadow: var(--lift-2);
}
.proxy-card:active {
  transform: translateY(0) scale(0.98);
  transition-duration: var(--dur-instant);
  transition-timing-function: var(--ease-press);
}
.proxy-card--selected {
  transform: scale(1.02);
}
.proxy-card--selected:hover {
  transform: translateY(-2px) scale(1.03);
}
.proxy-card--selected:active {
  transform: scale(1);
}

/* Top-edge light catch — sits above the card body, ignores pointer events */
.proxy-card__highlight {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in oklch, white 14%, transparent) 0%,
    transparent 30%
  );
  mix-blend-mode: overlay;
  opacity: 0.7;
  z-index: 2;
}
.proxy-card--selected .proxy-card__highlight {
  background: linear-gradient(
    180deg,
    color-mix(in oklch, white 22%, transparent) 0%,
    transparent 35%
  );
}

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
</style>
