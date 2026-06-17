<!-- packages/ui/components/KernelControlPanel.vue -->
<script setup lang="ts">
import { IconPlayerPlay, IconPlayerStop, IconRefresh } from '@tabler/icons-vue'

const { t } = useI18n()
const { hasFeature, info } = useControlInfo()
const kernelStore = useKernelStore()

// The running kernel reports its own version, but that is empty until it has
// started at least once. Fall back to the control-info kernel version (the
// agent now seeds it with the bundled version) so a stopped/never-started
// kernel still shows which version is installed instead of "-".
const kernelVersion = computed(
  () => kernelStore.state?.version || info.value?.kernel?.version || '-',
)

const busy = ref(false)

onMounted(() => {
  if (!hasFeature('kernel-control')) return
  kernelStore
    .fetchStatus()
    .catch((err) =>
      console.error('[kernel-control] initial status failed', err),
    )
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

// Tick once a second so uptime stays live instead of freezing at the value
// computed on mount (Date.now() is not reactive). Runs UNCONDITIONALLY: gating
// resume()/pause() on `watch(status)` left `now` frozen — and uptime stuck at
// "0h 0m 0s" — whenever the managed kernel was ALREADY running at mount, which
// is the normal desktop case (the main process starts the kernel before the
// renderer even loads, so the panel never witnesses a stopped→running edge). A
// 1s timer is negligible and the `uptime` computed already returns '-' when the
// kernel is not running.
const now = ref(Date.now())
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)

const uptime = computed(() => {
  const startedAt = kernelStore.state?.startedAt
  if (!startedAt || status.value !== 'running') return '-'
  const sec = Math.floor((now.value - startedAt) / 1000)
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
        <span class="tabular-nums">{{ kernelVersion }}</span>
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
