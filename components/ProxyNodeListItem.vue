<script setup lang="ts">
import { IconCircleCheckFilled } from '@tabler/icons-vue'
import { filterSpecialProxyType, formatProxyType } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
})

const emit = defineEmits<{
  click: []
}>()

const proxiesStore = useProxiesStore()
const { t } = useI18n()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)
const isTesting = computed(
  () => proxiesStore.proxyLatencyTestingMap[props.proxyName] || false,
)

const specialTypes = computed(() => {
  if (!proxyNode.value || !filterSpecialProxyType(proxyNode.value.type))
    return null

  return [
    proxyNode.value.xudp && 'xudp',
    proxyNode.value.udp && 'udp',
    proxyNode.value.tfo && 'TFO',
  ]
    .filter(Boolean)
    .join(' / ')
})

function onClick() {
  emit('click')
}

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
    class="rounded-lg"
    :class="[
      isSelected
        ? 'bg-primary text-primary-content'
        : 'bg-neutral text-neutral-content',
    ]"
  >
    <div
      class="flex items-center gap-2 px-3 py-1.5"
      :class="{ 'cursor-pointer hover:opacity-80': !!onClick }"
      @click="onClick"
    >
      <!-- Selected indicator -->
      <IconCircleCheckFilled v-if="isSelected" class="size-4 shrink-0" />

      <!-- Proxy name -->
      <span class="min-w-0 flex-1 truncate text-sm font-medium">
        {{ proxyName }}
      </span>

      <!-- UDP indicator -->
      <span v-if="isUDP" class="badge shrink-0 badge-xs badge-info">U</span>

      <!-- Special types -->
      <span
        v-if="specialTypes"
        class="hidden text-xs uppercase opacity-60 sm:inline"
      >
        {{ specialTypes }}
      </span>

      <!-- Proxy type -->
      <span class="hidden text-xs uppercase opacity-75 sm:inline">
        {{ proxyType }}
      </span>

      <!-- Latency -->
      <Latency
        :proxy-name="proxyName"
        :test-url="testUrl"
        class="shrink-0"
        :class="{ 'animate-pulse': isTesting }"
        @click.stop="handleLatencyTest"
      />
    </div>
  </div>
</template>
