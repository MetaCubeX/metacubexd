<script setup lang="ts">
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconPalette } from '@tabler/icons-vue'
import { themes } from '~/constants'

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
  <div>
    <button
      ref="reference"
      class="btn btn-circle btn-sm btn-primary"
      @click.stop="toggleMenu"
    >
      <IconPalette />
    </button>

    <Teleport to="body">
      <ul
        v-if="isOpen"
        ref="floating"
        :style="floatingStyles"
        class="menu z-70 max-h-64 w-40 flex-nowrap overflow-y-auto rounded-box bg-base-300 p-2 shadow-lg"
      >
        <li
          v-for="theme in themes"
          :key="theme"
          :data-theme="theme"
          class="rounded-btn"
        >
          <button
            class="btn justify-start btn-xs"
            :class="{ 'btn-active': configStore.curTheme === theme }"
            @click="setTheme(theme)"
          >
            {{ theme }}
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
