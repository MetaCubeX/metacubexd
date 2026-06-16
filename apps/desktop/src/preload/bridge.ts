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
export interface MetacubexdBridge {
  readonly isDesktop: true
  readonly platform: NodeJS.Platform
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
  }
}
