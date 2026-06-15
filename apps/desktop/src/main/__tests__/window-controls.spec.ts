import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { registerWindowControls } from '../window-controls'

// Fake ipcMain: records each handle(channel, handler) so a test can invoke a
// channel's handler directly and assert what it did to the window.
function fakeIpcMain() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      },
    ),
    /** Invoke a registered channel's handler (event arg is irrelevant here). */
    invoke: (channel: string, ...args: unknown[]) =>
      handlers.get(channel)?.({} as unknown, ...args),
    handlers,
  }
}

// Fake BrowserWindow: only the methods window-controls touches. A mutable
// `maximized` flag lets maximize/unmaximize flip state like the real window.
function fakeWindow(initialMaximized = false) {
  let maximized = initialMaximized
  return {
    minimize: vi.fn(),
    maximize: vi.fn(() => {
      maximized = true
    }),
    unmaximize: vi.fn(() => {
      maximized = false
    }),
    isMaximized: vi.fn(() => maximized),
    close: vi.fn(),
  }
}

describe('registerWindowControls', () => {
  it('registers the four window-control channels', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({
      ipcMain,
      getWindow: () => fakeWindow() as unknown as BrowserWindow,
    })

    expect([...ipcMain.handlers.keys()].sort()).toEqual(
      [
        'window:close',
        'window:is-maximized',
        'window:minimize',
        'window:toggle-maximize',
      ].sort(),
    )
  })

  it('window:minimize minimizes the window', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow()
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    ipcMain.invoke('window:minimize')

    expect(win.minimize).toHaveBeenCalledTimes(1)
  })

  it('window:close closes the window', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow()
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    ipcMain.invoke('window:close')

    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('window:toggle-maximize maximizes when not maximized and returns true', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow(false)
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    const result = ipcMain.invoke('window:toggle-maximize')

    expect(win.maximize).toHaveBeenCalledTimes(1)
    expect(win.unmaximize).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('window:toggle-maximize restores when maximized and returns false', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow(true)
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    const result = ipcMain.invoke('window:toggle-maximize')

    expect(win.unmaximize).toHaveBeenCalledTimes(1)
    expect(win.maximize).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('window:is-maximized reflects the window state', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({
      ipcMain,
      getWindow: () => fakeWindow(true) as unknown as BrowserWindow,
    })

    expect(ipcMain.invoke('window:is-maximized')).toBe(true)
  })

  it('is a safe no-op when there is no window', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({ ipcMain, getWindow: () => null })

    expect(() => ipcMain.invoke('window:minimize')).not.toThrow()
    expect(() => ipcMain.invoke('window:close')).not.toThrow()
    expect(ipcMain.invoke('window:toggle-maximize')).toBe(false)
    expect(ipcMain.invoke('window:is-maximized')).toBe(false)
  })
})
