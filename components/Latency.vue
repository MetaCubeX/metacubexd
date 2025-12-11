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
    class="badge flex w-11 items-center justify-center whitespace-nowrap"
    :class="[latencyClass, extraClass]"
    @click="$emit('click', $event)"
  >
    <span v-if="isTesting" class="loading loading-sm loading-infinity" />
    <template v-else>{{ latencyText }}</template>
  </span>
</template>
