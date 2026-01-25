<script setup lang="ts">
import { IconCheck } from '@tabler/icons-vue'
import { themes } from '~/constants'

interface Props {
  modelValue: (typeof themes)[number]
  maxHeight?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [(typeof themes)[number]]
}>()

// Theme color map - hardcoded to avoid CSS variable issues
const themeColors: Record<
  string,
  { primary: string; secondary: string; accent: string }
> = {
  acid: { primary: '#00ff00', secondary: '#ff00ff', accent: '#00ffff' },
  aqua: { primary: '#09ecf3', secondary: '#966fb3', accent: '#ffe999' },
  autumn: { primary: '#8c0327', secondary: '#d85251', accent: '#d59b6a' },
  black: { primary: '#343232', secondary: '#343232', accent: '#343232' },
  bumblebee: { primary: '#e0a82e', secondary: '#f9d72f', accent: '#181830' },
  business: { primary: '#1c4e80', secondary: '#7c909a', accent: '#ea6947' },
  cmyk: { primary: '#45aeee', secondary: '#e8488a', accent: '#fff232' },
  coffee: { primary: '#db924b', secondary: '#6f4e37', accent: '#263e3f' },
  corporate: { primary: '#4b6bfb', secondary: '#7b92b2', accent: '#67cba0' },
  cupcake: { primary: '#65c3c8', secondary: '#ef9fbc', accent: '#eeaf3a' },
  cyberpunk: { primary: '#ff7598', secondary: '#75d1f0', accent: '#c07eec' },
  dark: { primary: '#661ae6', secondary: '#d926aa', accent: '#1fb2a5' },
  dim: { primary: '#9fe88d', secondary: '#ff7d5c', accent: '#c792e9' },
  dracula: { primary: '#ff79c6', secondary: '#bd93f9', accent: '#ffb86c' },
  emerald: { primary: '#66cc8a', secondary: '#377cfb', accent: '#ea5234' },
  fantasy: { primary: '#6e0b75', secondary: '#007ebd', accent: '#f8860d' },
  forest: { primary: '#1eb854', secondary: '#1db990', accent: '#1db9ac' },
  garden: { primary: '#5c7f67', secondary: '#ecf4e7', accent: '#fae5e5' },
  halloween: { primary: '#f28c18', secondary: '#6d3a9c', accent: '#51a800' },
  lemonade: { primary: '#519903', secondary: '#e9e92e', accent: '#f7f7f7' },
  light: { primary: '#570df8', secondary: '#f000b8', accent: '#37cdbe' },
  lofi: { primary: '#0d0d0d', secondary: '#1a1a1a', accent: '#262626' },
  luxury: { primary: '#ffffff', secondary: '#152747', accent: '#513448' },
  night: { primary: '#38bdf8', secondary: '#818cf8', accent: '#f471b5' },
  nord: { primary: '#5e81ac', secondary: '#81a1c1', accent: '#88c0d0' },
  pastel: { primary: '#d1c1d7', secondary: '#f6cbd1', accent: '#b4e9d6' },
  retro: { primary: '#ef9995', secondary: '#a4cbb4', accent: '#ebdc99' },
  sunset: { primary: '#ff865b', secondary: '#fd6f9c', accent: '#b387fa' },
  synthwave: { primary: '#e779c1', secondary: '#58c7f3', accent: '#f3cc30' },
  valentine: { primary: '#e96d7b', secondary: '#a991f7', accent: '#88dbdd' },
  winter: { primary: '#047aff', secondary: '#463aa2', accent: '#c148ac' },
  wireframe: { primary: '#b8b8b8', secondary: '#b8b8b8', accent: '#b8b8b8' },
}

function getThemeColors(theme: string) {
  return (
    themeColors[theme] || {
      primary: '#570df8',
      secondary: '#f000b8',
      accent: '#37cdbe',
    }
  )
}

function selectTheme(theme: (typeof themes)[number]) {
  emit('update:modelValue', theme)
}
</script>

<template>
  <ul
    class="m-0 flex list-none flex-col gap-0.5 overflow-y-auto rounded-xl bg-gray-800 p-2"
    :style="{ maxHeight: props.maxHeight ? `${props.maxHeight}px` : '16rem' }"
  >
    <li v-for="theme in themes" :key="theme" class="rounded-lg">
      <button
        class="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-[0.8125rem] font-medium text-gray-200 transition-colors duration-150 hover:bg-white/10"
        :class="{ '!bg-indigo-500 !text-white': props.modelValue === theme }"
        @click="selectTheme(theme)"
      >
        <span class="flex shrink-0 gap-0.5">
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).primary }"
          />
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).secondary }"
          />
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).accent }"
          />
        </span>
        <span class="flex-1 text-left text-gray-200 capitalize">{{
          theme
        }}</span>
        <IconCheck
          v-if="props.modelValue === theme"
          class="size-4 shrink-0 text-white"
        />
      </button>
    </li>
  </ul>
</template>
