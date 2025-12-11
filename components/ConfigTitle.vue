<script setup lang="ts">
defineProps<{
  withDivider?: boolean
}>()
</script>

<template>
  <div
    class="py-2 text-center text-lg font-semibold"
    :class="{ divider: withDivider }"
  >
    <slot />
  </div>
</template>
