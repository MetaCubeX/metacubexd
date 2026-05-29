<script setup lang="ts">
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
</template>
