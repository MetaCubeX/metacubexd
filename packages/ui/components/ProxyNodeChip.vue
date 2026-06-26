<script setup lang="ts">
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

const { isUDP, latencyColorClass, runLatencyTest } = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName },
)
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-all duration-200"
    :class="
      isSelected
        ? 'bg-primary/15 text-base-content ring-1 ring-primary'
        : 'bg-neutral text-neutral-content hover:shadow-md'
    "
    @click="emit('click')"
  >
    <span
      class="size-2 shrink-0 rounded-full bg-current"
      :class="isSelected ? 'text-primary' : latencyColorClass"
    />
    <span class="max-w-[12rem] truncate font-medium">
      <ProxyNodeName :name="proxyName" />
    </span>
    <span v-if="isUDP" class="text-[0.625rem] font-semibold opacity-70">U</span>
    <Latency
      :proxy-name="proxyName"
      :test-url="testUrl"
      :provider-name="providerName"
      @click.stop="runLatencyTest"
    />
  </button>
</template>
