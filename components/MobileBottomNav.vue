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

// Add padding to body for mobile nav and animate entrance
onMounted(() => {
  updateBodyPadding()
  window.addEventListener('resize', updateBodyPadding)
  // Trigger entrance animation
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})

onUnmounted(() => {
  document.body.style.paddingBottom = '0'
  window.removeEventListener('resize', updateBodyPadding)
})

function updateBodyPadding() {
  document.body.style.paddingBottom = window.innerWidth < 1024 ? '4.5rem' : '0'
}
</script>

<template>
  <nav
    aria-label="Mobile bottom navigation"
    class="fixed inset-x-0 bottom-0 z-50 transform transition-all duration-500 ease-out lg:hidden"
    :class="[
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0',
    ]"
  >
    <!-- Backdrop blur container -->
    <div
      class="mx-2 mb-2 overflow-hidden rounded-2xl border border-base-content/10 bg-base-300/90 shadow-lg backdrop-blur-md"
    >
      <div class="grid h-16 grid-cols-6">
        <NuxtLink
          v-for="nav in navItems"
          :key="nav.href"
          :to="nav.href"
          class="group relative flex flex-col items-center justify-center gap-0.5 transition-all duration-300"
          :class="[
            isActive(nav.href)
              ? 'text-primary'
              : 'text-base-content/60 hover:text-base-content active:scale-90',
          ]"
        >
          <!-- Active background glow -->
          <div
            class="absolute inset-1 rounded-xl transition-all duration-300"
            :class="[
              isActive(nav.href)
                ? 'bg-primary/10'
                : 'bg-transparent group-hover:bg-base-content/5',
            ]"
          />

          <!-- Active indicator pill -->
          <div
            class="absolute top-1 h-1 rounded-full bg-primary transition-all duration-300"
            :class="[isActive(nav.href) ? 'w-8 opacity-100' : 'w-0 opacity-0']"
          />

          <!-- Icon with scale animation -->
          <div
            class="relative z-10 transition-all duration-300"
            :class="[
              isActive(nav.href)
                ? 'scale-110 text-xl'
                : 'scale-100 text-lg group-hover:scale-105',
            ]"
          >
            <component :is="nav.icon" />
          </div>

          <!-- Label with fade animation -->
          <!-- Screen reader label (always available even when visual label is hidden) -->
          <span class="sr-only">
            {{ `Navigate to ${nav.name}` }}
          </span>

          <!-- Visual label with fade animation -->
          <span
            aria-hidden="true"
            class="relative z-10 text-[10px] font-medium transition-all duration-300"
            :class="[
              isActive(nav.href)
                ? 'translate-y-0 opacity-100'
                : 'translate-y-0 opacity-80 group-hover:opacity-100 group-focus-visible:opacity-100',
            ]"
          >
            {{ nav.name }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
