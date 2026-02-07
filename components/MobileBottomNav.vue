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

// Entrance animation state
const isVisible = ref(false)

onMounted(() => {
  // Trigger entrance animation
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})
</script>

<template>
  <nav
    aria-label="Mobile bottom navigation"
    class="fixed inset-x-0 bottom-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden"
    :class="
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    "
  >
    <!-- Backdrop blur container -->
    <div
      class="mx-2 mb-2 overflow-hidden rounded-2xl shadow-lg backdrop-blur-[12px]"
      :style="{
        border:
          '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)',
        background:
          'color-mix(in oklch, var(--color-base-300) 90%, transparent)',
      }"
    >
      <div class="grid h-16 grid-cols-6">
        <NuxtLink
          v-for="nav in navItems"
          :key="nav.href"
          :to="nav.href"
          class="group relative flex flex-col items-center justify-center gap-0.5 no-underline transition-all duration-300 ease-in-out active:scale-90"
          :class="
            isActive(nav.href)
              ? 'text-primary'
              : 'text-base-content/60 hover:text-base-content'
          "
        >
          <!-- Active background glow -->
          <div
            class="absolute inset-1 rounded-xl transition-all duration-300 ease-in-out"
            :class="
              isActive(nav.href)
                ? 'bg-primary/10'
                : 'bg-transparent group-hover:bg-base-content/5'
            "
          />

          <!-- Active indicator pill -->
          <div
            class="absolute top-1 h-1 rounded-full bg-primary transition-all duration-300 ease-in-out"
            :class="isActive(nav.href) ? 'w-8 opacity-100' : 'w-0 opacity-0'"
          />

          <!-- Icon with scale animation -->
          <div
            class="relative z-10 transition-all duration-300 ease-in-out group-hover:scale-105"
            :class="
              isActive(nav.href) ? 'scale-110 text-xl' : 'scale-100 text-lg'
            "
          >
            <component :is="nav.icon" />
          </div>

          <!-- Screen reader label -->
          <span class="sr-only">
            {{ `Navigate to ${nav.name}` }}
          </span>

          <!-- Visual label with fade animation -->
          <span
            aria-hidden="true"
            class="relative z-10 text-[10px] font-medium transition-all duration-300 ease-in-out group-hover:opacity-100"
            :class="isActive(nav.href) ? 'opacity-100' : 'opacity-80'"
          >
            {{ nav.name }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
