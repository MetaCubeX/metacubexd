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
  const side = placement.value.split('-')[0]

  const staticSide: Record<string, string> = {
    top: 'bottom',
    right: 'left',
    bottom: 'top',
    left: 'right',
  }

  return {
    left: arrowData?.x != null ? `${arrowData.x}px` : '',
    top: arrowData?.y != null ? `${arrowData.y}px` : '',
    [staticSide[side]]: '-4px',
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
  <div
    ref="reference"
    class="indicator card relative w-full"
    :class="[
      isSelected
        ? 'bg-primary text-primary-content'
        : 'bg-neutral text-neutral-content',
    ]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <!-- UDP indicator -->
    <div v-if="isUDP" class="indicator-item badge badge-xs badge-info">U</div>

    <div
      class="card-body gap-1 space-y-1 p-2.5"
      :class="{ 'cursor-pointer': !!onClick }"
      @click="onClick"
    >
      <h2 class="card-title line-clamp-1 text-start text-sm break-all">
        {{ proxyName }}
      </h2>

      <div class="card-actions items-end justify-between gap-1">
        <div class="flex flex-col gap-0.5">
          <div class="text-xs font-semibold uppercase opacity-75">
            {{ proxyType }}
          </div>
        </div>

        <Latency
          :proxy-name="proxyName"
          :test-url="testUrl"
          :class="{ 'animate-pulse': isTesting }"
          @click.stop="handleLatencyTest"
        />
      </div>
    </div>

    <!-- Tooltip for latency history -->
    <Teleport to="body">
      <div
        v-if="isTooltipOpen"
        ref="floating"
        :style="floatingStyles"
        class="z-50 w-max max-w-xs rounded-box bg-primary p-2.5 text-primary-content shadow-lg"
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
            {{ specialTypes }}
          </div>

          <template v-if="latencyTestHistory.length > 0">
            <ul
              class="timeline timeline-vertical timeline-compact max-h-60 overflow-y-auto timeline-snap-icon"
            >
              <li v-for="(result, index) in latencyTestHistory" :key="index">
                <hr v-if="index > 0" />

                <div class="timeline-start space-y-2">
                  <time class="text-sm italic">
                    {{ dayjs(result.time).format('YYYY-MM-DD HH:mm:ss') }}
                  </time>

                  <div
                    class="badge block"
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

                <div class="timeline-middle">
                  <IconCircleCheckFilled class="size-4" />
                </div>

                <hr v-if="index !== latencyTestHistory.length - 1" />
              </li>
            </ul>
          </template>

          <div v-else class="text-sm opacity-75">
            {{ t('noLatencyHistory') }}
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
