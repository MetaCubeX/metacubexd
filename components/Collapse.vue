<script setup lang="ts">
import {
  PROXIES_CARD_SIZE_GAP,
  PROXIES_CARD_SIZE_MIN_WIDTH,
  PROXIES_DISPLAY_MODE,
} from '~/constants'

interface Props {
  isOpen?: boolean
}

withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emit = defineEmits<{
  collapse: [value: boolean]
}>()

const configStore = useConfigStore()
const { t } = useI18n()

const displayMode = computed(() => configStore.proxiesDisplayMode)

const isCardMode = computed(
  () => displayMode.value === PROXIES_DISPLAY_MODE.CARD,
)

const isTableMode = computed(
  () => displayMode.value === PROXIES_DISPLAY_MODE.TABLE,
)

// body 容器布局:card=grid,其余按 flex 变体
const bodyLayoutClass = computed(() => {
  switch (displayMode.value) {
    case PROXIES_DISPLAY_MODE.CARD:
      return 'grid'
    case PROXIES_DISPLAY_MODE.CHIPS:
      return 'flex flex-wrap gap-2'
    case PROXIES_DISPLAY_MODE.TABLE:
      return 'flex flex-col gap-1'
    default:
      // List 用纵向 flex
      return 'flex flex-col gap-3'
  }
})

const cardGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(auto-fill, minmax(${PROXIES_CARD_SIZE_MIN_WIDTH[configStore.proxiesCardSize]}px, 1fr))`,
  gap: `${PROXIES_CARD_SIZE_GAP[configStore.proxiesCardSize]}px`,
}))
</script>

<template>
  <div
    class="rounded-xl transition-[background,border-color] duration-200 ease-out select-none hover:border-[color-mix(in_oklch,var(--color-primary)_40%,transparent)] hover:bg-[color-mix(in_oklch,var(--color-base-200)_95%,transparent)]"
    style="
      background: color-mix(in oklch, var(--color-base-200) 80%, transparent);
      border: 1px solid
        color-mix(in oklch, var(--color-secondary) 30%, transparent);
      box-shadow: 0 2px 8px
        color-mix(in oklch, var(--color-base-content) 5%, transparent);
    "
  >
    <div
      class="flex cursor-pointer items-center justify-between p-4 pr-3 text-xl font-medium text-[var(--color-base-content)]"
      :class="
        configStore.stickyGroupHeader && isOpen
          ? 'sticky top-0 z-20 rounded-t-xl backdrop-blur-sm'
          : ''
      "
      :style="
        configStore.stickyGroupHeader && isOpen
          ? {
              background:
                'color-mix(in oklch, var(--color-base-200) 80%, transparent)',
            }
          : undefined
      "
      @click="emit('collapse', !isOpen)"
    >
      <slot name="title" />
      <div
        class="flex h-6 w-6 items-center justify-center text-[color-mix(in_oklch,var(--color-base-content)_50%,transparent)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        :class="isOpen ? 'rotate-180' : ''"
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>

    <div
      class="px-4 pt-2 pb-4 transition-opacity duration-300 ease-out"
      :class="[isOpen ? 'opacity-100' : 'hidden opacity-0', bodyLayoutClass]"
      :style="isCardMode ? cardGridStyle : undefined"
    >
      <template v-if="isOpen">
        <div
          v-if="isTableMode"
          class="flex items-center gap-2 px-3 pb-1 text-[0.7rem] font-semibold tracking-wide text-base-content/40 uppercase"
        >
          <span class="w-4 shrink-0" />
          <span class="min-w-0 flex-1">{{ t('proxyName', 'Name') }}</span>
          <span class="w-16 shrink-0 text-right">{{
            t('proxyType', 'Type')
          }}</span>
          <span class="w-8 shrink-0 text-center">{{ t('udp', 'UDP') }}</span>
          <span class="w-14 shrink-0 text-right">{{
            t('latency', 'Latency')
          }}</span>
        </div>
        <slot />
      </template>
    </div>
  </div>
</template>
