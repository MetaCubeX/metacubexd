<script setup lang="ts">
import { IconCopy, IconMinus, IconSquare, IconX } from '@tabler/icons-vue'
import { useDesktop } from '~/composables/useDesktop'
import { useWindowControls } from '~/composables/useWindowControls'

// macOS keeps native traffic lights (no self-drawn buttons); Windows/Linux draw
// their own min/max/close. Parent (default.vue) only renders this in desktop
// mode, so isDesktop is implied here.
const { isMac } = useDesktop()
const { isMaximized, minimize, toggleMaximize, close } = useWindowControls()
</script>

<template>
  <!-- 32px draggable bar. dblclick toggles maximize on Win/Linux (frameless has
       no native double-click-to-maximize); macOS handles it natively. -->
  <div
    class="flex h-8 shrink-0 items-center border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-[color-mix(in_oklch,var(--color-base-200)_95%,transparent)] backdrop-blur-[12px]"
    style="-webkit-app-region: drag"
    @dblclick="!isMac && toggleMaximize()"
  >
    <!-- Brand (left). macOS pads ~72px to clear the native traffic lights. -->
    <div class="flex items-center" :class="isMac ? 'pl-[72px]' : 'pl-3'">
      <LogoText />
    </div>

    <div class="flex-1" />

    <!-- Window controls — Windows/Linux only. -->
    <div
      v-if="!isMac"
      class="flex h-full items-center"
      style="-webkit-app-region: no-drag"
    >
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-[color-mix(in_oklch,var(--color-base-content)_8%,transparent)] hover:text-base-content"
        aria-label="minimize"
        @click="minimize"
      >
        <IconMinus class="h-4 w-4" />
      </button>
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-[color-mix(in_oklch,var(--color-base-content)_8%,transparent)] hover:text-base-content"
        :aria-label="isMaximized ? 'restore' : 'maximize'"
        @click="toggleMaximize"
      >
        <IconCopy v-if="isMaximized" class="h-4 w-4" />
        <IconSquare v-else class="h-4 w-4" />
      </button>
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-error hover:text-error-content"
        aria-label="close"
        @click="close"
      >
        <IconX class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
