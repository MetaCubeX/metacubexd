import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, Menu, nativeImage, Tray } from 'electron'

/** mihomo proxy modes exposed by the tray "Proxy mode" submenu. */
export type ProxyMode = 'rule' | 'global' | 'direct'

const MODE_ITEMS: { label: string; mode: ProxyMode }[] = [
  { label: 'Rule', mode: 'rule' },
  { label: 'Global', mode: 'global' },
  { label: 'Direct', mode: 'direct' },
]

export interface TrayDeps {
  getWindow: () => BrowserWindow | null
  startKernel: () => void
  stopKernel: () => void
  quit: () => void
  /** Absolute path to a tray icon PNG (see {@link trayIconPath}). */
  iconPath: string
  /** Clash API endpoint used to read/switch the proxy mode. */
  clash: { url: string; secret: string }
  /**
   * OS system-proxy controller (injected from boot()). When absent the tray
   * omits the "System proxy" checkbox entirely. Narrowed from the agent's
   * SystemProxyController to just what the tray toggle needs.
   */
  systemProxy?: {
    isEnabled: () => Promise<boolean>
    enable: () => Promise<void>
    disable: () => Promise<void>
  }
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export function createTray(deps: TrayDeps): Tray {
  const fetchImpl = deps.fetchImpl ?? fetch
  // Last known mode; cached so a failed/slow GET leaves the previous selection
  // instead of flickering to an unchecked state.
  let currentMode: ProxyMode | null = null
  // Last known system-proxy enabled state; cached so a slow/failed isEnabled()
  // leaves the previous checkbox state instead of flickering to unchecked.
  let sysProxyEnabled = false
  const image = nativeImage.createFromPath(deps.iconPath)
  // On macOS the icon is a monochrome template the system tints to match the
  // light/dark menu bar; other platforms render the white wireframe as-is.
  if (process.platform === 'darwin' && !image.isEmpty()) {
    image.setTemplateImage(true)
  }
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('MetaCubeXD')

  // PATCH the kernel to switch the active proxy mode, then refresh the menu so
  // the new selection is reflected. Failures are swallowed (best-effort).
  const switchMode = async (mode: ProxyMode) => {
    try {
      const res = await fetchImpl(`${deps.clash.url}/configs`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${deps.clash.secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      })
      if (res.ok) {
        currentMode = mode
        rebuild()
      }
    } catch {
      /* best-effort; leave previous selection */
    }
  }

  // GET the current mode and rebuild so the matching radio item is checked.
  const refreshMode = () => {
    void (async () => {
      try {
        const res = await fetchImpl(`${deps.clash.url}/configs`, {
          headers: { Authorization: `Bearer ${deps.clash.secret}` },
        })
        if (!res.ok) return
        const cfg = (await res.json()) as { mode?: string }
        const mode = cfg.mode?.toLowerCase()
        if (mode === 'rule' || mode === 'global' || mode === 'direct') {
          if (mode !== currentMode) {
            currentMode = mode
            rebuild()
          }
        }
      } catch {
        /* best-effort; keep cached/previous selection */
      }
    })()
  }

  // Read the system-proxy state and rebuild if the cached value is stale, so the
  // checkbox reflects reality without blocking the first paint. Best-effort.
  const refreshSysProxy = () => {
    if (!deps.systemProxy) return
    const sysProxy = deps.systemProxy
    void (async () => {
      try {
        const enabled = await sysProxy.isEnabled()
        if (enabled !== sysProxyEnabled) {
          sysProxyEnabled = enabled
          rebuild()
        }
      } catch {
        /* best-effort; keep cached/previous state */
      }
    })()
  }

  // Toggle the OS system proxy (enable when off, disable when on), then refresh
  // the cached state + menu. Failures are swallowed (best-effort).
  const toggleSysProxy = async () => {
    const sysProxy = deps.systemProxy
    if (!sysProxy) return
    try {
      if (sysProxyEnabled) {
        await sysProxy.disable()
        sysProxyEnabled = false
      } else {
        await sysProxy.enable()
        sysProxyEnabled = true
      }
      rebuild()
    } catch {
      /* best-effort; leave previous state */
    }
  }

  const rebuild = () => {
    const loginItem = app.getLoginItemSettings()
    const menu = Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => deps.getWindow()?.show(),
      },
      { type: 'separator' },
      { label: 'Start kernel', click: () => deps.startKernel() },
      { label: 'Stop kernel', click: () => deps.stopKernel() },
      { type: 'separator' },
      {
        label: 'Proxy mode',
        submenu: MODE_ITEMS.map(({ label, mode }) => ({
          label,
          type: 'radio',
          checked: currentMode === mode,
          click: () => void switchMode(mode),
        })),
      },
      // Only rendered when an OS system-proxy controller was injected.
      ...(deps.systemProxy
        ? ([
            {
              label: 'System proxy',
              type: 'checkbox',
              checked: sysProxyEnabled,
              click: () => void toggleSysProxy(),
            },
          ] as const)
        : []),
      { type: 'separator' },
      {
        label: 'Open at login',
        type: 'checkbox',
        checked: loginItem.openAtLogin,
        click: (item) => {
          // Register the login item with `--hidden` so a login-launch starts
          // minimized to the tray (see shouldStartHidden in startup.ts).
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            args: ['--hidden'],
          })
          rebuild()
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => deps.quit() },
    ])
    tray.setContextMenu(menu)
    // Re-sync the current mode + system-proxy state in the background (don't
    // block the first paint).
    refreshMode()
    refreshSysProxy()
  }

  rebuild()
  tray.on('click', () => deps.getWindow()?.show())
  return tray
}

/**
 * Resolve the tray icon path relative to the main bundle (out/main →
 * ../../resources). macOS uses a monochrome `trayTemplate.png` the system
 * auto-inverts for light/dark menu bars; other platforms use the white
 * `tray.png` wireframe. The matching `@2x` retina variant loads automatically.
 */
export function trayIconPath(): string {
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  // ESM: no CJS __dirname. Derive from import.meta.url (bundled into
  // out/main/index.js → ../../resources). Function-local so it never collides
  // with the main module's own __dirname after bundling.
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  return join(__dirname, '..', '..', 'resources', file)
}
