<script setup lang="ts">
import { IconCircleCheckFilled } from '@tabler/icons-vue'
import { formatProxyType } from '~/utils'

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
const { t } = useI18n()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)

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
  <div
    class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors"
    :class="
      isSelected
        ? 'bg-primary/15 text-base-content shadow-[inset_2px_0_var(--color-primary)]'
        : 'hover:bg-base-content/5'
    "
    @click="emit('click')"
  >
    <span class="flex w-4 shrink-0 justify-center">
      <IconCircleCheckFilled v-if="isSelected" class="size-4 text-primary" />
    </span>
    <span class="min-w-0 flex-1 truncate font-medium">{{ proxyName }}</span>
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
        @click.stop="handleLatencyTest"
      />
    </span>
  </div>
</template>
