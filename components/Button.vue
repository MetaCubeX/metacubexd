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
    :class="[needsBtnClass && 'btn', loading ? 'btn-disabled' : buttonClass]"
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
