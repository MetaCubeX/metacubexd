<script setup lang="ts">
import { IconCircleCheckFilled } from '@tabler/icons-vue'
import dayjs from 'dayjs'
import { getLatencyClassName } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  providerName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  providerName: '',
})

const emit = defineEmits<{
  click: []
}>()

const configStore = useConfigStore()
const { t } = useI18n()

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
  { providerName: () => props.providerName },
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
}

function closeTooltip() {
  isTooltipOpen.value = false
  releaseSingletonPopover(closeTooltip)
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

function onClick() {
  emit('click')
}

function handleLatencyTest() {
  clearTimeouts()
  openTooltip()
  runLatencyTest()
}

onBeforeUnmount(() => {
  clearTimeouts()
  releaseSingletonPopover(closeTooltip)
})
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
        role="button"
        tabindex="0"
        :aria-pressed="isSelected"
        :aria-label="proxyName"
        @click="onClick"
        @keydown.enter.prevent="onClick"
        @keydown.space.prevent="onClick"
      >
        <!-- Selected indicator -->
        <IconCircleCheckFilled v-if="isSelected" class="size-4 shrink-0" />

        <!-- Proxy name -->
        <span class="line-clamp-1 min-w-0 flex-1 text-sm font-medium break-all">
          <ProxyNodeName :name="proxyName" />
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
        <div class="flex shrink-0 flex-col items-end gap-1">
          <Latency
            :proxy-name="proxyName"
            :test-url="testUrl"
            :provider-name="providerName"
            :class="{ 'animate-pulse': isTesting }"
            interactive
            @click.stop="handleLatencyTest"
          />
          <!-- Latency stability bar -->
          <div
            v-if="stabilityBar.length > 0"
            class="flex h-[3px] w-full max-w-[44px] gap-px overflow-hidden rounded-full"
          >
            <div
              v-for="(result, index) in stabilityBar"
              :key="index"
              class="h-full flex-1 bg-current first:rounded-l-full last:rounded-r-full"
              :class="result.colorClass"
            />
          </div>
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
          <h2 class="w-full text-center text-lg font-bold break-all">
            <ProxyNodeName :name="proxyName" />
          </h2>

          <div v-if="specialTypes" class="w-full text-xs uppercase">
            ({{ specialTypes }})
          </div>

          <template v-if="historyReversed.length > 0">
            <div class="flex max-h-60 w-full flex-col gap-2 overflow-y-auto">
              <div
                v-for="(result, index) in historyReversed"
                :key="index"
                class="flex items-start gap-2"
              >
                <div class="mt-1.5 size-2 rounded-full bg-current opacity-50" />
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
      </ProxyNodeTooltip>
    </div>
  </div>
</template>
