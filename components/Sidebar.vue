<script setup lang="ts">
import {
  IconChartAreaLine,
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
  { href: '/traffic', name: t('dataUsage'), icon: IconChartAreaLine },
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
          class="press-tactile flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-transparent text-base-content hover:bg-[var(--sidebar-hover)]"
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
        class="flex h-full w-52 flex-col border-r border-[var(--sidebar-border)] bg-[linear-gradient(180deg,color-mix(in_oklch,var(--color-base-200)_98%,transparent)_0%,var(--color-base-200)_100%)] backdrop-blur-[12px] transition-[width] duration-300 ease-[var(--ease-spring-soft)]"
        :class="configStore.sidebarExpanded ? '' : 'lg:w-16'"
      >
        <!-- Sidebar header -->
        <div
          class="flex shrink-0 flex-col gap-2 border-b border-[var(--sidebar-border)] p-3"
        >
          <!-- Logo row -->
          <div
            class="flex items-center lg:min-h-7"
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
            class="press-tactile hidden cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-transparent p-2 text-sm text-base-content hover:border-[color-mix(in_oklch,var(--color-base-content)_20%,transparent)] hover:bg-[var(--sidebar-hover)] lg:flex"
            :class="
              configStore.sidebarExpanded
                ? 'w-full'
                : 'aspect-square w-9 self-center'
            "
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
              class="nav-stagger"
              :style="{ animationDelay: `${index * 45}ms` }"
            >
              <NuxtLink
                :to="nav.href"
                class="nav-link group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium text-[color-mix(in_oklch,var(--color-base-content)_70%,transparent)] no-underline hover:text-base-content"
                :class="[
                  isActive(nav.href) ? 'is-active' : '',
                  configStore.sidebarExpanded
                    ? ''
                    : 'lg:justify-center lg:px-0',
                ]"
                :title="configStore.sidebarExpanded ? undefined : nav.name"
              >
                <!-- Active glow surface (sits behind content) -->
                <span
                  aria-hidden="true"
                  class="nav-link__glow pointer-events-none absolute inset-0 rounded-lg"
                />
                <!-- Active indicator bar — morphs into a pill -->
                <span
                  v-if="isActive(nav.href)"
                  aria-hidden="true"
                  class="nav-link__indicator absolute top-1/2 left-0 -translate-y-1/2 rounded-r-full bg-primary"
                />
                <div
                  class="nav-link__icon relative z-1 flex shrink-0 items-center justify-center"
                >
                  <component :is="nav.icon" class="h-5 w-5" />
                </div>
                <span
                  class="relative z-1 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                  :class="configStore.sidebarExpanded ? '' : 'lg:hidden'"
                >
                  {{ nav.name }}
                </span>
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
    />
  </div>
</template>

<style scoped>
/* Staggered entry: combines slide + spring settle */
.nav-stagger {
  animation: navSlideIn 360ms var(--ease-spring) backwards;
}

@keyframes navSlideIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Nav link — base interactions */
.nav-link {
  transition:
    color var(--dur-fast) var(--ease-soft),
    transform var(--dur-base) var(--ease-spring-soft);
  will-change: transform;
}
.nav-link:hover {
  transform: translateX(2px);
}
.nav-link:active {
  transform: translateX(2px) scale(0.98);
  transition-duration: var(--dur-instant);
  transition-timing-function: var(--ease-press);
}

/* Glow surface — fades + grows on hover, shows colored bg on active */
.nav-link__glow {
  background: var(--sidebar-hover);
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity var(--dur-base) var(--ease-soft),
    transform var(--dur-base) var(--ease-spring-soft),
    background var(--dur-base) var(--ease-soft);
}
.nav-link:hover .nav-link__glow {
  opacity: 1;
  transform: scale(1);
}
.nav-link.is-active {
  color: var(--color-primary);
}
.nav-link.is-active .nav-link__glow {
  opacity: 1;
  transform: scale(1);
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--color-primary) 18%, transparent) 0%,
    color-mix(in oklch, var(--color-primary) 8%, transparent) 100%
  );
}
.nav-link.is-active:hover .nav-link__glow {
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--color-primary) 24%, transparent) 0%,
    color-mix(in oklch, var(--color-primary) 12%, transparent) 100%
  );
}

/* Active indicator — gentle fade-in, no vertical pop */
.nav-link__indicator {
  width: 3px;
  height: 60%;
  box-shadow:
    0 0 8px color-mix(in oklch, var(--color-primary) 60%, transparent),
    0 0 2px color-mix(in oklch, var(--color-primary) 80%, transparent);
  animation: indicatorFadeIn var(--dur-base) var(--ease-soft);
}

@keyframes indicatorFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Icon settles with spring on hover; on active stays slightly forward */
.nav-link__icon {
  transition: transform var(--dur-base) var(--ease-spring);
}
.nav-link:hover .nav-link__icon {
  transform: scale(1.1) rotate(-2deg);
}
.nav-link.is-active .nav-link__icon {
  transform: scale(1.05);
}
</style>
