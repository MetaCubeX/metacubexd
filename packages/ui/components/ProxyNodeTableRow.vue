<script setup lang="ts">
import { IconCircleCheckFilled } from '@tabler/icons-vue'

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

const { proxyType, isUDP, runLatencyTest } = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName },
)
</script>

<template>
  <div
    class="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors"
    :class="
      isSelected
        ? 'bg-primary/15 text-base-content shadow-[inset_2px_0_var(--color-primary)]'
        : 'hover:bg-base-content/5'
    "
    role="button"
    tabindex="0"
    :aria-pressed="isSelected"
    :aria-label="proxyName"
    @click="emit('click')"
    @keydown.enter.prevent="emit('click')"
    @keydown.space.prevent="emit('click')"
  >
    <span class="flex w-4 shrink-0 justify-center">
      <IconCircleCheckFilled v-if="isSelected" class="size-4 text-primary" />
    </span>
    <span class="min-w-0 flex-1 truncate font-medium">
      <ProxyNodeName :name="proxyName" />
    </span>
    <span
      class="hidden w-16 shrink-0 truncate text-right text-xs uppercase opacity-60 sm:block"
    >
      {{ proxyType }}
    </span>
    <span class="flex w-8 shrink-0 justify-center">
      <span
        v-if="isUDP"
        class="rounded bg-info px-1 py-0.5 text-[0.625rem] font-semibold text-info-content"
        >U</span
      >
    </span>
    <span class="flex w-14 shrink-0 justify-end">
      <Latency
        :proxy-name="proxyName"
        :test-url="testUrl"
        :provider-name="providerName"
        interactive
        @click.stop="runLatencyTest"
      />
    </span>
  </div>
</template>
