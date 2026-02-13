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
    class="drawer h-full [--sidebar-border:color-mix(in_oklch,var(--color-base-content)_10%,transparent)] [--sidebar-hover:color-mix(in_oklch,var(--color-base-content)_5%,transparent)]"
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
        class="z-50 flex h-14 items-center gap-2 border-b border-[var(--sidebar-border)] bg-[color-mix(in_oklch,var(--color-base-300)_95%,transparent)] px-2 shadow-[0_4px_20px_color-mix(in_oklch,var(--color-base-content)_5%,transparent)] backdrop-blur-[12px] sm:px-4 lg:hidden"
      >
        <!-- Mobile menu button (hidden when using bottom nav) -->
        <label
          v-if="route.path !== '/setup' && !configStore.useMobileBottomNav"
          for="main-drawer"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-transparent text-base-content transition-all duration-200 ease-in-out hover:bg-[var(--sidebar-hover)]"
          aria-label="open sidebar"
        >
          <IconMenu2 class="h-5 w-5" />
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
        <div class="flex min-h-0 flex-1 flex-col">
          <slot />
        </div>

        <!-- Bottom nav spacer -->
        <div
          v-if="configStore.useMobileBottomNav && route.path !== '/setup'"
          class="h-20 shrink-0 lg:hidden"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- Sidebar drawer -->
    <div v-if="route.path !== '/setup'" class="drawer-side z-[60]">
      <label
        for="main-drawer"
        aria-label="close sidebar"
        class="drawer-overlay bg-[color-mix(in_oklch,var(--color-base-content)_40%,transparent)] backdrop-blur-[4px]"
      />

      <!-- Sidebar container - collapsible on desktop -->
      <div
        class="flex h-full w-52 flex-col border-r border-[var(--sidebar-border)] bg-[linear-gradient(180deg,color-mix(in_oklch,var(--color-base-200)_98%,transparent)_0%,var(--color-base-200)_100%)] backdrop-blur-[12px] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="configStore.sidebarExpanded ? '' : 'lg:w-16'"
      >
        <!-- Sidebar header -->
        <div
          class="flex shrink-0 flex-col gap-2 border-b border-[var(--sidebar-border)] p-3"
        >
          <!-- Logo row -->
          <div
            class="flex items-center"
            :class="configStore.sidebarExpanded ? '' : 'lg:justify-center'"
          >
            <LogoText
              v-show="configStore.sidebarExpanded"
              class="hidden lg:block"
            />
            <LogoText class="block lg:hidden" />
          </div>
          <!-- Expand/Collapse button (desktop only) -->
          <button
            class="hidden w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-transparent p-2 text-sm text-base-content transition-all duration-200 ease-in-out hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] hover:bg-[var(--sidebar-hover)] lg:flex"
            :class="configStore.sidebarExpanded ? '' : 'aspect-square w-auto'"
            @click="toggleSidebar"
          >
            <IconChevronsRight
              v-if="!configStore.sidebarExpanded"
              class="h-5 w-5"
            />
            <IconChevronsLeft v-else class="h-5 w-5" />
            <span :class="configStore.sidebarExpanded ? '' : 'lg:hidden'">
              {{ t('collapse') }}
            </span>
          </button>
        </div>

        <!-- Navigation menu -->
        <nav class="flex-1 overflow-y-auto p-2">
          <ul class="m-0 flex list-none flex-col gap-1 p-0">
            <li
              v-for="(nav, index) in navItems"
              :key="nav.href"
              class="animate-[slideIn_0.3s_ease-out_backwards]"
              :style="{ animationDelay: `${index * 50}ms` }"
            >
              <NuxtLink
                :to="nav.href"
                class="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[color-mix(in_oklch,var(--color-base-content)_70%,transparent)] no-underline transition-all duration-200 ease-in-out hover:bg-[var(--sidebar-hover)] hover:text-base-content"
                :class="[
                  isActive(nav.href)
                    ? 'bg-[color-mix(in_oklch,var(--color-primary)_15%,transparent)] !text-primary hover:bg-[color-mix(in_oklch,var(--color-primary)_20%,transparent)]'
                    : '',
                  configStore.sidebarExpanded
                    ? ''
                    : 'lg:justify-center lg:px-0',
                ]"
                :title="configStore.sidebarExpanded ? undefined : nav.name"
              >
                <div
                  class="flex shrink-0 items-center justify-center transition-transform duration-200 ease-in-out group-hover:scale-110"
                >
                  <component :is="nav.icon" class="h-5 w-5" />
                </div>
                <span
                  class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  :class="configStore.sidebarExpanded ? '' : 'lg:hidden'"
                >
                  {{ nav.name }}
                </span>
                <div
                  v-if="isActive(nav.href)"
                  class="absolute top-1/2 left-0 h-[60%] w-[3px] -translate-y-1/2 animate-[indicatorIn_0.2s_ease-out] rounded-r-sm bg-primary"
                />
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <!-- Sidebar footer -->
        <div
          class="shrink-0 border-t border-[var(--sidebar-border)] p-2"
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
            :class="configStore.sidebarExpanded ? 'lg:!hidden' : ''"
          />
          <!-- Theme/Lang switchers (desktop only) -->
          <div
            class="mb-2 hidden items-center gap-1 lg:flex"
            :class="configStore.sidebarExpanded ? 'flex-row' : 'flex-col'"
          >
            <LangSwitcher />
            <ThemeSwitcher />
          </div>
          <Versions :collapsed="!configStore.sidebarExpanded" />
        </div>
      </div>
    </div>

    <!-- Mobile Bottom Navigation (when enabled) -->
    <MobileBottomNav
      v-if="configStore.useMobileBottomNav && route.path !== '/setup'"
      :nav-items="navItems"
    />
  </div>
</template>

<style scoped>
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes indicatorIn {
  from {
    opacity: 0;
    transform: translateY(-50%) scaleY(0);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scaleY(1);
  }
}
</style>
