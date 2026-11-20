import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

vi.mock('~/utils/appearanceDb', () => ({
  clearBackgroundImage: vi.fn(),
  loadBackgroundImage: vi.fn(),
  saveBackgroundImage: vi.fn(),
}))

const configStore = reactive({ fontFamily: '', enableTwemoji: false })
vi.stubGlobal('useConfigStore', () => configStore)

const { useAppearance } = await import('../useAppearance')

describe('composables/useAppearance rootFontFamily', () => {
  it('is empty without a custom font', () => {
    configStore.fontFamily = ''
    configStore.enableTwemoji = true
    expect(useAppearance().rootFontFamily.value).toBe('')
  })

  it('puts Twemoji in front of a custom font when Twemoji is enabled', () => {
    configStore.fontFamily = 'MiSans'
    configStore.enableTwemoji = true
    expect(useAppearance().rootFontFamily.value).toMatch(
      /^'Twemoji Mozilla', MiSans, /,
    )
  })

  it('starts with the custom font when Twemoji is disabled', () => {
    configStore.fontFamily = 'MiSans'
    configStore.enableTwemoji = false
    expect(useAppearance().rootFontFamily.value).toMatch(/^MiSans, /)
  })
})
