<script setup lang="ts">
import { PROXIES_DISPLAY_MODE } from '~/constants'

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

const isListMode = computed(
  () => configStore.proxiesDisplayMode === PROXIES_DISPLAY_MODE.LIST,
)
</script>

<template>
  <div
    class="overflow-hidden rounded-xl transition-[background,border-color] duration-200 ease-out select-none hover:border-[color-mix(in_oklch,var(--color-primary)_40%,transparent)] hover:bg-[color-mix(in_oklch,var(--color-base-200)_95%,transparent)]"
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
      class="gap-3 px-4 pt-2 pb-4 transition-opacity duration-300 ease-out"
      :class="[
        isOpen ? 'opacity-100' : 'hidden opacity-0',
        isListMode
          ? 'flex flex-col'
          : 'grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]',
      ]"
    >
      <template v-if="isOpen">
        <slot />
      </template>
    </div>
  </div>
</template>
