<script setup lang="ts">
const configStore = useConfigStore()
const { width } = useWindowSize()

const isBiggerScreen = computed(() => width.value > 480)
const isTwoColumns = computed(
  () => configStore.renderProxiesInTwoColumns && isBiggerScreen.value,
)

defineExpose({ isTwoColumns })
</script>

<template>
  <div v-if="isTwoColumns" class="flex gap-2">
    <div class="isolate flex flex-1 flex-col gap-2">
      <slot name="even" />
    </div>
    <div class="isolate flex flex-1 flex-col gap-2">
      <slot name="odd" />
    </div>
  </div>
  <div v-else class="isolate flex flex-col gap-2">
    <slot />
  </div>
</template>
