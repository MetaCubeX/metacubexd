import type { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { app, Menu, nativeImage, Tray } from 'electron'

export interface TrayDeps {
  getWindow: () => BrowserWindow | null
  startKernel: () => void
  stopKernel: () => void
  quit: () => void
  /** Absolute path to a tray icon PNG (see {@link trayIconPath}). */
  iconPath: string
}

export function createTray(deps: TrayDeps): Tray {
  const image = nativeImage.createFromPath(deps.iconPath)
  // On macOS the icon is a monochrome template the system tints to match the
  // light/dark menu bar; other platforms render the white wireframe as-is.
  if (process.platform === 'darwin' && !image.isEmpty()) {
    image.setTemplateImage(true)
  }
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('MetaCubeXD')

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
