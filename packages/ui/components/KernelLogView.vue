<!-- packages/ui/components/KernelLogView.vue -->
<script setup lang="ts">
import { IconTrash } from '@tabler/icons-vue'

const { t } = useI18n()
const { hasFeature } = useControlInfo()
const kernelStore = useKernelStore()

const scrollEl = ref<HTMLElement>()

onMounted(() => {
  if (!hasFeature('logs-sse')) return
  kernelStore.connectLogs()
})

onBeforeUnmount(() => {
  kernelStore.disconnectLogs()
})

// Auto-scroll to bottom on new lines.
watch(
  () => kernelStore.logs.length,
  async () => {
    await nextTick()
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  },
)
</script>

<template>
  <div
    v-if="hasFeature('logs-sse')"
    class="flex flex-col rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-2 flex items-center justify-between gap-2">
      <span class="font-semibold text-base-content">{{ t('kernelLogs') }}</span>
      <div class="flex items-center gap-2">
        <span
          class="badge badge-sm"
          :class="kernelStore.connected ? 'badge-success' : 'badge-ghost'"
        >
          {{
            kernelStore.connected
              ? t('kernelLogsConnected')
              : t('kernelLogsDisconnected')
          }}
        </span>
        <Button
          class="btn-ghost btn-xs"
          :icon="IconTrash"
          @click="kernelStore.clearLogs()"
        />
      </div>
    </div>

    <div
      ref="scrollEl"
      class="h-48 overflow-y-auto rounded-lg bg-base-300 p-2 font-mono text-xs leading-relaxed"
    >
      <div
        v-for="(l, i) in kernelStore.logs"
        :key="i"
        :class="l.stream === 'stderr' ? 'text-error' : 'text-base-content/80'"
      >
        {{ l.line }}
      </div>
    </div>
  </div>
</template>
