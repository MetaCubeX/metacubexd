import type { BridgeDeps } from '../bridge'
import { describe, expect, it, vi } from 'vitest'
import { buildMetacubexdBridge } from '../bridge'

type IpcListener = (event: unknown, ...args: unknown[]) => void

// An ipcRenderer double: invoke echoes the channel, on/removeListener track
// registrations so the test can fire a "native" event + assert teardown.
function fakeIpc() {
  const listeners: [string, IpcListener][] = []
  const ipc = {
    invoke: vi.fn((channel: string) => Promise.resolve(`invoked:${channel}`)),
    on: vi.fn((channel: string, listener: IpcListener) => {
      listeners.push([channel, listener])
      return ipc
    }),
    removeListener: vi.fn((channel: string, listener: IpcListener) => {
      const i = listeners.findIndex(([c, l]) => c === channel && l === listener)
      if (i !== -1) listeners.splice(i, 1)
      return ipc
    }),
  }
  return { ipc, listeners }
}

function makeBridge(
  env: NodeJS.ProcessEnv = {},
  platform: NodeJS.Platform = 'darwin',
) {
  const { ipc, listeners } = fakeIpc()
  const bridge = buildMetacubexdBridge({
    env,
    platform,
    ipc: ipc as unknown as BridgeDeps['ipc'],
  })
  return { bridge, ipc, listeners }
}

describe('buildMetacubexdBridge', () => {
  it('marks the runtime as desktop and carries the platform', () => {
    const { bridge } = makeBridge({}, 'win32')
    expect(bridge.isDesktop).toBe(true)
    expect(bridge.platform).toBe('win32')
  })

  it('maps the control + endpoint values from the MCXD_* env', () => {
    const { bridge } = makeBridge({
      MCXD_CONTROL_BASE: 'http://127.0.0.1:1/api/control',
      MCXD_CONTROL_TOKEN: 'tok',
      MCXD_CLASH_URL: 'http://127.0.0.1:2',
      MCXD_CLASH_SECRET: 'sec',
      GITHUB_TOKEN: 'github-token',
    })
    expect(bridge.githubToken).toBe('github-token')
    expect(bridge.control).toEqual({
      base: 'http://127.0.0.1:1/api/control',
      token: 'tok',
    })
    expect(bridge.endpoint).toEqual({
      url: 'http://127.0.0.1:2',
      secret: 'sec',
    })
  })

  it('leaves control/endpoint fields undefined when the env is unset', () => {
    const { bridge } = makeBridge({})
    expect(bridge.githubToken).toBeUndefined()
    expect(bridge.control).toEqual({ base: undefined, token: undefined })
    expect(bridge.endpoint).toEqual({ url: undefined, secret: undefined })
  })

  it('proxies the window controls to their ipc channels', async () => {
    const { bridge, ipc } = makeBridge()
    await bridge.window.minimize()
    await bridge.window.toggleMaximize()
    await bridge.window.close()
    const maximized = await bridge.window.isMaximized()

    expect(ipc.invoke).toHaveBeenCalledWith('window:minimize')
    expect(ipc.invoke).toHaveBeenCalledWith('window:toggle-maximize')
    expect(ipc.invoke).toHaveBeenCalledWith('window:close')
    expect(ipc.invoke).toHaveBeenCalledWith('window:is-maximized')
    expect(maximized).toBe('invoked:window:is-maximized')
  })

  it('onMaximizeChange forwards native events to the callback', () => {
    const { bridge, listeners } = makeBridge()
    const cb = vi.fn()
    bridge.window.onMaximizeChange(cb)

    expect(listeners).toHaveLength(1)
    const [channel, listener] = listeners[0]!
    expect(channel).toBe('window:maximize-changed')
    // Simulate the main process forwarding a native maximize.
    listener({}, true)
    expect(cb).toHaveBeenCalledWith(true)
  })

  it('onMaximizeChange returns an unsubscribe that removes the listener', () => {
    const { bridge, ipc, listeners } = makeBridge()
    const unsub = bridge.window.onMaximizeChange(vi.fn())
    expect(listeners).toHaveLength(1)

    unsub()

    expect(ipc.removeListener).toHaveBeenCalledWith(
      'window:maximize-changed',
      expect.any(Function),
    )
    expect(listeners).toHaveLength(0)
  })

  it('onBackendInvalidate forwards main-process events to the callback', () => {
    const { bridge, listeners } = makeBridge()
    const cb = vi.fn()
    bridge.onBackendInvalidate(cb)

    expect(listeners).toHaveLength(1)
    const [channel, listener] = listeners[0]!
    expect(channel).toBe('backend:invalidate')
    listener({}, { reason: 'mode' })
    expect(cb).toHaveBeenCalledWith({ reason: 'mode' })
  })

  it('onBackendInvalidate returns an unsubscribe that removes the listener', () => {
    const { bridge, ipc, listeners } = makeBridge()
    const unsub = bridge.onBackendInvalidate(vi.fn())
    expect(listeners).toHaveLength(1)

    unsub()

    expect(ipc.removeListener).toHaveBeenCalledWith(
      'backend:invalidate',
      expect.any(Function),
    )
    expect(listeners).toHaveLength(0)
  })

  it('proxies the settings surface to its ipc channels', async () => {
    const { bridge, ipc } = makeBridge()
    await bridge.settings.get()
    await bridge.settings.set({ showTraySpeed: false })
    expect(ipc.invoke).toHaveBeenCalledWith('desktop:get-settings')
    expect(ipc.invoke).toHaveBeenCalledWith('desktop:set-settings', {
      showTraySpeed: false,
    })
  })

  it('proxies the hotkeys surface to its ipc channels', async () => {
    const { bridge, ipc } = makeBridge()
    await bridge.hotkeys.get()
    await bridge.hotkeys.set({ toggleWindow: 'Ctrl+X' })
    expect(ipc.invoke).toHaveBeenCalledWith('desktop:get-hotkeys')
    expect(ipc.invoke).toHaveBeenCalledWith('desktop:set-hotkeys', {
      toggleWindow: 'Ctrl+X',
    })
  })
})
