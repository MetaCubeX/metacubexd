import type { DesktopIpcDeps } from '../desktop-ipc'
import { describe, expect, it, vi } from 'vitest'
import { registerDesktopIpc } from '../desktop-ipc'

/** A fake ipcMain that records handlers so tests can invoke them directly. */
function fakeIpc() {
  const handlers = new Map<
    string,
    (event: unknown, ...args: unknown[]) => unknown
  >()
  return {
    handle: vi.fn(
      (
        channel: string,
        handler: (event: unknown, ...a: unknown[]) => unknown,
      ) => handlers.set(channel, handler),
    ),
    invoke: (channel: string, ...args: unknown[]) =>
      handlers.get(channel)?.({}, ...args),
    channels: () => [...handlers.keys()],
  }
}

const SETTINGS = {
  silentUpdateCheck: true,
  tunAutoRestore: false,
  showTraySpeed: true,
}
const HOTKEYS = {
  bindings: { toggleWindow: 'CommandOrControl+Shift+W' },
  defaults: { toggleWindow: 'CommandOrControl+Shift+W' },
  failed: [],
}

function deps(over: Partial<DesktopIpcDeps> = {}): {
  ipc: ReturnType<typeof fakeIpc>
  settingsSet: ReturnType<typeof vi.fn>
  hotkeysSet: ReturnType<typeof vi.fn>
} {
  const ipc = fakeIpc()
  const settingsSet = vi.fn((patch: unknown) => ({
    ...SETTINGS,
    ...(patch as object),
  }))
  const hotkeysSet = vi.fn(() => HOTKEYS)
  registerDesktopIpc({
    ipcMain: ipc,
    settings: { get: () => SETTINGS, set: settingsSet },
    hotkeys: { get: () => HOTKEYS, set: hotkeysSet },
    ...over,
  } as DesktopIpcDeps)
  return { ipc, settingsSet, hotkeysSet }
}

describe('registerDesktopIpc', () => {
  it('registers the four settings/hotkeys channels', () => {
    const { ipc } = deps()
    expect(ipc.channels()).toEqual([
      'desktop:get-settings',
      'desktop:set-settings',
      'desktop:get-hotkeys',
      'desktop:set-hotkeys',
    ])
  })

  it('get-settings returns the current settings', () => {
    const { ipc } = deps()
    expect(ipc.invoke('desktop:get-settings')).toEqual(SETTINGS)
  })

  it('set-settings forwards the patch to the injected setter', () => {
    const { ipc, settingsSet } = deps()
    const result = ipc.invoke('desktop:set-settings', { showTraySpeed: false })
    expect(settingsSet).toHaveBeenCalledWith({ showTraySpeed: false })
    expect(result).toMatchObject({ showTraySpeed: false })
  })

  it('set-hotkeys forwards the bindings patch to the injected setter', () => {
    const { ipc, hotkeysSet } = deps()
    ipc.invoke('desktop:set-hotkeys', { toggleWindow: 'Ctrl+X' })
    expect(hotkeysSet).toHaveBeenCalledWith({ toggleWindow: 'Ctrl+X' })
  })
})
