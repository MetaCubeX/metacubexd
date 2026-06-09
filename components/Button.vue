<script setup lang="ts">
import type { Component } from 'vue'

interface Props {
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  icon?: Component
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  loading: false,
  disabled: false,
})

defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClass = computed(() => props.class || '')
// Only add 'btn' base class if using daisyUI button modifiers
const needsBtnClass = computed(() => buttonClass.value.includes('btn-'))
</script>

<template>
  <button
    :type="type"
    class="btn-press inline-flex items-center justify-center gap-2"
    :class="[
      needsBtnClass && 'btn',
      buttonClass,
      loading && 'btn-disabled cursor-wait',
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <div v-if="loading" class="loading loading-spinner" />
    <template v-else-if="icon">
      <component :is="icon" />
    </template>
    <template v-else>
      <slot />
    </template>
  </button>
</template>

<style scoped>
.btn-press {
  transition:
    transform var(--dur-base) var(--ease-spring),
    box-shadow var(--dur-base) var(--ease-soft),
    background-color var(--dur-fast) var(--ease-soft),
    border-color var(--dur-fast) var(--ease-soft),
    color var(--dur-fast) var(--ease-soft);
  will-change: transform;
}
.btn-press:not(:disabled):hover {
  transform: translateY(-1px);
}
.btn-press:not(:disabled):active {
  transform: translateY(0) scale(0.96);
  transition-duration: var(--dur-instant);
  transition-timing-function: var(--ease-press);
}
.btn-press:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
