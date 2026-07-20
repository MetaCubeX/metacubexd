import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDesktop } from '../useDesktop'

// Install a fake desktop bridge on window.metacubexd for the duration of a test.
function setBridge(bridge: unknown) {
  ;(window as unknown as { metacubexd?: unknown }).metacubexd = bridge
}

afterEach(() => {
  delete (window as unknown as { metacubexd?: unknown }).metacubexd
})

describe('composables/useDesktop', () => {
  it('reports web mode when no bridge is present', () => {
    const { isDesktop, platform, isMac } = useDesktop()

    expect(isDesktop).toBe(false)
    expect(platform).toBeNull()
    expect(isMac).toBe(false)
  })

  it('provides safe no-op window controls in web mode', async () => {
    const { windowControls } = useDesktop()

    expect(() => windowControls.minimize()).not.toThrow()
    expect(() => windowControls.toggleMaximize()).not.toThrow()
    expect(() => windowControls.close()).not.toThrow()
    await expect(windowControls.isMaximized()).resolves.toBe(false)
    // onMaximizeChange returns an unsubscribe fn that is safe to call.
    const off = windowControls.onMaximizeChange(() => {})
    expect(() => off()).not.toThrow()
  })

  it('reports desktop + macOS from the bridge', () => {
    setBridge({ isDesktop: true, platform: 'darwin', window: {} })
    const { isDesktop, platform, isMac } = useDesktop()

    expect(isDesktop).toBe(true)
    expect(platform).toBe('darwin')
    expect(isMac).toBe(true)
  })

  it('reports desktop + non-macOS for win32', () => {
    setBridge({ isDesktop: true, platform: 'win32', window: {} })
    const { isMac } = useDesktop()

    expect(isMac).toBe(false)
  })

  it('passes the bridge window methods through', () => {
    const minimize = vi.fn()
    setBridge({ isDesktop: true, platform: 'win32', window: { minimize } })

    useDesktop().windowControls.minimize()

    expect(minimize).toHaveBeenCalledTimes(1)
  })

  it('exposes null settings/hotkeys surfaces in web mode', () => {
    const { settings, hotkeys } = useDesktop()
    expect(settings).toBeNull()
    expect(hotkeys).toBeNull()
  })

  it('passes the bridge settings/hotkeys surfaces through', () => {
    const settings = { get: vi.fn(), set: vi.fn() }
    const hotkeys = { get: vi.fn(), set: vi.fn() }
    setBridge({ isDesktop: true, platform: 'darwin', settings, hotkeys })

    const desktop = useDesktop()
    expect(desktop.settings).toBe(settings)
    expect(desktop.hotkeys).toBe(hotkeys)
  })
})
