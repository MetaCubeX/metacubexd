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
  <!-- min-w-0 lets each column shrink below content intrinsic width so long
       node names truncate instead of forcing page-level horizontal scroll. -->
  <div v-if="isTwoColumns" class="flex min-w-0 gap-2">
    <div class="isolate flex min-w-0 flex-1 flex-col gap-2">
      <slot name="even" />
    </div>
    <div class="isolate flex min-w-0 flex-1 flex-col gap-2">
      <slot name="odd" />
    </div>
  </div>
  <div v-else class="isolate flex min-w-0 flex-col gap-2">
    <slot />
  </div>
</template>
