import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useWindowControls } from '../useWindowControls'

// A controllable fake of the preload window bridge: spies for the imperative
// methods, plus a captured onMaximizeChange callback the test can fire, and a
// spy unsubscribe so we can assert teardown.
function installBridge(initialMaximized = false) {
  let cb: ((maximized: boolean) => void) | null = null
  const off = vi.fn()
  const windowApi = {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => Promise.resolve(initialMaximized)),
    onMaximizeChange: vi.fn((fn: (m: boolean) => void) => {
      cb = fn
      return off
    }),
  }
  ;(window as unknown as { metacubexd?: unknown }).metacubexd = {
    isDesktop: true,
    platform: 'win32',
    window: windowApi,
  }
  return {
    windowApi,
    off,
    /** Simulate a native maximize/unmaximize event reaching the renderer. */
    fire: (m: boolean) => cb?.(m),
  }
}

afterEach(() => {
  delete (window as unknown as { metacubexd?: unknown }).metacubexd
})

describe('composables/useWindowControls', () => {
  it('seeds isMaximized from the bridge', async () => {
    installBridge(true)
    const { isMaximized } = useWindowControls()

    // Seeding is async (isMaximized() resolves a promise).
    expect(isMaximized.value).toBe(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(isMaximized.value).toBe(true)
  })

  it('updates isMaximized when the window maximize state changes', () => {
    const bridge = installBridge(false)
    const { isMaximized } = useWindowControls()

    bridge.fire(true)
    expect(isMaximized.value).toBe(true)

    bridge.fire(false)
    expect(isMaximized.value).toBe(false)
  })

  it('delegates minimize/toggleMaximize/close to the bridge', () => {
    const bridge = installBridge()
    const { minimize, toggleMaximize, close } = useWindowControls()

    minimize()
    toggleMaximize()
    close()

    expect(bridge.windowApi.minimize).toHaveBeenCalledTimes(1)
    expect(bridge.windowApi.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(bridge.windowApi.close).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes from maximize changes when the scope is disposed', () => {
    const bridge = installBridge()
    const scope = effectScope()
    scope.run(() => {
      useWindowControls()
    })

    expect(bridge.off).not.toHaveBeenCalled()
    scope.stop()
    expect(bridge.off).toHaveBeenCalledTimes(1)
  })
})
