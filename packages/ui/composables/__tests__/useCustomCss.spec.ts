// packages/ui/composables/__tests__/useCustomCss.spec.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import {
  applyCustomCss,
  CUSTOM_CSS_STYLE_ID,
  useCustomCss,
} from '../useCustomCss'

// The store is provided to the composable as a global auto-import. Back it with a
// reactive object so toRef(store, 'customCss') tracks mutations the way a Pinia
// store's unwrapped property does.
const mockConfigStore = reactive({
  customCss: '',
})
vi.stubGlobal('useConfigStore', () => mockConfigStore)

function styleEl() {
  return document.getElementById(CUSTOM_CSS_STYLE_ID)
}

describe('composables/useCustomCss', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockConfigStore.customCss = ''
    document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove()
  })

  describe('applyCustomCss', () => {
    it('injects a managed <style id="mcxd-custom-css"> with the given CSS', () => {
      applyCustomCss('body { color: red; }')
      const el = styleEl()
      expect(el).not.toBeNull()
      expect(el?.tagName).toBe('STYLE')
      expect(el?.textContent).toBe('body { color: red; }')
      expect(document.head.contains(el)).toBe(true)
    })

    it('updates the existing managed element in place (no duplicates)', () => {
      applyCustomCss('a { color: blue; }')
      applyCustomCss('a { color: green; }')
      const els = document.querySelectorAll(`#${CUSTOM_CSS_STYLE_ID}`)
      expect(els.length).toBe(1)
      expect(els[0]?.textContent).toBe('a { color: green; }')
    })

    it('removes the managed element when the CSS is empty', () => {
      applyCustomCss('h1 { font-size: 2rem; }')
      expect(styleEl()).not.toBeNull()
      applyCustomCss('')
      expect(styleEl()).toBeNull()
    })

    it('removes the managed element when the CSS is whitespace only', () => {
      applyCustomCss('h1 { font-size: 2rem; }')
      applyCustomCss('   \n\t  ')
      expect(styleEl()).toBeNull()
    })

    it('is a no-op (no element created) when called with empty CSS', () => {
      applyCustomCss('')
      expect(styleEl()).toBeNull()
    })
  })

  describe('useCustomCss', () => {
    it('exposes the customCss ref from the config store', () => {
      mockConfigStore.customCss = '.x { color: pink; }'
      const { customCss } = useCustomCss()
      expect(customCss.value).toBe('.x { color: pink; }')
    })

    it('injects on init when the store already has CSS (immediate watch)', () => {
      mockConfigStore.customCss = 'div { margin: 0; }'
      useCustomCss()
      expect(styleEl()?.textContent).toBe('div { margin: 0; }')
    })

    it('reactively updates the managed element when the CSS changes', async () => {
      useCustomCss()
      mockConfigStore.customCss = 'p { line-height: 1.5; }'
      await nextTick()
      expect(styleEl()?.textContent).toBe('p { line-height: 1.5; }')
    })

    it('reactively removes the managed element when the CSS is cleared', async () => {
      mockConfigStore.customCss = 'span { display: none; }'
      useCustomCss()
      expect(styleEl()).not.toBeNull()
      mockConfigStore.customCss = ''
      await nextTick()
      expect(styleEl()).toBeNull()
    })
  })
})
