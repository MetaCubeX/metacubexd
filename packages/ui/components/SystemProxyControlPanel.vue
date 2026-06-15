<!-- packages/ui/components/SystemProxyControlPanel.vue -->
<script setup lang="ts">
import { IconDeviceDesktop } from '@tabler/icons-vue'

const { t } = useI18n()
const sysProxy = useSystemProxy()
const { available, enabled, port, bypassText, loading } = sysProxy

onMounted(() => {
  if (!available.value) return
  // Errors surface via toast inside the composable — do not swallow here.
  void sysProxy.load()
})

const onToggle = (event: Event) => {
  const next = (event.target as HTMLInputElement).checked
  void sysProxy.toggle(next)
}
</script>

<template>
  <div
    v-if="available"
    class="rounded-xl border border-base-content/10 bg-base-200 p-4"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="flex items-center gap-2 font-semibold text-base-content">
        <IconDeviceDesktop :size="18" />
        {{ t('systemProxy') }}
      </span>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        :checked="enabled"
        :disabled="loading"
        :aria-label="t('systemProxyEnable')"
        @change="onToggle"
      />
    </div>

    <p class="mb-3 text-sm text-base-content/60">
      {{ t('systemProxyDescription', { port }) }}
    </p>

    <label class="mb-1 flex flex-col gap-1 text-sm">
      <span class="text-base-content/60">{{ t('systemProxyBypass') }}</span>
      <textarea
        v-model="bypassText"
        class="textarea-bordered textarea min-h-24 w-full font-mono text-xs"
        :placeholder="t('systemProxyBypassPlaceholder')"
        :disabled="loading"
        spellcheck="false"
      />
    </label>

    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        class="btn-sm btn-primary"
        :loading="loading"
        @click="sysProxy.save()"
      >
        {{ t('systemProxyApply') }}
      </Button>
    </div>
  </div>
</template>
