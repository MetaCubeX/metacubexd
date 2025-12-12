<script setup lang="ts">
import type { Middleware } from '@floating-ui/vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconCheck, IconChevronDown } from '@tabler/icons-vue'
import { themes } from '~/constants'

interface Props {
  modelValue: (typeof themes)[number]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [(typeof themes)[number]]
}>()

// Floating UI setup
const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)

// Middleware to match width of reference element
const sameWidth: Middleware = {
  name: 'sameWidth',
  fn({ rects, elements }) {
    Object.assign(elements.floating.style, {
      width: `${rects.reference.width}px`,
    })
    return {}
  },
}

const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom-start',
  middleware: [offset(4), flip(), shift({ padding: 8 }), sameWidth],
  whileElementsMounted: autoUpdate,
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function selectTheme(theme: (typeof themes)[number]) {
  emit('update:modelValue', theme)
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
      class="btn w-full justify-between btn-sm"
      :data-theme="props.modelValue"
      @click.stop="toggleMenu"
    >
      <span>{{ props.modelValue }}</span>
      <IconChevronDown
        class="size-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <Teleport to="body">
      <ul
        v-if="isOpen"
        ref="floating"
        :style="floatingStyles"
        class="menu z-70 max-h-64 flex-nowrap overflow-y-auto rounded-box bg-base-300 p-2 shadow-lg"
      >
        <li
          v-for="theme in themes"
          :key="theme"
          :data-theme="theme"
          class="rounded-btn"
        >
          <button
            class="btn justify-between btn-xs"
            :class="{ 'btn-active': props.modelValue === theme }"
            @click="selectTheme(theme)"
          >
            <span>{{ theme }}</span>
            <IconCheck v-if="props.modelValue === theme" class="size-4" />
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>
