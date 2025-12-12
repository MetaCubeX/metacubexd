<script setup lang="ts">
import {
  IconChevronsLeft,
  IconChevronsRight,
  IconFileStack,
  IconGlobe,
  IconHome,
  IconMenu2,
  IconNetwork,
  IconRuler,
  IconSettings,
} from '@tabler/icons-vue'

const route = useRoute()
const { t } = useI18n()
const configStore = useConfigStore()

const navItems = computed(() => [
  { href: '/overview', name: t('overview'), icon: IconHome },
  { href: '/proxies', name: t('proxies'), icon: IconGlobe },
  { href: '/rules', name: t('rules'), icon: IconRuler },
  { href: '/connections', name: t('connections'), icon: IconNetwork },
  { href: '/logs', name: t('logs'), icon: IconFileStack },
  { href: '/config', name: t('config'), icon: IconSettings },
])

const isActive = (href: string) => route.path === href

// Close drawer when route changes (mobile only)
const drawerCheckbox = ref<HTMLInputElement | null>(null)
watch(
  () => route.path,
  () => {
    if (drawerCheckbox.value) {
      drawerCheckbox.value.checked = false
    }
  },
)

// Toggle sidebar expanded state
const toggleSidebar = () => {
  configStore.sidebarExpanded = !configStore.sidebarExpanded
}
</script>

<template>
  <div
    class="drawer h-full"
    :class="{ 'lg:drawer-open': route.path !== '/setup' }"
  >
    <input
      id="main-drawer"
      ref="drawerCheckbox"
      type="checkbox"
      class="drawer-toggle"
    />

    <div class="drawer-content flex h-full flex-col">
      <!-- Header/Navbar (mobile only) -->
      <header
        class="z-50 flex h-14 w-full shrink-0 items-center gap-2 bg-base-300 px-2 shadow-lg sm:px-4 lg:hidden"
      >
        <!-- Mobile menu button -->
        <label
          v-if="route.path !== '/setup'"
          for="main-drawer"
          class="btn btn-ghost btn-sm"
          aria-label="open sidebar"
        >
          <IconMenu2 class="size-5" />
        </label>

        <!-- Logo -->
        <div class="min-w-0 shrink">
          <LogoText />
        </div>

        <!-- Right side controls -->
        <div class="ml-auto flex shrink-0 items-center gap-1">
          <div id="header-traffic-indicator" class="flex items-center" />
          <LangSwitcher />
          <ThemeSwitcher />
        </div>
      </header>

      <!-- Page content slot -->
      <div class="flex min-h-0 flex-1 flex-col p-2 sm:p-4">
        <slot />
      </div>
    </div>

    <!-- Sidebar drawer -->
    <div v-if="route.path !== '/setup'" class="drawer-side z-60">
      <label
        for="main-drawer"
        aria-label="close sidebar"
        class="drawer-overlay"
      />

      <!-- Sidebar container - collapsible on desktop -->
      <div
        class="flex h-full w-52 flex-col bg-base-200 transition-all duration-300"
        :class="configStore.sidebarExpanded ? '' : 'lg:w-16'"
      >
        <!-- Sidebar header -->
        <div
          class="flex shrink-0 flex-col gap-2 border-b border-base-content/10 p-3"
        >
          <!-- Logo row -->
          <div
            class="flex items-center"
            :class="configStore.sidebarExpanded ? '' : 'lg:justify-center'"
          >
            <LogoText v-show="configStore.sidebarExpanded" class="lg:block" />
            <LogoText class="lg:hidden" />
          </div>
          <!-- Expand/Collapse button (desktop only) -->
          <button
            class="btn hidden w-full btn-ghost btn-sm lg:flex"
            :class="configStore.sidebarExpanded ? '' : 'lg:btn-square'"
            @click="toggleSidebar"
          >
            <IconChevronsRight
              v-if="!configStore.sidebarExpanded"
              class="size-5"
            />
            <IconChevronsLeft v-else class="size-5" />
            <span :class="configStore.sidebarExpanded ? '' : 'lg:hidden'">
              {{ t('collapse') }}
            </span>
          </button>
        </div>

        <!-- Navigation menu -->
        <ul class="menu w-full flex-1 gap-1 px-2">
          <li v-for="nav in navItems" :key="nav.href" class="w-full">
            <NuxtLink
              :to="nav.href"
              class="flex w-full items-center gap-3"
              :class="[
                { 'menu-active': isActive(nav.href) },
                configStore.sidebarExpanded ? '' : 'lg:justify-center lg:px-0',
              ]"
              :title="configStore.sidebarExpanded ? undefined : nav.name"
            >
              <component :is="nav.icon" class="size-5 shrink-0" />
              <span :class="configStore.sidebarExpanded ? '' : 'lg:hidden'">
                {{ nav.name }}
              </span>
            </NuxtLink>
          </li>
        </ul>

        <!-- Sidebar footer -->
        <div
          class="shrink-0 border-t border-base-content/10 p-2"
          :class="
            configStore.sidebarExpanded
              ? ''
              : 'lg:flex lg:flex-col lg:items-center'
          "
        >
          <!-- Traffic indicator target for PC (expanded sidebar with chart) -->
          <div
            id="sidebar-traffic-expanded"
            class="mb-2 hidden w-full"
            :class="configStore.sidebarExpanded ? 'lg:block' : ''"
          />
          <!-- Traffic indicator target for PC (collapsed sidebar) -->
          <div
            id="sidebar-traffic-indicator"
            class="mb-2 hidden w-full lg:block"
            :class="configStore.sidebarExpanded ? 'lg:hidden' : ''"
          />
          <!-- Theme/Lang switchers (desktop only) -->
          <div
            class="mb-2 hidden items-center gap-1"
            :class="
              configStore.sidebarExpanded ? 'lg:flex' : 'lg:flex lg:flex-col'
            "
          >
            <LangSwitcher />
            <ThemeSwitcher />
          </div>
          <Versions :collapsed="!configStore.sidebarExpanded" />
        </div>
      </div>
    </div>
  </div>
</template>
