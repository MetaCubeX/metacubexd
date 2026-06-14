import {
  clearBackgroundImage,
  loadBackgroundImage,
  saveBackgroundImage,
} from '~/utils/appearanceDb'

// DaisyUI v5 color tokens exposed to the custom-theme color picker. Each maps to
// a `--color-<token>` CSS custom property on <html>; setting it inline overrides
// the value the active `[data-theme]` would otherwise provide.
export const CUSTOM_THEME_TOKENS = [
  'primary',
  'secondary',
  'accent',
  'base-100',
  'base-content',
] as const

// Module-scoped shared state so the layout (which renders the background) and the
// config page (which uploads/clears it) observe the same object URL.
const customBackgroundUrl = ref('')
let initialized = false

function revokeCustomUrl() {
  if (customBackgroundUrl.value) {
    URL.revokeObjectURL(customBackgroundUrl.value)
    customBackgroundUrl.value = ''
  }
}

export function useAppearance() {
  const configStore = useConfigStore()

  async function reloadCustomBackground() {
    if (!import.meta.client) return
    try {
      const blob = await loadBackgroundImage()
      revokeCustomUrl()
      if (blob) customBackgroundUrl.value = URL.createObjectURL(blob)
    } catch {
      revokeCustomUrl()
    }
  }

  async function setCustomBackground(file: File) {
    await saveBackgroundImage(file)
    configStore.backgroundImageType = 'custom'
    await reloadCustomBackground()
  }

  async function clearCustomBackground() {
    try {
      await clearBackgroundImage()
    } finally {
      revokeCustomUrl()
    }
  }

  // Resolve the image URL for the active background mode.
  const activeBackgroundUrl = computed(() => {
    if (configStore.backgroundImageType === 'custom') {
      return customBackgroundUrl.value
    }
    if (configStore.backgroundImageType === 'url') {
      return configStore.backgroundImageUrl.trim()
    }
    return ''
  })

  const hasBackground = computed(() => activeBackgroundUrl.value !== '')

  // Style for the fixed image layer (image + blur).
  const backgroundLayerStyle = computed(() => ({
    backgroundImage: `url("${activeBackgroundUrl.value}")`,
    filter: configStore.backgroundBlur
      ? `blur(${configStore.backgroundBlur}px)`
      : undefined,
  }))

  // Translucent base-100 sheet laid over the image so cards/text stay legible.
  const backgroundOverlayStyle = computed(() => ({
    backgroundColor: 'var(--color-base-100)',
    opacity: String(
      Math.min(100, Math.max(0, configStore.backgroundOverlayOpacity)) / 100,
    ),
  }))

  // Custom font stack: chosen family first, then the default CJK-aware fallback.
  const FONT_FALLBACK = `'Ubuntu', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif`
  const rootFontFamily = computed(() =>
    configStore.fontFamily ? `${configStore.fontFamily}, ${FONT_FALLBACK}` : '',
  )

  // Apply / remove custom theme color overrides on <html>.
  function applyCustomThemeColors() {
    if (!import.meta.client) return
    const root = document.documentElement
    for (const token of CUSTOM_THEME_TOKENS) {
      const prop = `--color-${token}`
      const value = configStore.enableCustomThemeColors
        ? configStore.customThemeColors[token]
        : undefined
      if (value) root.style.setProperty(prop, value)
      else root.style.removeProperty(prop)
    }
  }

  // Wire reactive application of theme colors. Idempotent across call sites.
  if (import.meta.client && !initialized) {
    initialized = true
    watch(
      [
        () => configStore.enableCustomThemeColors,
        () => configStore.customThemeColors,
      ],
      applyCustomThemeColors,
      { deep: true, immediate: true },
    )
  }

  return {
    activeBackgroundUrl,
    hasBackground,
    backgroundLayerStyle,
    backgroundOverlayStyle,
    rootFontFamily,
    customBackgroundUrl,
    reloadCustomBackground,
    setCustomBackground,
    clearCustomBackground,
    applyCustomThemeColors,
  }
}
