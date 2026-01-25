<script setup lang="ts">
import type { Middleware } from '@floating-ui/vue'
import type { themes } from '~/constants'
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from '@floating-ui/vue'
import { IconChevronDown } from '@tabler/icons-vue'

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
      minWidth: `${Math.max(rects.reference.width, 160)}px`,
    })
    return {}
  },
}

const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom-end',
  middleware: [
    offset(4),
    size({
      padding: 8,
      apply({ availableHeight, elements }) {
        Object.assign(elements.floating.style, {
          maxHeight: `${availableHeight}px`,
        })
      },
    }),
    flip(),
    shift({ padding: 8, crossAxis: true }),
    sameWidth,
  ],
  whileElementsMounted: autoUpdate,
})

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function onThemeSelect(theme: (typeof themes)[number]) {
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
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})
</script>

<template>
  <div class="relative min-w-32 shrink-0">
    <button
      ref="reference"
      class="flex w-full cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-lg border border-base-content/15 bg-base-200/80 px-3 py-1.5 text-sm text-base-content transition-all duration-200 ease-in-out hover:bg-base-content/10"
      @click.stop="toggleMenu"
    >
      <span class="flex-1 truncate text-left capitalize">{{
        props.modelValue
      }}</span>
      <IconChevronDown
        class="size-4 transition-transform duration-200 ease-in-out"
        :class="{ 'rotate-180': isOpen }"
      />
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
          class="z-70 overflow-hidden shadow-lg"
        >
          <ThemeList
            :model-value="props.modelValue"
            @update:model-value="onThemeSelect"
          />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
