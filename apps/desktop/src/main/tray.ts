import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
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
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

export function createTray(deps: TrayDeps): Tray {
  const fetchImpl = deps.fetchImpl ?? fetch
  // Last known mode; cached so a failed/slow GET leaves the previous selection
  // instead of flickering to an unchecked state.
  let currentMode: ProxyMode | null = null
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
      { type: 'separator' },
      {
        label: 'Open at login',
        type: 'checkbox',
        checked: loginItem.openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked })
          rebuild()
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => deps.quit() },
    ])
    tray.setContextMenu(menu)
    // Re-sync the current mode in the background (don't block the first paint).
    refreshMode()
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
  return join(__dirname, '..', '..', 'resources', file)
}
