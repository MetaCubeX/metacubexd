<script setup lang="ts">
const endpointStore = useEndpointStore()
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-1 text-sm font-bold whitespace-nowrap uppercase sm:text-xl"
  >
    <NuxtLink
      class="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent no-underline"
      :to="hasEndpoint ? '/' : '/setup'"
    >
      <span class="hidden min-[400px]:inline">metacube</span>
      <span class="inline min-[400px]:hidden">mcx</span>
    </NuxtLink>
    <span class="text-base-content">(</span>
    <a
      class="inline-block text-primary no-underline transition-transform duration-300 ease-in-out hover:scale-125 hover:rotate-90"
      href="https://github.com/metacubex/metacubexd"
      target="_blank"
    >
      xd
    </a>
    <span class="text-base-content">)</span>
  </div>
</template>
