<script setup lang="ts">
import {
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from '@floating-ui/vue'
import { IconCircleCheckFilled } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import {
  filterSpecialProxyType,
  formatProxyType,
  getLatencyClassName,
} from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
})

const emit = defineEmits<{
  click: []
}>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()
const { t } = useI18n()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)
const isTesting = computed(
  () => proxiesStore.proxyLatencyTestingMap[props.proxyName] || false,
)

const specialTypes = computed(() => {
  if (!proxyNode.value || !filterSpecialProxyType(proxyNode.value.type))
    return null

  return [
    proxyNode.value.xudp && 'xudp',
    proxyNode.value.udp && 'udp',
    proxyNode.value.tfo && 'TFO',
  ]
    .filter(Boolean)
    .join(' / ')
})

const latencyTestHistory = computed(() =>
  proxiesStore
    .getLatencyHistoryByName(props.proxyName, props.testUrl)
    .toReversed(),
)

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

function onMouseEnter() {
  clearTimeouts()
  openTimeout = setTimeout(() => {
    isTooltipOpen.value = true
  }, 300)
}

function onMouseLeave() {
  clearTimeouts()
  // Delay closing to allow mouse to move to tooltip
  closeTimeout = setTimeout(() => {
    isTooltipOpen.value = false
  }, 100)
}

function onTooltipMouseEnter() {
  clearTimeouts()
}

function onTooltipMouseLeave() {
  clearTimeouts()
  isTooltipOpen.value = false
}

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
  <div class="relative z-0" :class="isSelected ? 'z-10' : ''">
    <div
      ref="reference"
      class="relative rounded-lg transition-all duration-300"
      :class="
        isSelected
          ? 'animate-glow-pulse bg-primary text-primary-content'
          : 'bg-neutral text-neutral-content hover:shadow-md'
      "
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div
        class="flex items-center gap-2 px-3 py-1.5"
        :class="{ 'cursor-pointer hover:opacity-80': !!onClick }"
        @click="onClick"
      >
        <!-- Selected indicator -->
        <IconCircleCheckFilled v-if="isSelected" class="size-4 shrink-0" />

        <!-- Proxy name -->
        <span class="line-clamp-1 min-w-0 flex-1 text-sm font-medium break-all">
          {{ proxyName }}
        </span>

        <!-- UDP indicator -->
        <span
          v-if="isUDP"
          class="shrink-0 rounded bg-info px-1.5 py-0.5 text-[0.625rem] font-semibold text-info-content"
          >U</span
        >

        <!-- Special types -->
        <span
          v-if="specialTypes"
          class="hidden text-xs uppercase opacity-60 sm:inline"
        >
          {{ specialTypes }}
        </span>

        <!-- Proxy type -->
        <span class="hidden text-xs uppercase opacity-75 sm:inline">
          {{ proxyType }}
        </span>

        <!-- Latency -->
        <Latency
          :proxy-name="proxyName"
          :test-url="testUrl"
          class="shrink-0"
          :class="{ 'animate-pulse': isTesting }"
          @click.stop="handleLatencyTest"
        />
      </div>

      <!-- Tooltip for latency history -->
      <Teleport to="body">
        <div
          v-if="isTooltipOpen"
          ref="floating"
          :style="floatingStyles"
          class="z-50 w-max max-w-80 rounded-xl bg-primary p-2.5 text-primary-content shadow-lg"
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
            <h2 class="text-lg font-bold">{{ proxyName }}</h2>

            <div v-if="specialTypes" class="w-full text-xs uppercase">
              ({{ specialTypes }})
            </div>

            <template v-if="latencyTestHistory.length > 0">
              <div class="flex max-h-60 w-full flex-col gap-2 overflow-y-auto">
                <div
                  v-for="(result, index) in latencyTestHistory"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <div
                    class="mt-1.5 size-2 rounded-full bg-current opacity-50"
                  />
                  <div class="flex flex-col gap-1">
                    <time class="text-sm italic">
                      {{ dayjs(result.time).format('YYYY-MM-DD HH:mm:ss') }}
                    </time>
                    <div
                      class="inline-block rounded px-2 py-0.5 text-xs"
                      :class="
                        getLatencyClassName(
                          result.delay,
                          configStore.latencyQualityMap,
                        )
                      "
                    >
                      {{ result.delay || '---' }}
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div v-else class="text-sm opacity-75">
              {{ t('noLatencyHistory') }}
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
