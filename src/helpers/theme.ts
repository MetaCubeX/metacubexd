/**
 * Helper functions to get daisyUI theme colors for Highcharts
 */

// Get computed CSS variable value from :root
const getCSSVariable = (name: string): string => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

// daisyUI theme color getters
export const getThemeColors = () => ({
  // Base content color (text color)
  baseContent: getCSSVariable('--color-base-content') || 'oklch(0.746 0 0)',
  // Base 100/200/300 background colors
  base100: getCSSVariable('--color-base-100') || 'oklch(0.253 0 0)',
  base200: getCSSVariable('--color-base-200') || 'oklch(0.232 0 0)',
  base300: getCSSVariable('--color-base-300') || 'oklch(0.211 0 0)',
  // Primary color
  primary: getCSSVariable('--color-primary') || 'oklch(0.65 0.15 240)',
  primaryContent:
    getCSSVariable('--color-primary-content') || 'oklch(0.98 0 0)',
  // Secondary color
  secondary: getCSSVariable('--color-secondary') || 'oklch(0.65 0.15 300)',
  secondaryContent:
    getCSSVariable('--color-secondary-content') || 'oklch(0.98 0 0)',
  // Accent color
  accent: getCSSVariable('--color-accent') || 'oklch(0.65 0.15 180)',
  accentContent: getCSSVariable('--color-accent-content') || 'oklch(0.98 0 0)',
  // Neutral color
  neutral: getCSSVariable('--color-neutral') || 'oklch(0.3 0 0)',
  neutralContent:
    getCSSVariable('--color-neutral-content') || 'oklch(0.98 0 0)',
  // Info/Success/Warning/Error colors
  info: getCSSVariable('--color-info') || 'oklch(0.65 0.15 220)',
  success: getCSSVariable('--color-success') || 'oklch(0.65 0.15 140)',
  warning: getCSSVariable('--color-warning') || 'oklch(0.8 0.15 80)',
  error: getCSSVariable('--color-error') || 'oklch(0.65 0.2 25)',
})

// Get chart-specific colors derived from theme
export const getChartThemeColors = () => {
  const theme = getThemeColors()

  return {
    // Text colors
    textColor: theme.baseContent,
    textColorHover: theme.primaryContent,
    // Grid and axis colors
    gridLineColor: theme.neutral,
    lineColor: theme.neutral,
    tickColor: theme.neutral,
    // Series colors (using theme accent colors)
    seriesColors: [theme.info, theme.success, theme.warning, theme.error],
    // Background
    backgroundColor: 'transparent',
  }
}
