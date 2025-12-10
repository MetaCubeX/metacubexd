<script setup lang="ts">
interface Props {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
  onSelect?: (name: string) => void
}

const props = defineProps<Props>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const proxyLatencies = computed(() =>
  props.proxyNameList.map((name): [string, number] => [
    name,
    proxiesStore.getLatencyByName(name, props.testUrl),
  ]),
)

function getDotClassName(latency: number | undefined, selected: boolean) {
  const notConnected = configStore.latencyQualityMap.NOT_CONNECTED
  const medium = configStore.latencyQualityMap.MEDIUM
  const high = configStore.latencyQualityMap.HIGH

  if (typeof latency !== 'number' || latency === notConnected) {
    return selected ? 'bg-white border-4 border-neutral' : 'bg-neutral'
  } else if (latency > high) {
    return selected ? 'bg-white border-4 border-red-500' : 'bg-red-500'
  } else if (latency > medium) {
    return selected ? 'bg-white border-4 border-yellow-500' : 'bg-yellow-500'
  }
  return selected ? 'bg-white border-4 border-green-600' : 'bg-green-600'
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-1">
      <div
        v-for="[name, latency] in proxyLatencies"
        :key="name"
        class="h-4 w-4 rounded-full"
        :class="[
          getDotClassName(latency, name === now),
          onSelect && 'cursor-pointer transition-transform hover:scale-125',
        ]"
        :title="name"
        @click.stop="onSelect && onSelect(name)"
      />
    </div>

    <Latency v-if="now" :proxy-name="now" :test-url="testUrl" />
  </div>
</template>
