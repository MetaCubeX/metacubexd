import type { IpcMain } from 'electron'
import type { DesktopSettings } from './desktop-settings'
import type { FailedHotkey, HotkeyBindings } from './hotkeys'

/** What the renderer settings panel reads/writes over the hotkeys channels. */
export interface HotkeysPayload {
  bindings: HotkeyBindings
  defaults: HotkeyBindings
  /** Accelerators that failed to register (conflict/invalid) on the last apply. */
  failed: FailedHotkey[]
}

export interface DesktopIpcDeps {
  /** Only `handle` is used; narrowed so tests can pass a fake. */
  ipcMain: Pick<IpcMain, 'handle'>
  settings: {
    get: () => DesktopSettings
    /** Merge + persist + apply side effects; returns the resulting settings. */
    set: (patch: unknown) => DesktopSettings
  }
  hotkeys: {
    get: () => HotkeysPayload
    /** Persist + re-register; returns the resulting payload (incl. failures). */
    set: (patch: unknown) => HotkeysPayload
  }
}

/**
 * Register the IPC channels behind the renderer's desktop-settings panel
 * (`window.metacubexd.settings` / `.hotkeys` — see preload/bridge.ts). Same
 * contract as window-controls: call ONCE (ipcMain.handle throws on a duplicate
 * channel); the injected getters/setters own persistence and side effects, so
 * this stays a thin, unit-testable channel table.
 */
export function registerDesktopIpc({
  ipcMain,
  settings,
  hotkeys,
}: DesktopIpcDeps): void {
  ipcMain.handle('desktop:get-settings', () => settings.get())
  ipcMain.handle('desktop:set-settings', (_event, patch: unknown) =>
    settings.set(patch),
  )
  ipcMain.handle('desktop:get-hotkeys', () => hotkeys.get())
  ipcMain.handle('desktop:set-hotkeys', (_event, patch: unknown) =>
    hotkeys.set(patch),
  )
}
