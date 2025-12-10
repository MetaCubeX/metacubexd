<script setup lang="ts">
import type { Component } from 'vue'

interface NavItem {
  href: string
  name: string
  icon: Component
}

defineProps<{
  navItems: NavItem[]
}>()

const route = useRoute()

const isActive = (href: string) => route.path === href

// Add padding to body for mobile nav
onMounted(() => {
  updateBodyPadding()
  window.addEventListener('resize', updateBodyPadding)
})

onUnmounted(() => {
  document.body.style.paddingBottom = '0'
  window.removeEventListener('resize', updateBodyPadding)
})

function updateBodyPadding() {
  document.body.style.paddingBottom = window.innerWidth < 1024 ? '4rem' : '0'
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-50 border-t border-base-content/10 bg-base-300/95 backdrop-blur-sm lg:hidden"
  >
    <div class="grid h-16 grid-cols-6">
      <NuxtLink
        v-for="nav in navItems"
        :key="nav.href"
        :to="nav.href"
        class="relative flex flex-col items-center justify-center gap-1 transition-all duration-200 hover:bg-base-200/50"
      >
        <div
          v-if="isActive(nav.href)"
          class="absolute top-0 left-1/2 h-1 w-8 -translate-x-1/2 transform rounded-b-full bg-primary"
        />
        <div
          class="text-xl transition-all duration-200"
          :class="{
            'scale-110 text-primary': isActive(nav.href),
            'text-base-content/70': !isActive(nav.href),
          }"
        >
          <component :is="nav.icon" />
        </div>
        <span
          v-if="isActive(nav.href)"
          class="text-xs font-medium text-primary"
        >
          {{ nav.name }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
