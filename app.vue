<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} - MetaCubeXD` : 'MetaCubeXD'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
