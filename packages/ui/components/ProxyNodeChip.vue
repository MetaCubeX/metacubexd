<script setup lang="ts">
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

const emit = defineEmits<{ click: [] }>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)

// Latency-quality colored dot (mirrors the stability-bar coloring in ListItem)
const latency = computed(() =>
  proxiesStore.getLatencyByName(props.proxyName, props.testUrl),
)
const dotColorClass = computed(() =>
  latency.value
    ? getLatencyClassName(latency.value, configStore.latencyQualityMap)
    : 'text-neutral-content/30',
)

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
  <button
    type="button"
    class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-all duration-200"
    :class="
      isSelected
        ? 'bg-primary text-primary-content shadow-sm'
        : 'bg-neutral text-neutral-content hover:shadow-md'
    "
    @click="emit('click')"
  >
    <span
      class="size-2 shrink-0 rounded-full bg-current"
      :class="isSelected ? '' : dotColorClass"
    />
    <span class="max-w-[12rem] truncate font-medium">
      <ProxyNodeName :name="proxyName" />
    </span>
    <span v-if="isUDP" class="text-[0.625rem] font-semibold opacity-70">U</span>
    <Latency
      :proxy-name="proxyName"
      :test-url="testUrl"
      :provider-name="providerName"
      @click.stop="handleLatencyTest"
    />
  </button>
</template>
