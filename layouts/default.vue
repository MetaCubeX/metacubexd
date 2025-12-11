<script setup lang="ts">
import { useMockMode } from '~/composables/useApi'

const configStore = useConfigStore()
const endpointStore = useEndpointStore()
const globalStore = useGlobalStore()

const rootElement = ref<HTMLElement | null>(null)

// Set root element for store
watch(rootElement, (el) => {
  if (el) globalStore.rootElement = el
})

// Auto switch theme based on system preference
const prefersDark = usePreferredDark()

watch(
  [() => configStore.autoSwitchTheme, prefersDark],
  ([autoSwitch, isDark]) => {
    if (autoSwitch) {
      configStore.curTheme = isDark
        ? configStore.favNightTheme
        : configStore.favDayTheme
    }
  },
  { immediate: true },
)

// Sync theme to document.documentElement for CSS variables
watch(
  () => configStore.curTheme,
  (theme) => {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  },
  { immediate: true },
)

// In mock mode, always show protected resources
const hasEndpoint = computed(
  () => useMockMode() || !!endpointStore.currentEndpoint,
)
</script>

<template>
  <div
    ref="rootElement"
    class="relative flex h-screen flex-col overscroll-y-none bg-base-100 subpixel-antialiased"
    :class="configStore.enableTwemoji ? 'font-twemoji' : 'font-default'"
    :data-theme="configStore.curTheme"
  >
    <Header />

    <div class="flex-1 overflow-y-auto p-2 sm:p-4">
      <slot />
    </div>

    <!-- WebSocket connections manager -->
    <ProtectedResources v-if="hasEndpoint" />

    <!-- Global traffic indicator -->
    <GlobalTrafficIndicator v-if="hasEndpoint" />
  </div>
</template>
