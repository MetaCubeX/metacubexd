import type { IpcRenderer } from 'electron'

/**
 * The renderer bridge contract (spec §4) exposed as `window.metacubexd` and
 * consumed by packages/ui (plugins/desktop-endpoint.client.ts +
 * composables/useControlApi.ts + composables/useDesktop.ts). Declared as ONE
 * typed shape here — preload/index.ts builds it via buildMetacubexdBridge() and
 * hands it to contextBridge.exposeInMainWorld. Keep the UI's ambient
 * `window.metacubexd` typing in sync with this interface.
 *
 *   control/endpoint  — loopback URLs + per-launch secrets the main process sets
 *                       as env on this preload's process (boot()).
 *   window.*          — proxy to the main-process IPC channels registered by
 *                       window-controls.ts (custom title bar on Windows/Linux).
 */
/** Payload the main process sends when Clash state changed outside the UI. */
export interface BackendInvalidatePayload {
  reason?: 'mode' | 'profile' | 'show' | string
}

/**
 * Desktop-shell settings as the renderer sees them (mirrors
 * main/desktop-settings.ts DesktopSettings — kept structurally identical, but
 * declared here so preload never imports main-process code).
 */
export interface DesktopSettingsPayload {
  silentUpdateCheck: boolean
  tunAutoRestore: boolean
  showTraySpeed: boolean
}

/**
 * Hotkey bindings payload (mirrors main/desktop-ipc.ts HotkeysPayload): the
 * current per-action accelerators, the defaults (for a Reset control), and
 * which accelerators failed to register on the last apply.
 */
export interface HotkeysSettingsPayload {
  bindings: Record<string, string>
  defaults: Record<string, string>
  failed: { action: string; accelerator: string }[]
}

export interface MetacubexdBridge {
  readonly isDesktop: true
  readonly platform: NodeJS.Platform
  readonly githubToken?: string
  readonly control: { base?: string; token?: string }
  readonly endpoint: { url?: string; secret?: string }
  readonly window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<boolean>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    /** Subscribe to native maximize/unmaximize; returns an unsubscribe fn. */
    onMaximizeChange: (cb: (maximized: boolean) => void) => () => void
  }
  /**
   * Subscribe to main-process "backend state changed" events (tray/hotkey mode
   * switch, profile activate, window re-show). Returns an unsubscribe fn.
   */
  onBackendInvalidate: (
    cb: (payload: BackendInvalidatePayload) => void,
  ) => () => void
  /** Desktop-shell settings (silent update check, TUN auto-restore, …). */
  readonly settings: {
    get: () => Promise<DesktopSettingsPayload>
    set: (
      patch: Partial<DesktopSettingsPayload>,
    ) => Promise<DesktopSettingsPayload>
  }
  /** Global-hotkey bindings (read + apply with live re-registration). */
  readonly hotkeys: {
    get: () => Promise<HotkeysSettingsPayload>
    set: (bindings: Record<string, string>) => Promise<HotkeysSettingsPayload>
  }
}

/** What buildMetacubexdBridge needs from the preload runtime (injected for tests). */
export interface BridgeDeps {
  /** The env the main process set on this preload (MCXD_* keys). */
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  /** Narrowed ipcRenderer surface; the real ipcRenderer satisfies it. */
  ipc: Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>
}

/** The channel the main process forwards native maximize/unmaximize on. */
const MAXIMIZE_CHANGED = 'window:maximize-changed'

/** Main → renderer: Clash/config state changed outside the SPA mutation path. */
export const BACKEND_INVALIDATE = 'backend:invalidate'

/**
 * Build the renderer bridge object from the preload runtime. Pure (no
 * contextBridge side effect) so the env→bridge mapping and the ipc wiring are
 * unit-testable without an Electron preload context.
 */
export function buildMetacubexdBridge({
  env,
  platform,
  ipc,
}: BridgeDeps): MetacubexdBridge {
  return {
    isDesktop: true,
    platform,
    githubToken: env.GITHUB_TOKEN,
    control: {
      base: env.MCXD_CONTROL_BASE,
      token: env.MCXD_CONTROL_TOKEN,
    },
    endpoint: {
      url: env.MCXD_CLASH_URL,
      secret: env.MCXD_CLASH_SECRET,
    },
    window: {
      minimize: () => ipc.invoke('window:minimize') as Promise<void>,
      toggleMaximize: () =>
        ipc.invoke('window:toggle-maximize') as Promise<boolean>,
      close: () => ipc.invoke('window:close') as Promise<void>,
      isMaximized: () => ipc.invoke('window:is-maximized') as Promise<boolean>,
      onMaximizeChange: (cb: (maximized: boolean) => void) => {
        const handler = (_event: unknown, maximized: boolean): void =>
          cb(maximized)
        ipc.on(MAXIMIZE_CHANGED, handler)
        return () => ipc.removeListener(MAXIMIZE_CHANGED, handler)
      },
    },
    onBackendInvalidate: (cb: (payload: BackendInvalidatePayload) => void) => {
      const handler = (
        _event: unknown,
        payload: BackendInvalidatePayload,
      ): void => cb(payload ?? {})
      ipc.on(BACKEND_INVALIDATE, handler)
      return () => ipc.removeListener(BACKEND_INVALIDATE, handler)
    },
    settings: {
      get: () =>
        ipc.invoke('desktop:get-settings') as Promise<DesktopSettingsPayload>,
      set: (patch) =>
        ipc.invoke(
          'desktop:set-settings',
          patch,
        ) as Promise<DesktopSettingsPayload>,
    },
    hotkeys: {
      get: () =>
        ipc.invoke('desktop:get-hotkeys') as Promise<HotkeysSettingsPayload>,
      set: (bindings) =>
        ipc.invoke(
          'desktop:set-hotkeys',
          bindings,
        ) as Promise<HotkeysSettingsPayload>,
    },
  }
}
