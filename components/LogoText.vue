<script setup lang="ts">
import { computed } from 'vue'
import { Vue3Marquee } from 'vue3-marquee'

const endpointStore = useEndpointStore()
const hasEndpoint = computed(() => !!endpointStore.currentEndpoint)
</script>

<template>
  <div
    class="flex min-w-0 items-center gap-1 text-sm font-bold whitespace-nowrap uppercase sm:text-xl"
  >
    <div class="hidden min-w-0 items-center gap-1 min-[400px]:flex">
      <NuxtLink
        class="bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent no-underline"
        :to="hasEndpoint ? '/' : '/setup'"
      >
        <span>metacube</span>
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

    <div class="flex w-24 items-center min-[400px]:hidden">
      <Vue3Marquee
        :duration="10"
        :delay="2"
        :clone="false"
        :pause-on-hover="true"
      >
        <div class="flex items-center gap-1 px-2">
          <NuxtLink
            class="bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent no-underline"
            :to="hasEndpoint ? '/' : '/setup'"
          >
            <span>metacube</span>
          </NuxtLink>
          <span class="text-base-content">(</span>
          <a
            class="pointer-events-auto inline-block text-primary no-underline transition-transform duration-300 ease-in-out hover:scale-125 hover:rotate-90"
            href="https://github.com/metacubex/metacubexd"
            target="_blank"
          >
            xd
          </a>
          <span class="text-base-content">)</span>
        </div>
      </Vue3Marquee>
    </div>
  </div>
</template>
