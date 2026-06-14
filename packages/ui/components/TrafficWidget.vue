<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="flex flex-col items-center px-3 py-2">
    <div
      class="text-xs text-[var(--color-primary-content)] opacity-80 sm:text-sm"
    >
      {{ label }}
    </div>
    <div
      class="text-center text-lg font-bold whitespace-nowrap text-[var(--color-primary-content)] sm:text-xl lg:text-2xl"
    >
      <slot />
    </div>
  </div>
</template>
