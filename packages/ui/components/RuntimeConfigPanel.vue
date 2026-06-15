<!-- packages/ui/components/RuntimeConfigPanel.vue -->
<script setup lang="ts">
import { IconFileCode, IconRefresh } from '@tabler/icons-vue'

const { t } = useI18n()
const viewer = useRuntimeConfigViewer()
const { available, content, loading, refresh } = viewer

// Load the runtime config once the panel mounts (only when the feature is
// present — the whole card is v-if'd off otherwise).
onMounted(() => {
  if (available.value) refresh()
})
</script>

<template>
  <div
    v-if="available"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="flex items-center gap-2 font-semibold text-base-content">
        <IconFileCode :size="18" />
        {{ t('runtimeConfig') }}
      </span>
      <Button
        class="btn-outline btn-sm btn-secondary"
        :loading="loading"
        @click="refresh()"
      >
        <IconRefresh :size="16" />
        {{ t('refresh') }}
      </Button>
    </div>

    <p class="mb-3 text-sm text-base-content/60">
      {{ t('runtimeConfigDescription') }}
    </p>

    <pre
      class="max-h-96 overflow-auto rounded-lg border border-base-content/10 bg-base-300/40 p-3 font-mono text-xs whitespace-pre text-base-content"
    ><code>{{ content || t('runtimeConfigEmpty') }}</code></pre>
  </div>
</template>
