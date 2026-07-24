<script setup lang="ts">
import type { Component } from 'vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import {
  IconBolt,
  IconChartAreaLine,
  IconChevronsLeft,
  IconChevronsRight,
  IconFileCode,
  IconFileStack,
  IconGlobe,
  IconHome,
  IconMenu2,
  IconNetwork,
  IconPower,
  IconReload,
  IconRoute,
  IconRuler,
  IconServerCog,
  IconSettings,
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { useMenuKeyboard } from '~/composables/useMenuKeyboard'
import {
  useConfigQuery,
  useUpdateConfigMutation,
} from '~/composables/useQueries'
import { orderProxyModes } from '~/utils'

const route = useRoute()
const { t } = useI18n()
const configStore = useConfigStore()
const { hasAgent, hasFeature } = useControlInfo()
const configActions = useConfigActions()

const navItems = computed(() => {
  const items = [
    { href: '/overview', name: t('overview'), icon: IconHome },
    { href: '/proxies', name: t('proxies'), icon: IconGlobe },
    { href: '/rules', name: t('rules'), icon: IconRuler },
    { href: '/connections', name: t('connections'), icon: IconNetwork },
    { href: '/traffic', name: t('dataUsage'), icon: IconChartAreaLine },
    { href: '/logs', name: t('logs'), icon: IconFileStack },
    { href: '/config', name: t('config'), icon: IconSettings },
  ]
  if (hasFeature('profiles')) {
    items.push({ href: '/profiles', name: t('profiles'), icon: IconFileCode })
  }
  // Desktop/server only: one entry point for everything the bundled agent
  // manages (kernel lifecycle, version/geo, system proxy, network sections,
  // runtime config, WebDAV backup). Hidden in the plain web dashboard.
  if (hasAgent.value) {
    items.push({
      href: '/control',
      name: t('controlCenter'),
      icon: IconServerCog,
    })
  }
  return items
})

const isActive = (href: string) => route.path === href

// Running mode switcher (visible on all pages)
const { data: backendConfig } = useConfigQuery()
const updateConfigMutation = useUpdateConfigMutation()

const currentMode = ref('')
const modes = ref<string[]>(['rule', 'global', 'direct'])

watch(
  backendConfig,
  (config) => {
    if (config) {
      currentMode.value = config.mode || 'rule'
      modes.value = orderProxyModes(
        config['mode-list'] || config.modes || ['rule', 'global', 'direct'],
      )
    }
  },
  { immediate: true },
)

const modeIcons: Record<string, Component> = {
  rule: IconRuler,
  global: IconGlobe,
  direct: IconRoute,
}

const getModeIcon = (mode: string) => modeIcons[mode] || IconBolt

const getModeLabel = (mode: string) => {
  const knownModes = ['rule', 'global', 'direct']
  return knownModes.includes(mode)
    ? t(mode as 'rule' | 'global' | 'direct')
    : mode
}

function selectMode(mode: string) {
  if (mode === currentMode.value) {
    isModeMenuOpen.value = false
    return
  }
  // Optimistically reflect the new mode, but roll back + surface a toast if the
  // PATCH fails — otherwise the segmented control desyncs from the backend with
  // no feedback.
  const previous = currentMode.value
  currentMode.value = mode
  updateConfigMutation.mutate(
    { key: 'mode', value: mode },
    {
      onError: () => {
        currentMode.value = previous
        toast.error(t('modeSwitchFailed'))
      },
    },
  )
  isModeMenuOpen.value = false
}

// Floating dropdown for the collapsed sidebar
const modeReference = ref<HTMLElement | null>(null)
const modeFloating = ref<HTMLElement | null>(null)
const isModeMenuOpen = ref(false)

const { floatingStyles: modeFloatingStyles } = useFloating(
  modeReference,
  modeFloating,
  {
    placement: 'right',
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  },
)

function toggleModeMenu() {
  isModeMenuOpen.value = !isModeMenuOpen.value
}

// Keyboard a11y for the collapsed-sidebar mode menu: focus into it on open,
// restore focus to the trigger on Esc/selection, and arrow/Home/End roving.
const { onKeydown: onModeMenuKeydown } = useMenuKeyboard({
  isOpen: isModeMenuOpen,
  triggerEl: modeReference,
  menuEl: modeFloating,
  close: () => {
    isModeMenuOpen.value = false
  },
})

function onModeClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (
    !modeReference.value?.contains(target) &&
    !modeFloating.value?.contains(target)
  ) {
    isModeMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onModeClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onModeClickOutside)
})

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

