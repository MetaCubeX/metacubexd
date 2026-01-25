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
  providerName?: string
  groupName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  providerName: '',
  groupName: '',
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
    >
      <!-- UDP indicator -->
      <div
        v-if="isUDP"
        class="absolute -top-1 -right-1 z-1 flex size-4 items-center justify-center rounded-full bg-info text-[0.625rem] font-bold text-info-content"
      >
        U
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
          <div class="text-xs font-semibold uppercase opacity-75">
            {{ proxyType }}
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
        <Transition name="proxy-tooltip">
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

              <template v-if="latencyTestHistory.length > 0">
                <ul class="m-0 max-h-60 w-full list-none overflow-y-auto p-0">
                  <li
                    v-for="(result, index) in latencyTestHistory"
                    :key="index"
                  >
                    <div
                      class="flex items-start gap-2 border-b border-[color-mix(in_oklch,var(--color-primary-content)_15%,transparent)] py-1.5 last:border-b-0"
                    >
                      <div class="shrink-0 opacity-80">
                        <IconCircleCheckFilled class="size-4" />
                      </div>
                      <div class="flex min-w-0 flex-col gap-1">
                        <time class="text-xs italic opacity-80">
                          {{ dayjs(result.time).format('YYYY-MM-DD HH:mm:ss') }}
                        </time>
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
        </Transition>
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
