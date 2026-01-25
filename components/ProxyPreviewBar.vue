<script setup lang="ts">
interface Props {
  proxyNameList: string[]
  testUrl: string | null
  now?: string
}

const props = defineProps<Props>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const latencyList = computed(() =>
  props.proxyNameList.map((name) =>
    proxiesStore.getLatencyByName(name, props.testUrl),
  ),
)

const all = computed(() => latencyList.value.length || 1)

const good = computed(
  () =>
    latencyList.value.filter(
      (latency) =>
        latency > configStore.latencyQualityMap.NOT_CONNECTED &&
        latency <= configStore.latencyQualityMap.MEDIUM,
    ).length,
)

const middle = computed(
  () =>
    latencyList.value.filter(
      (latency) =>
        latency > configStore.latencyQualityMap.MEDIUM &&
        latency <= configStore.latencyQualityMap.HIGH,
    ).length,
)

const slow = computed(
  () =>
    latencyList.value.filter(
      (latency) => latency > configStore.latencyQualityMap.HIGH,
    ).length,
)

const notConnected = computed(
  () =>
    latencyList.value.filter(
      (latency) => latency === configStore.latencyQualityMap.NOT_CONNECTED,
    ).length,
)

const goodPercent = computed(() => (good.value * 100) / all.value)
const middlePercent = computed(() => (middle.value * 100) / all.value)
const slowPercent = computed(() => (slow.value * 100) / all.value)
const notConnectedPercent = computed(
  () => (notConnected.value * 100) / all.value,
)
</script>

<template>
  <div class="flex items-center gap-2">
    <div
      class="my-1 flex flex-1 items-center justify-center overflow-hidden rounded-2xl"
    >
      <div class="h-2 bg-green-600" :style="{ width: `${goodPercent}%` }" />
      <div class="h-2 bg-yellow-500" :style="{ width: `${middlePercent}%` }" />
      <div class="h-2 bg-red-500" :style="{ width: `${slowPercent}%` }" />
      <div
        class="h-2 bg-[var(--color-neutral)]"
        :style="{ width: `${notConnectedPercent}%` }"
      />
    </div>

    <Latency v-if="now" :proxy-name="now" :test-url="testUrl" />
  </div>
</template>
