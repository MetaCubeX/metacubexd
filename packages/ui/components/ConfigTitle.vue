<script setup lang="ts">
defineProps<{
  withDivider?: boolean
}>()
</script>

<template>
  <div
    class="py-2 text-center text-lg font-semibold text-base-content"
    :class="{ 'relative flex items-center gap-4': withDivider }"
  >
    <span v-if="withDivider" class="h-px flex-1 bg-base-content/15" />
    <slot />
    <span v-if="withDivider" class="h-px flex-1 bg-base-content/15" />
  </div>
</template>
