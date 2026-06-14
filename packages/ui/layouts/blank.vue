<script setup lang="ts">
const configStore = useConfigStore()
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

// Sync theme to document.documentElement
watch(
  () => configStore.curTheme,
  (theme) => {
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="rootElement"
    class="relative flex h-screen flex-col overscroll-y-none bg-base-100 antialiased"
    :class="configStore.enableTwemoji ? 'font-twemoji' : 'font-default'"
    :data-theme="configStore.curTheme"
  >
    <slot />
  </div>
</template>
