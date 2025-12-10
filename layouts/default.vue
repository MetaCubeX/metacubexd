<script setup lang="ts">
const route = useRoute()
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

// Route guard: redirect to setup if no endpoint configured
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
const isSetupPage = computed(() => route.path === '/setup')
const needsRedirect = computed(() => !hasEndpoint.value && !isSetupPage.value)
</script>

<template>
  <div
    ref="rootElement"
    class="relative flex h-screen flex-col overscroll-y-none bg-base-100 subpixel-antialiased"
    :class="configStore.fontFamily"
    :data-theme="configStore.curTheme"
  >
    <Header />

    <div class="flex-1 overflow-y-auto p-2 sm:p-4">
      <template v-if="!needsRedirect">
        <slot />
      </template>
      <template v-else>
        <NuxtLink to="/setup" replace />
      </template>
    </div>

    <!-- WebSocket connections manager -->
    <ProtectedResources v-if="hasEndpoint" />
  </div>
</template>
