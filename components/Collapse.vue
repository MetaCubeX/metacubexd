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
    class="collapse-arrow collapse border-secondary bg-base-200 shadow-md select-none"
    :class="isOpen ? 'collapse-open' : 'collapse-close'"
  >
    <div
      class="collapse-title pr-4 text-xl font-medium after:top-8!"
      @click="emit('collapse', !isOpen)"
    >
      <slot name="title" />
    </div>

    <div
      class="collapse-content transition-opacity duration-1000"
      :class="[
        isOpen ? 'opacity-100' : 'opacity-0',
        isListMode ? 'isolate flex flex-col gap-2' : 'isolate grid gap-2',
      ]"
      :style="
        isListMode
          ? undefined
          : 'grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))'
      "
    >
      <template v-if="isOpen">
        <slot />
      </template>
    </div>
  </div>
</template>
