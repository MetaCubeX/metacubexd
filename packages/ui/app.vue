<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

useHead({
  titleTemplate: (title) => (title ? `${title} - MetaCubeXD` : 'MetaCubeXD'),
})

const configStore = useConfigStore()

// vue-sonner defaults to a light theme, but the app default theme is dark, so an
// unbound toaster ships bright cards over a dark UI. Derive the toaster theme
// from the active daisyUI theme's color-scheme (daisyUI v5 emits it per theme);
// re-evaluate on theme change and default to dark to avoid a hydration flash.
const toasterTheme = computed<'light' | 'dark'>(() => {
  void configStore.curTheme
  if (!import.meta.client) return 'dark'
  const scheme = getComputedStyle(document.documentElement).colorScheme
  return scheme.includes('light') ? 'light' : 'dark'
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage
      :transition="{
        name: 'page',
        mode: 'out-in',
      }"
    />
  </NuxtLayout>

  <PwaUpdatePrompt />

  <!-- vue-sonner toast outlet (desktop control surface uses toasts). Top-center
       keeps clear of the bottom-right traffic widget + the mobile bottom nav;
       theme is bound to the active daisyUI theme. -->
  <Toaster position="top-center" :theme="toasterTheme" rich-colors />
</template>
