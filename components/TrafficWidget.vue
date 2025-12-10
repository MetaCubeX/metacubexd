<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="stat flex-1 place-items-center">
    <div class="stat-title text-primary-content">
      {{ label }}
    </div>
    <div
      class="stat-value w-full truncate text-center text-2xl text-primary-content lg:text-3xl"
    >
      <slot />
    </div>
  </div>
</template>
