<!-- packages/ui/components/KernelControlPanel.vue -->
<script setup lang="ts">
import { IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-vue'

const { t } = useI18n()
const { hasFeature } = useControlInfo()
const kernelStore = useKernelStore()

const busy = ref(false)

onMounted(() => {
  if (!hasFeature('kernel-control')) return
  kernelStore.fetchStatus().catch(() => {})
})

const status = computed(() => kernelStore.state?.status ?? 'stopped')

const statusClass = computed(() => {
  switch (status.value) {
    case 'running':
      return 'badge-success'
    case 'starting':
    case 'stopping':
      return 'badge-warning'
    case 'errored':
      return 'badge-error'
    default:
      return 'badge-ghost'
  }
})

const uptime = computed(() => {
  const startedAt = kernelStore.state?.startedAt
  if (!startedAt || status.value !== 'running') return '-'
  const sec = Math.floor((Date.now() - startedAt) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}h ${m}m ${s}s`
})

const canStart = computed(() => ['stopped', 'errored'].includes(status.value))
const canStop = computed(() => status.value === 'running')

const run = async (fn: () => Promise<unknown>) => {
  busy.value = true
  try {
    await fn()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="hasFeature('kernel-control')"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-semibold text-base-content">
        {{ t('kernelControl') }}
      </span>
      <span class="badge" :class="statusClass">{{ status }}</span>
    </div>

    <div class="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div class="flex flex-col">
        <span class="text-base-content/60">{{ t('kernelVersion') }}</span>
        <span class="tabular-nums">{{
          kernelStore.state?.version ?? '-'
        }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-base-content/60">{{ t('kernelUptime') }}</span>
        <span class="tabular-nums">{{ uptime }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-base-content/60">{{ t('kernelPid') }}</span>
        <span class="tabular-nums">{{ kernelStore.state?.pid ?? '-' }}</span>
      </div>
      <div class="flex flex-col">
        <span class="text-base-content/60">{{ t('kernelStatus') }}</span>
        <span class="tabular-nums">{{ status }}</span>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        class="btn-sm btn-success"
        :icon="IconPlayerPlay"
        :disabled="!canStart"
        :loading="busy"
        @click="run(() => kernelStore.start())"
      >
        {{ t('kernelStart') }}
      </Button>
      <Button
        class="btn-sm btn-error"
        :icon="IconPlayerStop"
        :disabled="!canStop"
        :loading="busy"
        @click="run(() => kernelStore.stop())"
      >
        {{ t('kernelStop') }}
      </Button>
      <Button
        class="btn-sm btn-warning"
        :icon="IconRefresh"
        :disabled="!canStop"
        :loading="busy"
        @click="run(() => kernelStore.restart())"
      >
        {{ t('kernelRestart') }}
      </Button>
    </div>
  </div>
</template>
