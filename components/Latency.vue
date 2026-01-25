<script setup lang="ts">
import { getLatencyClassName } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  class?: string | Record<string, boolean>
}

const props = defineProps<Props>()

defineEmits<{
  click: [event: MouseEvent]
}>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const extraClass = computed(() => props.class || '')

const latency = computed(() =>
  proxiesStore.getLatencyByName(props.proxyName, props.testUrl),
)

const isTesting = computed(
  () => proxiesStore.proxyLatencyTestingMap[props.proxyName] || false,
)

const latencyClass = computed(() =>
  getLatencyClassName(latency.value, configStore.latencyQualityMap),
)

const latencyText = computed(() => latency.value || '---')
</script>

<template>
  <span
    class="flex w-11 cursor-pointer items-center justify-center rounded-md px-1.5 py-1 text-xs font-semibold whitespace-nowrap transition-all duration-200 ease-in-out hover:scale-105"
    :class="[latencyClass, extraClass]"
    @click="$emit('click', $event)"
  >
    <span
      v-if="isTesting"
      class="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
    />
    <template v-else>{{ latencyText }}</template>
  </span>
</template>
