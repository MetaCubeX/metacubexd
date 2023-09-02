import { makePersisted } from '@solid-primitives/storage'
import { createSignal } from 'solid-js'
import { PROXIES_PREVIEW_TYPE } from '~/config/enum'
import { setCurTheme } from '~/signals'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.BAR),
  { name: 'proxiesPreviewType', storage: localStorage },
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

const setTheme = (isDark: boolean) => {
  if (autoSwitchTheme()) {
    if (isDark) {
      setCurTheme(favNightTheme())
    } else {
      setCurTheme(favDayTheme())
    }
  }
}

export function applyThemeByMode() {
  setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches)
}

export function useAutoSwitchTheme() {
  applyThemeByMode()
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', (event) => {
      setTheme(event.matches)
    })
}
