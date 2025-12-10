<script setup lang="ts">
const endpointStore = useEndpointStore()
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
</script>

<template>
  <div
    class="text-md flex items-center gap-1 font-bold whitespace-nowrap uppercase sm:text-xl"
  >
    <NuxtLink
      class="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent"
      :to="hasEndpoint ? '/' : '/setup'"
    >
      metacube
    </NuxtLink>
    <span>(</span>
    <a
      class="text-primary transition-transform hover:scale-125 hover:rotate-90"
      href="https://github.com/metacubex/metacubexd"
      target="_blank"
    >
      xd
    </a>
    <span>)</span>
  </div>
</template>
