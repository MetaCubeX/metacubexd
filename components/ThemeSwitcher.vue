<script setup lang="ts">
import type { themes } from '~/constants'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconPalette } from '@tabler/icons-vue'

const configStore = useConfigStore()

// Floating UI setup
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const { floatingStyles } = useFloating(reference, floating, {
  placement: 'top',
  middleware: [offset(10), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function setTheme(theme: (typeof themes)[number]) {
  // Update store theme
  configStore.curTheme = theme
  // Ensure document root reflects theme immediately (CSR-only)
  if (import.meta.client) {
    document.documentElement.setAttribute('data-theme', theme)
  }
  // Close menu after selection
  isOpen.value = false
}

// Close menu when clicking outside
function onClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (!reference.value?.contains(target) && !floating.value?.contains(target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <div class="relative">
    <button
      ref="reference"
      class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-primary text-primary-content transition-all duration-200 ease-in-out hover:scale-110 hover:shadow-[0_4px_12px_oklch(var(--p)/0.4)]"
      :class="{ 'scale-110 rotate-[15deg]': isOpen }"
      @click.stop="toggleMenu"
    >
      <IconPalette :size="18" />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          ref="floating"
          :style="floatingStyles"
          class="z-70 w-44 overflow-hidden rounded-xl shadow-lg"
        >
          <div
            class="flex items-center border-b border-gray-700 bg-gray-800/90 px-3 py-2"
          >
            <span
              class="text-[0.6875rem] font-semibold tracking-[0.05em] text-gray-400 uppercase"
            >
              Theme
            </span>
          </div>
          <ThemeList
            :model-value="configStore.curTheme"
            @update:model-value="setTheme"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
