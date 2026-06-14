<script setup lang="ts">
import type { Component } from 'vue'
import {
  IconLayoutGrid,
  IconLayoutSidebar,
  IconList,
  IconTable,
  IconTags,
} from '@tabler/icons-vue'
import { PROXIES_DISPLAY_MODE, PROXIES_DISPLAY_MODE_ORDER } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()

// mode → icon + i18n label key
const META: Record<
  PROXIES_DISPLAY_MODE,
  { icon: Component; labelKey: string }
> = {
  [PROXIES_DISPLAY_MODE.CARD]: { icon: IconLayoutGrid, labelKey: 'cardMode' },
  [PROXIES_DISPLAY_MODE.LIST]: { icon: IconList, labelKey: 'listMode' },
  [PROXIES_DISPLAY_MODE.TABLE]: { icon: IconTable, labelKey: 'tableMode' },
  [PROXIES_DISPLAY_MODE.CHIPS]: { icon: IconTags, labelKey: 'chipsMode' },
  [PROXIES_DISPLAY_MODE.MASTER]: {
    icon: IconLayoutSidebar,
    labelKey: 'masterDetailMode',
  },
}

const items = computed(() =>
  PROXIES_DISPLAY_MODE_ORDER.map((mode) => ({
    mode,
    icon: META[mode].icon,
    label: t(META[mode].labelKey),
  })),
)
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 p-1"
  >
    <button
      v-for="item in items"
      :key="item.mode"
      type="button"
      class="flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200"
      :class="
        configStore.proxiesDisplayMode === item.mode
          ? 'bg-primary text-primary-content shadow-sm'
          : 'text-base-content/60 hover:bg-primary/15 hover:text-primary'
      "
      :title="item.label"
      @click="configStore.proxiesDisplayMode = item.mode"
    >
      <component :is="item.icon" :size="16" />
    </button>
  </div>
</template>
