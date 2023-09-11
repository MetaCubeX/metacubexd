import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'
import {
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
  PROXIES_ORDERING_TYPE,
  PROXIES_PREVIEW_TYPE,
  TAILWINDCSS_SIZE,
} from '~/constants'
import { setCurTheme } from '~/signals'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.Auto),
  { name: 'proxiesPreviewType', storage: localStorage },
)
export const [proxiesOrderingType, setProxiesOrderingType] = makePersisted(
  createSignal(PROXIES_ORDERING_TYPE.NATURAL),
  { name: 'proxiesOrderingType', storage: localStorage },
)
export const [urlForLatencyTest, setUrlForLatencyTest] = makePersisted(
  createSignal('https://www.gstatic.com/generate_204'),
  { name: 'urlForLatencyTest', storage: localStorage },
)
export const [autoCloseConns, setAutoCloseConns] = makePersisted(
  createSignal(false),
  { name: 'autoCloseConns', storage: localStorage },
)
export const [useTwemoji, setTwemoji] = makePersisted(createSignal(true), {
  name: 'useTwemoji',
  storage: localStorage,
})
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
export const [renderInTwoColumns, setRenderInTwoColumns] = makePersisted(
  createSignal(true),
  { name: 'renderInTwoColumn', storage: localStorage },
)
export const [tableSize, setTableSize] = makePersisted(
  createSignal<TAILWINDCSS_SIZE>(TAILWINDCSS_SIZE.XS),
  { name: 'tableSize', storage: localStorage },
)

export const tableSizeClassName = (size: TAILWINDCSS_SIZE) => {
  let className = 'table-xs'

  switch (size) {
    case TAILWINDCSS_SIZE.XS:
      className = 'table-xs'
      break
    case TAILWINDCSS_SIZE.SM:
      className = 'table-sm'
      break
    case TAILWINDCSS_SIZE.MD:
      className = 'table-md'
      break
    case TAILWINDCSS_SIZE.LG:
      className = 'table-lg'
      break
  }

  return className
}

export const [latencyTestTimeoutDuration, setLatencyTestTimeoutDuration] =
  makePersisted(createSignal(2000), {
    name: 'latencyTestTimeoutDuration',
    storage: localStorage,
  })

export const isLatencyTestByHttps = () =>
  urlForLatencyTest().startsWith('https')

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
