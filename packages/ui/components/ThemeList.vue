<script setup lang="ts">
import { IconCheck } from '@tabler/icons-vue'
import { nextTick, onMounted, ref } from 'vue'
import { themes } from '~/constants'

interface Props {
  modelValue: (typeof themes)[number]
  maxHeight?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [(typeof themes)[number]]
}>()
const { t } = useI18n()

interface ThemePreviewColors {
  base: string
  primary: string
  content: string
}

const fallbackColors: ThemePreviewColors = {
  base: '#1f2937',
  primary: '#570df8',
  content: '#f3f4f6',
}

const listRef = ref<HTMLElement | null>(null)
const themeColors = ref<Record<string, ThemePreviewColors>>({})

function readThemeColors(theme: string): ThemePreviewColors {
  const probe = document.createElement('div')
  probe.setAttribute('data-theme', theme)
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  probe.style.inset = '0'
  document.body.appendChild(probe)

  const style = getComputedStyle(probe)
  const base = style.getPropertyValue('--color-base-100').trim()
  const primary = style.getPropertyValue('--color-primary').trim()
  const content = style.getPropertyValue('--color-base-content').trim()

  probe.remove()

  return {
    base: base || fallbackColors.base,
    primary: primary || fallbackColors.primary,
    content: content || fallbackColors.content,
  }
}

onMounted(() => {
  const colors: Record<string, ThemePreviewColors> = {}
  themes.forEach((theme) => {
    colors[theme] = readThemeColors(theme)
  })
  themeColors.value = colors
  nextTick(() => {
    const selectedThemeItem = listRef.value?.querySelector<HTMLElement>(
      `[data-theme-name="${props.modelValue}"]`,
    )
    selectedThemeItem?.scrollIntoView({ block: 'center' })
  })
})

function getThemeColors(theme: string) {
  return themeColors.value[theme] || fallbackColors
}

function selectTheme(theme: (typeof themes)[number]) {
  emit('update:modelValue', theme)
}
</script>

<template>
  <ul
    ref="listRef"
    class="m-0 flex list-none flex-col gap-0.5 overflow-y-auto rounded-xl bg-gray-800 p-2"
    :style="{ maxHeight: props.maxHeight ? `${props.maxHeight}px` : '20rem' }"
  >
    <li v-for="theme in themes" :key="theme" class="rounded-lg">
      <button
        :data-theme-name="theme"
        class="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-[0.8125rem] font-medium text-gray-200 transition-colors duration-150 hover:bg-white/10"
        :class="{ '!bg-indigo-500 !text-white': props.modelValue === theme }"
        @click="selectTheme(theme)"
      >
        <span
          class="tooltip tooltip-right flex shrink-0 gap-0.5"
          :data-tip="t('themeColorTooltip')"
        >
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).base }"
          />
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).primary }"
          />
          <span
            class="size-3.5 rounded"
            :style="{ backgroundColor: getThemeColors(theme).content }"
          />
        </span>
        <span class="flex-1 text-left text-white capitalize">{{ theme }}</span>
        <IconCheck
          v-if="props.modelValue === theme"
          class="size-4 shrink-0"
          :style="{ color: getThemeColors(theme).primary }"
        />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.tooltip:before {
  max-width: 160px;
  white-space: normal;
  text-align: center;
}
</style>
