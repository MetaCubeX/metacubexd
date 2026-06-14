import type {BrowserWindow} from 'electron';
import { join } from 'node:path'
import { app,  Menu, nativeImage, Tray } from 'electron'

export interface TrayDeps {
  getWindow: () => BrowserWindow | null
  startKernel: () => void
  stopKernel: () => void
  quit: () => void
  /** Absolute path to a tray icon PNG (resources/tray.png). */
  iconPath: string
}

export function createTray(deps: TrayDeps): Tray {
  const image = nativeImage.createFromPath(deps.iconPath)
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

/** Resolve the tray icon path relative to the main bundle (out/main). */
export function trayIconPath(): string {
  return join(__dirname, '..', '..', 'resources', 'tray.png')
}
