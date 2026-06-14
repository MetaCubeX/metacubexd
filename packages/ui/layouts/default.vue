<script setup lang="ts">
import { useMockMode } from '~/composables/useApi'
import { useKeyboardShortcuts } from '~/composables/useKeyboardShortcuts'

const configStore = useConfigStore()
const endpointStore = useEndpointStore()
const globalStore = useGlobalStore()

// Appearance: background image, custom theme colors, font
const appearance = useAppearance()

// Initialize keyboard shortcuts
const { setupKeyboardListeners } = useKeyboardShortcuts()
onMounted(() => {
  setupKeyboardListeners()
  appearance.reloadCustomBackground()
})

// Custom UI font (overrides the font-default / font-twemoji stack when set)
const rootStyle = computed(() =>
  appearance.rootFontFamily.value
    ? { fontFamily: appearance.rootFontFamily.value }
    : undefined,
)

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
    class="relative h-screen overscroll-y-none antialiased"
    :class="[
      configStore.enableTwemoji ? 'font-twemoji' : 'font-default',
      appearance.hasBackground.value ? '' : 'bg-base-100',
    ]"
    :style="rootStyle"
    :data-theme="configStore.curTheme"
  >
    <!-- Custom background image layer + legibility overlay -->
    <template v-if="appearance.hasBackground.value">
      <div
        class="pointer-events-none fixed inset-0 -z-10 scale-110 bg-cover bg-center bg-no-repeat"
        :style="appearance.backgroundLayerStyle.value"
      />
      <div
        class="pointer-events-none fixed inset-0 -z-10"
        :style="appearance.backgroundOverlayStyle.value"
      />
    </template>

    <Sidebar>
      <slot />
    </Sidebar>

    <!-- Connection error banner - shown when backend is unreachable -->
    <ConnectionErrorBanner v-if="hasEndpoint" />

    <!-- WebSocket connections manager -->
    <ProtectedResources v-if="hasEndpoint" />

    <!-- Global traffic indicator -->
    <GlobalTrafficIndicator v-if="hasEndpoint" />

    <!-- Keyboard shortcuts help modal -->
    <ShortcutsHelpModal />
  </div>
</template>
