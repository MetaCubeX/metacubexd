<script setup lang="ts">
import { classifyLatency } from '~/utils'

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

const bands = computed(() =>
  latencyList.value.map((latency) =>
    classifyLatency(latency, configStore.latencyQualityMap),
  ),
)

const good = computed(() => bands.value.filter((b) => b === 'good').length)
const middle = computed(() => bands.value.filter((b) => b === 'medium').length)
const slow = computed(() => bands.value.filter((b) => b === 'slow').length)
const notConnected = computed(
  () => bands.value.filter((b) => b === 'not-connected').length,
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
    <div class="my-1 flex h-2 flex-1 items-stretch overflow-hidden rounded-2xl">
      <div class="h-full bg-green-600" :style="{ width: `${goodPercent}%` }" />
      <div
        class="h-full bg-yellow-500"
        :style="{ width: `${middlePercent}%` }"
      />
      <div class="h-full bg-red-500" :style="{ width: `${slowPercent}%` }" />
      <div
        class="h-full bg-[var(--color-neutral)]"
        :style="{ width: `${notConnectedPercent}%` }"
      />
    </div>

    <Latency v-if="now" :proxy-name="now" :test-url="testUrl" />
  </div>
</template>
