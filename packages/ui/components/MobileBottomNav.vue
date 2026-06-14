<script setup lang="ts">
import {
  IconChartAreaLine,
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconPlus,
  IconRuler,
  IconSettings,
  IconX,
} from '@tabler/icons-vue'

const { t } = useI18n()
const route = useRoute()

// Primary 4 nav items (around the FAB)
const primaryItems = computed(() => [
  { href: '/overview', name: t('overview'), icon: IconHome },
  { href: '/proxies', name: t('proxies'), icon: IconGlobe },
  { href: '/rules', name: t('rules'), icon: IconRuler },
  { href: '/connections', name: t('connections'), icon: IconNetwork },
])

const leftPrimaryItems = computed(() => primaryItems.value.slice(0, 2))
const rightPrimaryItems = computed(() => primaryItems.value.slice(2, 4))

// Secondary items in the FAB popup
const secondaryItems = computed(() => [
  { href: '/traffic', name: t('dataUsage'), icon: IconChartAreaLine },
  { href: '/logs', name: t('logs'), icon: IconFileStack },
  { href: '/config', name: t('config'), icon: IconSettings },
])

const isActive = (href: string) => route.path === href

// FAB popup state
const popupOpen = ref(false)
const togglePopup = () => {
  popupOpen.value = !popupOpen.value
}
const closePopup = () => {
  popupOpen.value = false
}

// Close popup when navigating
watch(() => route.path, closePopup)

// Whether the active route is a secondary item
const isSecondaryActive = computed(() =>
  secondaryItems.value.some((item) => item.href === route.path),
)

// Entrance animation
const isVisible = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    isVisible.value = true
  })
})
</script>

<template>
  <!-- Backdrop to close popup on outside click -->
  <Transition name="fade">
    <div
      v-if="popupOpen"
      class="fixed inset-0 z-40 lg:hidden"
      aria-hidden="true"
      @click="closePopup"
    />
  </Transition>

  <!-- Secondary popup panel -->
  <Transition name="slide-up">
    <div
      v-if="popupOpen"
      class="fixed inset-x-0 bottom-[4.5rem] z-50 mx-auto w-max lg:hidden"
    >
      <div
        class="mx-auto flex w-max flex-col overflow-hidden rounded-2xl shadow-xl backdrop-blur-[16px]"
        :style="{
          border:
            '1px solid color-mix(in oklch, var(--color-base-content) 12%, transparent)',
          background:
            'color-mix(in oklch, var(--color-base-300) 95%, transparent)',
        }"
      >
        <NuxtLink
          v-for="item in secondaryItems"
          :key="item.href"
          :to="item.href"
          class="flex items-center gap-3 px-5 py-3 text-sm font-medium no-underline transition-colors duration-200"
          :class="
            isActive(item.href)
              ? 'bg-primary/10 text-primary'
              : 'text-base-content/70 hover:bg-base-content/5 hover:text-base-content'
          "
        >
          <component :is="item.icon" class="h-5 w-5 shrink-0" />
          <span>{{ item.name }}</span>
          <!-- Active indicator dot -->
          <span
            v-if="isActive(item.href)"
            class="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
          />
        </NuxtLink>
      </div>
    </div>
  </Transition>

  <!-- Bottom nav bar -->
  <nav
    aria-label="Mobile bottom navigation"
    class="fixed inset-x-0 bottom-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden"
    :class="
      isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    "
  >
    <div
      class="mx-1 mb-2 overflow-visible rounded-2xl shadow-lg backdrop-blur-[12px] sm:mx-2"
      :style="{
        border:
          '1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)',
        background:
          'color-mix(in oklch, var(--color-base-300) 90%, transparent)',
      }"
    >
      <div class="grid h-16 w-full grid-cols-5">
        <!-- Left 2 items: Overview, Proxies -->
        <NuxtLink
          v-for="nav in leftPrimaryItems"
          :key="nav.href"
          :to="nav.href"
          class="group relative flex flex-col items-center justify-center gap-0.5 no-underline transition-all duration-200 ease-in-out active:scale-90"
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
          <div
            class="relative z-10 transition-transform duration-300 ease-in-out group-hover:scale-105"
            :class="isActive(nav.href) ? 'scale-110' : 'scale-100'"
          >
            <component :is="nav.icon" class="h-5 w-5" />
          </div>
          <span class="sr-only">{{ `Navigate to ${nav.name}` }}</span>
          <span
            aria-hidden="true"
            class="relative z-10 truncate px-0.5 text-[9px] font-medium transition-all duration-300 sm:text-[10px]"
            :class="isActive(nav.href) ? 'opacity-100' : 'opacity-80'"
          >
            {{ nav.name }}
          </span>
        </NuxtLink>

        <!-- Center FAB button -->
        <div class="relative flex items-center justify-center">
          <button
            class="group relative -top-3 flex h-14 w-14 flex-col items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90"
            :class="
              popupOpen || isSecondaryActive
                ? 'bg-primary text-primary-content shadow-primary/40'
                : 'bg-base-content/10 text-base-content hover:bg-base-content/15'
            "
            :style="
              popupOpen || isSecondaryActive
                ? 'box-shadow: 0 4px 20px color-mix(in oklch, var(--color-primary) 40%, transparent)'
                : ''
            "
            aria-label="More menu"
            @click="togglePopup"
          >
            <Transition name="icon-spin" mode="out-in">
              <IconX v-if="popupOpen" class="h-6 w-6" />
              <IconPlus v-else class="h-6 w-6" />
            </Transition>
            <!-- Indicator dot when a secondary page is active -->
            <span
              v-if="isSecondaryActive && !popupOpen"
              class="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-base-300 bg-primary"
            />
          </button>
          <span
            aria-hidden="true"
            class="absolute bottom-1 text-[9px] font-medium transition-all duration-300 sm:text-[10px]"
            :class="
              popupOpen || isSecondaryActive
                ? 'text-primary opacity-100'
                : 'text-base-content/60 opacity-80'
            "
          >
            {{ t('more') }}
          </span>
        </div>

        <!-- Right 2 items: Rules, Connections -->
        <NuxtLink
          v-for="nav in rightPrimaryItems"
          :key="nav.href"
          :to="nav.href"
          class="group relative flex flex-col items-center justify-center gap-0.5 no-underline transition-all duration-200 ease-in-out active:scale-90"
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
          <div
            class="relative z-10 transition-transform duration-300 ease-in-out group-hover:scale-105"
            :class="isActive(nav.href) ? 'scale-110' : 'scale-100'"
          >
            <component :is="nav.icon" class="h-5 w-5" />
          </div>
          <span class="sr-only">{{ `Navigate to ${nav.name}` }}</span>
          <span
            aria-hidden="true"
            class="relative z-10 truncate px-0.5 text-[9px] font-medium transition-all duration-300 sm:text-[10px]"
            :class="isActive(nav.href) ? 'opacity-100' : 'opacity-80'"
          >
            {{ nav.name }}
          </span>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* Popup slide-up transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}

/* Backdrop fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Icon spin for + <-> X */
.icon-spin-enter-active,
.icon-spin-leave-active {
  transition: all 0.2s ease;
}
.icon-spin-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}
.icon-spin-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}
</style>