// Quick kernel actions (#2048): reuse the same Clash-API calls the config page
// uses, so the sidebar shortcuts work against any mihomo backend without a page
// switch.
async function onReloadConfig() {
  // #2057: on success, reload the page so the freshly-applied config surfaces
  // across every view (proxies/rules/etc.) — same window.location.reload()
  // pattern used after a settings import. The reload itself is the feedback.
  if (await configActions.reloadConfigFileAPI()) window.location.reload()
}

async function onRestartCore() {
  // Restarting drops every active connection — guard the one-click action with a
  // confirm (matches traffic.vue's confirm() pattern for destructive ops).
  if (!window.confirm(t('restartCoreConfirm'))) return
  // #2057: refresh once the core is back so the UI reconnects to the new process.
  if (await configActions.restartBackendAPI()) window.location.reload()
}
</script>

<template>
  <div
    class="drawer h-full [--sidebar-border:color-mix(in_oklab,var(--color-base-content)_10%,transparent)] [--sidebar-hover:color-mix(in_oklab,var(--color-base-content)_5%,transparent)]"
    :class="{ 'lg:drawer-open': route.path !== '/setup' }"
  >
    <input
      id="main-drawer"
      ref="drawerCheckbox"
      type="checkbox"
      class="drawer-toggle"
    />

    <div class="drawer-content flex h-full min-w-0 flex-col">
      <!-- Header/Navbar (mobile only) -->
      <header
        class="z-50 flex h-14 items-center gap-2 border-b border-[var(--sidebar-border)] bg-[color-mix(in_oklab,var(--color-base-300)_95%,transparent)] px-2 shadow-[0_4px_20px_color-mix(in_oklab,var(--color-base-content)_5%,transparent)] backdrop-blur-[12px] sm:px-4 lg:hidden"
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
      <div class="flex min-h-0 min-w-0 flex-1 flex-col p-2 sm:p-4">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
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
        class="drawer-overlay bg-[color-mix(in_oklab,var(--color-base-content)_40%,transparent)] backdrop-blur-[4px]"
      />

      <!-- Sidebar container - collapsible on desktop -->
      <div
        class="flex h-full w-52 flex-col border-r border-[var(--sidebar-border)] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-base-200)_98%,transparent)_0%,var(--color-base-200)_100%)] backdrop-blur-[12px] transition-[width] duration-300 ease-[var(--ease-spring-soft)]"
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
            class="press-tactile hidden cursor-pointer items-center justify-center gap-2 rounded-lg border border-[var(--sidebar-border)] bg-transparent p-2 text-sm text-base-content hover:border-[color-mix(in_oklab,var(--color-base-content)_20%,transparent)] hover:bg-[var(--sidebar-hover)] lg:flex"
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

          <!-- Running mode switcher -->
          <div
            class="flex flex-col gap-1.5"
            :class="configStore.sidebarExpanded ? '' : 'lg:hidden'"
          >
            <span
              class="px-1 text-[0.6875rem] font-semibold tracking-[0.05em] text-base-content/40 uppercase"
            >
              {{ t('runningMode') }}
            </span>
            <div
              class="flex gap-1 rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-hover)] p-1"
            >
              <button
                v-for="mode in modes"
                :key="mode"
                class="press-tactile flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md border-none bg-transparent px-1.5 py-1.5 text-xs font-medium text-[color-mix(in_oklab,var(--color-base-content)_70%,transparent)] transition-colors duration-200 hover:text-base-content"
                :class="
                  currentMode === mode
                    ? 'bg-primary/15 text-primary hover:text-primary'
                    : ''
                "
                :title="getModeLabel(mode)"
                @click="selectMode(mode)"
              >
                <span class="truncate">{{ getModeLabel(mode) }}</span>
              </button>
            </div>
          </div>

          <!-- Running mode switcher (collapsed desktop) -->
          <div
            class="relative hidden self-center"
            :class="configStore.sidebarExpanded ? '' : 'lg:block'"
          >
            <button
              ref="modeReference"
              class="press-tactile flex aspect-square w-9 cursor-pointer items-center justify-center rounded-lg border border-[var(--sidebar-border)] bg-transparent text-base-content hover:border-[color-mix(in_oklab,var(--color-base-content)_20%,transparent)] hover:bg-[var(--sidebar-hover)]"
              :class="{
                'border-primary/40 bg-primary/15 text-primary': isModeMenuOpen,
              }"
              :title="`${t('runningMode')}: ${getModeLabel(currentMode)}`"
              aria-haspopup="menu"
              :aria-expanded="isModeMenuOpen"
              @click.stop="toggleModeMenu"
            >
              <component :is="getModeIcon(currentMode)" class="h-5 w-5" />
            </button>

            <Teleport to="body">
              <Transition
                enter-active-class="transition-opacity duration-150"
                leave-active-class="transition-opacity duration-100"
                enter-from-class="opacity-0"
                leave-to-class="opacity-0"
              >
                <div
                  v-if="isModeMenuOpen"
                  ref="modeFloating"
                  :style="modeFloatingStyles"
                  role="menu"
                  class="z-70 w-40 overflow-hidden rounded-xl border border-base-content/10 bg-base-300/98 shadow-[0_10px_40px_var(--color-base-content)/20,0_0_0_1px_var(--color-base-content)/5] backdrop-blur-[12px]"
                  @keydown="onModeMenuKeydown"
                >
                  <div
                    class="flex items-center border-b border-base-content/8 bg-base-200/60 px-3 py-2.5"
                  >
                    <span
                      class="text-[0.6875rem] font-semibold tracking-[0.05em] text-base-content/50 uppercase"
                    >
                      {{ t('runningMode') }}
                    </span>
                  </div>
                  <ul class="m-0 list-none p-1.5">
                    <li v-for="mode in modes" :key="mode">
                      <button
                        role="menuitem"
                        :data-current="currentMode === mode"
                        class="flex w-full cursor-pointer items-center justify-between rounded-lg border-none bg-transparent px-2.5 py-2 transition-all duration-150 ease-in-out hover:bg-base-content/8"
                        :class="{
                          'bg-primary/15 hover:bg-primary/20':
                            currentMode === mode,
                        }"
                        @click="selectMode(mode)"
                      >
                        <span
                          class="flex items-center gap-2 text-[0.8125rem] font-medium text-base-content"
                          :class="{ 'text-primary': currentMode === mode }"
                        >
                          <component
                            :is="getModeIcon(mode)"
                            class="h-4 w-4 shrink-0"
                          />
                          {{ getModeLabel(mode) }}
                        </span>
                        <div
                          v-if="currentMode === mode"
                          class="flex h-4 w-4 items-center justify-center text-primary"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-full w-full"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </div>
                      </button>
                    </li>
                  </ul>
                </div>
              </Transition>
            </Teleport>
          </div>
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
                class="nav-link group relative flex w-full items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm font-medium text-[color-mix(in_oklab,var(--color-base-content)_70%,transparent)] no-underline hover:text-base-content"
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
          <!-- Quick kernel actions (#2048): reload config / restart core -->
          <div
            class="mb-2 hidden flex-col gap-1 lg:flex"
            :class="configStore.sidebarExpanded ? '' : 'items-center'"
          >
            <button
              class="press-tactile flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--sidebar-border)] bg-transparent text-xs font-medium text-base-content hover:border-[color-mix(in_oklab,var(--color-base-content)_20%,transparent)] hover:bg-[var(--sidebar-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                configStore.sidebarExpanded ? 'w-full' : 'aspect-square w-9'
              "
              :title="t('reloadConfig')"
              :disabled="configActions.reloadingConfigFile.value"
              @click="onReloadConfig"
            >
              <IconReload
                class="h-4 w-4 shrink-0"
                :class="
                  configActions.reloadingConfigFile.value ? 'animate-spin' : ''
                "
              />
              <span v-if="configStore.sidebarExpanded" class="truncate">
                {{ t('reloadConfig') }}
              </span>
            </button>
            <button
              class="press-tactile flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--sidebar-border)] bg-transparent text-xs font-medium text-base-content hover:border-[color-mix(in_oklab,var(--color-warning)_40%,transparent)] hover:bg-[color-mix(in_oklab,var(--color-warning)_12%,transparent)] hover:text-warning disabled:cursor-not-allowed disabled:opacity-50"
              :class="
                configStore.sidebarExpanded ? 'w-full' : 'aspect-square w-9'
              "
              :title="t('restartCore')"
              :disabled="configActions.restartingBackend.value"
              @click="onRestartCore"
            >
              <IconPower
                class="h-4 w-4 shrink-0"
                :class="
                  configActions.restartingBackend.value ? 'animate-spin' : ''
                "
              />
              <span v-if="configStore.sidebarExpanded" class="truncate">
                {{ t('restartCore') }}
              </span>
            </button>
          </div>

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
    color-mix(in oklab, var(--color-primary) 18%, transparent) 0%,
    color-mix(in oklab, var(--color-primary) 8%, transparent) 100%
  );
}
.nav-link.is-active:hover .nav-link__glow {
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--color-primary) 24%, transparent) 0%,
    color-mix(in oklab, var(--color-primary) 12%, transparent) 100%
  );
}

/* Active indicator — gentle fade-in, no vertical pop */
.nav-link__indicator {
  width: 3px;
  height: 60%;
  box-shadow:
    0 0 8px color-mix(in oklab, var(--color-primary) 60%, transparent),
    0 0 2px color-mix(in oklab, var(--color-primary) 80%, transparent);
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
