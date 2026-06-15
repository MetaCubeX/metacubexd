import type { BrowserWindow, IpcMain } from 'electron'

export interface WindowControlsDeps {
  /** Only `handle` is used; narrowed so tests can pass a fake. */
  ipcMain: Pick<IpcMain, 'handle'>
  /** Current main window (null when none); read lazily per call. */
  getWindow: () => BrowserWindow | null
}

/**
 * Register the IPC channels the custom title bar (Windows/Linux) drives:
 * minimize, toggle maximize/restore, close, and a maximized-state query. macOS
 * keeps its native traffic lights so it never invokes these, but registering
 * unconditionally is harmless. Every handler is a safe no-op when the window is
 * gone (returns false where a boolean is expected) so a late call can't throw.
 * Call ONCE (e.g. in app.whenReady) — ipcMain.handle throws on a duplicate
 * channel; the per-window maximize-event forwarding lives in createWindow.
 */
export function registerWindowControls({
  ipcMain,
  getWindow,
}: WindowControlsDeps): void {
  ipcMain.handle('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.handle('window:toggle-maximize', () => {
    const win = getWindow()
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle('window:close', () => {
    getWindow()?.close()
  })

  ipcMain.handle(
    'window:is-maximized',
    () => getWindow()?.isMaximized() ?? false,
  )
}
