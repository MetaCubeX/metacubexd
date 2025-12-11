<script setup lang="ts">
import { IconPalette } from '@tabler/icons-vue'
import { themes } from '~/constants'

const configStore = useConfigStore()

function setTheme(theme: (typeof themes)[number]) {
  configStore.curTheme = theme
}
</script>

<template>
  <div class="drawer drawer-end w-auto">
    <input id="themes" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex items-center">
      <label
        for="themes"
        class="drawer-button btn btn-circle btn-sm btn-primary"
      >
        <IconPalette />
      </label>
    </div>

    <div class="drawer-side overflow-x-hidden">
      <label for="themes" class="drawer-overlay" />

      <ul class="menu gap-2 rounded-l-box bg-base-300 p-2">
        <li
          v-for="theme in themes"
          :key="theme"
          :data-theme="theme"
          class="btn btn-xs"
          @click="setTheme(theme)"
        >
          {{ theme }}
        </li>
      </ul>
    </div>
  </div>
</template>
