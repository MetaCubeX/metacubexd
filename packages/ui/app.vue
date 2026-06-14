<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

useHead({
  titleTemplate: (title) => (title ? `${title} - MetaCubeXD` : 'MetaCubeXD'),
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

  <!-- vue-sonner toast outlet (desktop control surface uses toasts) -->
  <Toaster position="bottom-right" rich-colors />
</template>
