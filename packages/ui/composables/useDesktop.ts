// packages/ui/composables/useDesktop.ts

// Window-control surface exposed by the desktop preload bridge. On the web (no
// bridge) callers get safe no-ops, so the title bar never has to branch on
// "is there a bridge" — only on platform.
export interface DesktopWindowControls {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  /** Subscribe to native maximize/unmaximize; returns an unsubscribe fn. */
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void
}

interface MetacubexdBridge {
  isDesktop?: boolean
  platform?: string
  window?: Partial<DesktopWindowControls>
  settings?: DesktopSettingsBridge
  hotkeys?: DesktopHotkeysBridge
}

// Desktop-shell settings surface (see apps/desktop/src/preload/bridge.ts —
// kept structurally identical here; the UI never imports desktop code).
export interface DesktopShellSettings {
  silentUpdateCheck: boolean
  tunAutoRestore: boolean
  showTraySpeed: boolean
}

export interface DesktopSettingsBridge {
  get: () => Promise<DesktopShellSettings>
  set: (patch: Partial<DesktopShellSettings>) => Promise<DesktopShellSettings>
}

/** Global-hotkey bindings payload mirrored from the preload bridge. */
export interface DesktopHotkeysPayload {
  bindings: Record<string, string>
  defaults: Record<string, string>
  failed: { action: string; accelerator: string }[]
}

export interface DesktopHotkeysBridge {
  get: () => Promise<DesktopHotkeysPayload>
  set: (bindings: Record<string, string>) => Promise<DesktopHotkeysPayload>
}

const NOOP_CONTROLS: DesktopWindowControls = {
  minimize: () => {},
  toggleMaximize: () => {},
  close: () => {},
  isMaximized: () => Promise.resolve(false),
  onMaximizeChange: () => () => {},
}

/**
 * Detect the Electron desktop shell and expose its window-control bridge. Reads
 * the static `window.metacubexd` object the preload injects (see
 * apps/desktop/src/preload/index.ts). SSR / web build: no bridge → isDesktop
 * false and no-op controls. Any missing bridge method falls back to a no-op so
 * an older/partial preload can't throw at the call site.
 */
export function useDesktop() {
  const bridge =
    typeof window !== 'undefined'
      ? (window as unknown as { metacubexd?: MetacubexdBridge }).metacubexd
      : undefined

  const isDesktop = bridge?.isDesktop === true
  const platform = bridge?.platform ?? null
  const isMac = platform === 'darwin'

  const windowControls: DesktopWindowControls = {
    ...NOOP_CONTROLS,
    ...(bridge?.window ?? {}),
  }

  // Settings/hotkeys stay null on the web (and on an older preload) so the
  // Desktop settings panel can gate itself on their presence.
  const settings = bridge?.settings ?? null
  const hotkeys = bridge?.hotkeys ?? null

  return { isDesktop, platform, isMac, windowControls, settings, hotkeys }
}
