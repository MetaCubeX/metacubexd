<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="stat place-items-center px-2 py-3">
    <div class="stat-title text-xs text-primary-content sm:text-sm">
      {{ label }}
    </div>
    <div
      class="stat-value text-center text-lg whitespace-nowrap text-primary-content sm:text-xl lg:text-2xl"
    >
      <slot />
    </div>
  </div>
</template>
