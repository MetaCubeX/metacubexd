<script setup lang="ts">
const endpointStore = useEndpointStore()
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-1 text-sm font-bold whitespace-nowrap uppercase sm:text-xl"
  >
    <NuxtLink
      class="bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent"
      :to="hasEndpoint ? '/' : '/setup'"
    >
      <span class="hidden min-[400px]:inline">metacube</span>
      <span class="min-[400px]:hidden">mcx</span>
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
