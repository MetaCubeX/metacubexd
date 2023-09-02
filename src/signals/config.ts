import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'
import {
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
  PROXIES_PREVIEW_TYPE,
  PROXIES_SORTING_TYPE,
} from '~/constants'
import { setCurTheme } from '~/signals'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.Auto),
  { name: 'proxiesPreviewType', storage: localStorage },
)
export const [proxiesSortingType, setProxiesSortingType] = makePersisted(
  createSignal(PROXIES_SORTING_TYPE.NATURAL),
  { name: 'proxiesSortingType', storage: localStorage },
)
export const [urlForDelayTest, setUrlForDelayTest] = makePersisted(
  createSignal('https://www.gstatic.com/generate_204'),
  { name: 'urlForDelayTest', storage: localStorage },
)
export const [autoCloseConns, setAutoCloseConns] = makePersisted(
  createSignal(false),
  { name: 'autoCloseConns', storage: localStorage },
)
export const [autoSwitchTheme, setAutoSwitchTheme] = makePersisted(
  createSignal(false),
  { name: 'autoSwitchTheme', storage: localStorage },
)
export const [favDayTheme, setFavDayTheme] = makePersisted(
  createSignal('light'),
  { name: 'favDayTheme', storage: localStorage },
)
export const [favNightTheme, setFavNightTheme] = makePersisted(
  createSignal('night'),
  { name: 'favNightTheme', storage: localStorage },
)
export const [renderInTwoColumn, setRenderInTwoColumn] = makePersisted(
  createSignal(true),
  { name: 'renderInTwoColumn', storage: localStorage },
)

export const isLatencyTestByHttps = () => urlForDelayTest().startsWith('https')

export const latencyQualityMap = () =>
  isLatencyTestByHttps() ? LATENCY_QUALITY_MAP_HTTPS : LATENCY_QUALITY_MAP_HTTP

const setTheme = (isDark: boolean) => {
  if (autoSwitchTheme()) {
    if (isDark) {
      setCurTheme(favNightTheme())
    } else {
      setCurTheme(favDayTheme())
    }
  }
}

export const applyThemeByMode = () =>
  setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)

export const useAutoSwitchTheme = () => {
  applyThemeByMode()

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => setTheme(event.matches))
}
