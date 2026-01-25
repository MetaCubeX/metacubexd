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

function getDotClass(latency: number | undefined, selected: boolean): string {
  const notConnected = configStore.latencyQualityMap.NOT_CONNECTED
  const medium = configStore.latencyQualityMap.MEDIUM
  const high = configStore.latencyQualityMap.HIGH

  if (typeof latency !== 'number' || latency === notConnected) {
    return selected ? 'dot-neutral-selected' : 'dot-neutral'
  } else if (latency > high) {
    return selected ? 'dot-slow-selected' : 'dot-slow'
  } else if (latency > medium) {
    return selected ? 'dot-medium-selected' : 'dot-medium'
  }
  return selected ? 'dot-good-selected' : 'dot-good'
}
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-1">
      <div
        v-for="[name, latency] in proxyLatencies"
        :key="name"
        class="size-4 rounded-full transition-transform duration-200 ease-out"
        :class="[
          getDotClass(latency, name === now),
          onSelect && 'cursor-pointer hover:scale-125',
        ]"
        :title="name"
        @click.stop="onSelect && onSelect(name)"
      />
    </div>

    <Latency v-if="now" :proxy-name="now" :test-url="testUrl" />
  </div>
</template>

<style scoped>
/* Good latency */
.dot-good {
  background: #16a34a;
}

.dot-good-selected {
  background: white;
  border: 4px solid #16a34a;
}

/* Medium latency */
.dot-medium {
  background: #eab308;
}

.dot-medium-selected {
  background: white;
  border: 4px solid #eab308;
}

/* Slow latency */
.dot-slow {
  background: #ef4444;
}

.dot-slow-selected {
  background: white;
  border: 4px solid #ef4444;
}

/* Not connected - uses CSS variable */
.dot-neutral {
  background: var(--color-neutral);
}

.dot-neutral-selected {
  background: white;
  border: 4px solid var(--color-neutral);
}
</style>
