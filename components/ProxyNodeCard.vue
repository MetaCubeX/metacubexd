<script setup lang="ts">
import { formatProxyType } from '~/utils'

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
    class="indicator card w-full"
    :class="[
      isSelected
        ? 'bg-primary text-primary-content'
        : 'bg-neutral text-neutral-content',
    ]"
  >
    <!-- UDP indicator -->
    <div v-if="isUDP" class="indicator-item badge badge-xs badge-info">U</div>

    <div
      class="card-body gap-1 space-y-1 p-2.5"
      :class="{ 'cursor-pointer': !!onClick }"
      @click="onClick"
    >
      <h2 class="card-title line-clamp-1 text-start text-sm break-all">
        {{ proxyName }}
      </h2>

      <div class="card-actions items-end justify-between gap-1">
        <div class="flex flex-col gap-0.5">
          <div class="text-xs font-semibold uppercase opacity-75">
            {{ proxyType }}
          </div>
        </div>

        <Latency
          :proxy-name="proxyName"
          :test-url="testUrl"
          :class="{ 'animate-pulse': isTesting }"
          @click.stop="handleLatencyTest"
        />
      </div>
    </div>
  </div>
</template>
