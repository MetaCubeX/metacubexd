<script setup lang="ts">
import { IconRefresh, IconX } from '@tabler/icons-vue'

// `$pwa` is injected by @vite-pwa/nuxt and only exists on the client.
// With `registerType: 'prompt'`, `needRefresh` flips to true once a new
// service worker is waiting. We surface a reload prompt rather than
// auto-activating the SW, which keeps iOS Safari from looping (#1740).
const { t } = useI18n()
const { $pwa } = useNuxtApp()

function reload() {
  $pwa?.updateServiceWorker(true)
}

function dismiss() {
  if ($pwa) {
    $pwa.needRefresh = false
  }
}
</script>

<template>
  <Transition name="pwa-prompt">
    <div
      v-if="$pwa?.needRefresh"
      class="toast toast-end toast-bottom z-50 m-4"
      role="alert"
    >
      <div class="alert border-none bg-base-200 shadow-lg">
        <span class="text-sm">{{ t('pwaUpdateAvailable') }}</span>
        <button class="btn gap-1 btn-sm btn-primary" @click="reload">
          <IconRefresh class="size-4" />
          {{ t('pwaUpdateReload') }}
        </button>
        <button
          class="btn btn-circle btn-ghost btn-sm"
          :aria-label="t('close')"
          @click="dismiss"
        >
          <IconX class="size-4" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-prompt-enter-active,
.pwa-prompt-leave-active {
  transition: all var(--dur-base) var(--ease-spring-soft);
}

.pwa-prompt-enter-from,
.pwa-prompt-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
