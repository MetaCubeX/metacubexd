<script setup lang="ts">
import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconRuler,
  IconSettings,
} from '@tabler/icons-vue'

const route = useRoute()
const { t } = useI18n()

const navItems = computed(() => [
  { href: '/overview', name: t('overview'), icon: IconHome },
  { href: '/proxies', name: t('proxies'), icon: IconGlobe },
  { href: '/rules', name: t('rules'), icon: IconRuler },
  { href: '/connections', name: t('connections'), icon: IconNetwork },
  { href: '/logs', name: t('logs'), icon: IconFileStack },
  { href: '/config', name: t('config'), icon: IconSettings },
])
</script>

<template>
  <header
    class="navbar z-50 flex w-auto items-center justify-center bg-base-300 px-4 shadow-lg"
  >
    <div class="navbar-start">
      <LogoText />
    </div>

    <nav v-if="route.path !== '/setup'" class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal gap-2 menu-lg p-0">
        <li
          v-for="nav in navItems"
          :key="nav.href"
          class="tooltip tooltip-bottom"
          :data-tip="nav.name"
        >
          <NuxtLink
            :to="nav.href"
            class="rounded-box"
            active-class="menu-active"
          >
            <component :is="nav.icon" />
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div class="navbar-end">
      <ThemeSwitcher />
    </div>
  </header>

  <!-- Mobile Bottom Nav -->
  <MobileBottomNav v-if="route.path !== '/setup'" :nav-items="navItems" />
</template>
