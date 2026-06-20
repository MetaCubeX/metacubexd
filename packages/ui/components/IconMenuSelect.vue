<script setup lang="ts">
import type { Component } from 'vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { IconCheck } from '@tabler/icons-vue'
import { useMenuKeyboard } from '~/composables/useMenuKeyboard'

// Icon-only toolbar control: a square icon button that opens a floating menu of
// options. Keeps the toolbar text-free while still exposing the current choice
// (checked in the open menu). Mirrors LangSwitcher's floating/keyboard wiring.
const props = defineProps<{
  icon: Component
  title: string
  options: { value: string; label: string }[]
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const reference = ref<HTMLElement | null>(null)
const floating = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const { floatingStyles } = useFloating(reference, floating, {
  placement: 'bottom-end',
  middleware: [offset(8), flip(), shift({ padding: 8 })],
  whileElementsMounted: autoUpdate,
})

const { onKeydown } = useMenuKeyboard({
  isOpen,
  triggerEl: reference,
  menuEl: floating,
  close: () => {
    isOpen.value = false
  },
})

function select(value: string) {
  emit('update:modelValue', value)
  isOpen.value = false
}

function onClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (!reference.value?.contains(target) && !floating.value?.contains(target)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div class="relative">
    <button
      ref="reference"
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-base-content/10 bg-base-200/80 text-base-content/70 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-base-content/10 disabled:hover:bg-base-200/80 disabled:hover:text-base-content/70"
      :class="{ 'border-primary/30 bg-primary/15 text-primary': isOpen }"
      :title="props.title"
      :aria-label="props.title"
      :disabled="props.disabled"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click.stop="isOpen = !isOpen"
    >
      <component :is="props.icon" :size="18" />
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
          role="menu"
          class="z-70 min-w-40 overflow-hidden rounded-xl border border-base-content/10 bg-base-300/98 p-1.5 shadow-[0_10px_40px_rgb(0_0_0/0.3)] backdrop-blur-[12px]"
          @keydown="onKeydown"
        >
          <button
            v-for="opt in options"
            :key="opt.value"
            type="button"
            role="menuitem"
            class="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[0.8125rem] text-base-content transition-all duration-150 hover:bg-base-content/8"
            :class="{ 'bg-primary/15 text-primary': opt.value === modelValue }"
            @click="select(opt.value)"
          >
            <span class="whitespace-nowrap">{{ opt.label }}</span>
            <IconCheck v-if="opt.value === modelValue" :size="16" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
