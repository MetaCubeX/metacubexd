<script setup lang="ts">
import { computed } from 'vue'

const endpointStore = useEndpointStore()
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-1 text-sm font-bold whitespace-nowrap uppercase sm:text-xl"
  >
    <NuxtLink
      class="bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent no-underline"
      :to="hasEndpoint ? '/' : '/setup'"
    >
      <span>metacube</span>
    </NuxtLink>
    <span class="hidden text-base-content min-[400px]:inline">(</span>
    <a
      class="hidden text-primary no-underline transition-transform duration-300 ease-in-out hover:scale-125 hover:rotate-90 min-[400px]:inline-block"
      href="https://github.com/metacubex/metacubexd"
      target="_blank"
    >
      xd
    </a>
    <span class="hidden text-base-content min-[400px]:inline">)</span>
  </div>
</template>
