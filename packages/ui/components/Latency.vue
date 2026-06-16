<script setup lang="ts">
import { getLatencyClassName } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  providerName?: string
  groupName?: string
  class?: string | Record<string, boolean>
  // When true the pill is a real keyboard-operable control (own tab stop +
  // Enter/Space). Left false for the display-only call sites (ProxyPreviewBar)
  // and where it sits inside another button (ProxyNodeChip) to avoid a stray
  // tab stop / nested interactive.
  interactive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  providerName: '',
  groupName: '',
  interactive: false,
})

defineEmits<{
  click: [event: Event]
}>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()
const { t } = useI18n()

const extraClass = computed(() => props.class || '')

const latency = computed(() =>
  proxiesStore.getLatencyByName(props.proxyName, props.testUrl),
)

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

const latencyClass = computed(() =>
  getLatencyClassName(latency.value, configStore.latencyQualityMap),
)

const latencyText = computed(() => latency.value || '---')

// Screen-reader label: the bare number alone reads e.g. "88" with no unit or
// purpose, and the spinner announces nothing. Give it a unit, a "testing"
// state, and — only when interactive — the action verb.
const ariaLabel = computed(() => {
  if (isTesting.value) return t('recommendation.testing')
  const value = latency.value ? `${latency.value} ms` : '---'
  return props.interactive ? `${t('testLatency')}, ${value}` : value
})
</script>

<template>
  <span
    class="latency-pill flex w-11 cursor-pointer items-center justify-center rounded-md px-1.5 py-1 text-xs font-semibold whitespace-nowrap tabular-nums"
    :class="[latencyClass, extraClass]"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="ariaLabel"
    :aria-busy="isTesting || undefined"
    @click="$emit('click', $event)"
    @keydown.enter.prevent.stop="interactive && $emit('click', $event)"
    @keydown.space.prevent.stop="interactive && $emit('click', $event)"
  >
    <span
      v-if="isTesting"
      aria-hidden="true"
      class="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
    <Transition v-else name="latency-flip" mode="out-in">
      <span :key="latencyText">{{ latencyText }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.latency-pill {
  position: relative;
  background-color: color-mix(in oklch, currentColor 12%, transparent);
  box-shadow: var(--inner-highlight);
  transition:
    transform var(--dur-base) var(--ease-spring),
    background-color var(--dur-fast) var(--ease-soft);
}
.latency-pill:hover {
  transform: scale(1.06);
  background-color: color-mix(in oklch, currentColor 18%, transparent);
}
.latency-pill:active {
  transform: scale(0.92);
  transition-duration: var(--dur-instant);
  transition-timing-function: var(--ease-press);
}

/* Number flip when latency value changes */
.latency-flip-enter-active,
.latency-flip-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease-soft),
    transform var(--dur-base) var(--ease-spring);
}
.latency-flip-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.85);
}
.latency-flip-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.85);
}
</style>
