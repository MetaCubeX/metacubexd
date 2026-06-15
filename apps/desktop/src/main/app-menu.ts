import type { MenuItemConstructorOptions } from 'electron'

/**
 * Custom (non-role) menu actions wired into the application menu. Injected so
 * the template builder stays pure (no electron runtime, no module-level state)
 * and unit tests can assert the click -> action wiring.
 */
export interface AppMenuActions {
  /** Summon + focus the main window. */
  showWindow: () => void
  /** Start the mihomo kernel supervisor. */
  startKernel: () => void
  /** Stop the mihomo kernel supervisor. */
  stopKernel: () => void
}

export interface BuildAppMenuOptions {
  /** `process.platform` — drives the macOS vs non-macOS menu shape. */
  platform: NodeJS.Platform
  actions: AppMenuActions
}

/**
 * Build the application menu template (for `Menu.buildFromTemplate`).
 *
 * The Edit submenu (undo/redo/cut/copy/paste/selectAll roles) is present on
 * every platform — without an application menu the OS does not wire the
 * standard Cmd/Ctrl+C / V / A accelerators, so copy/paste silently fail in
 * inputs and the Monaco editor. On macOS we additionally prepend the standard
 * app menu (about/services/hide/quit) and add a Window submenu, matching native
 * conventions.
 *
 * Pure template builder: no electron runtime is touched, so it is trivially
 * unit-testable.
 */
export function buildAppMenu(
  opts: BuildAppMenuOptions,
): MenuItemConstructorOptions[] {
  const { platform, actions } = opts
  const isMac = platform === 'darwin'

  const template: MenuItemConstructorOptions[] = []

  // macOS app menu (first item, named after the app). Houses about/quit + the
  // custom kernel/window actions so they are reachable on macOS where the Edit
  // menu shouldn't carry app-level commands.
  if (isMac) {
    template.push({
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Show Window', click: () => actions.showWindow() },
        { label: 'Start Kernel', click: () => actions.startKernel() },
        { label: 'Stop Kernel', click: () => actions.stopKernel() },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  // Edit submenu — the actual copy/paste fix. Standard editing roles on every
  // platform.
  template.push({
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  })

  // View submenu — reload / devtools / zoom. On non-macOS we also surface the
  // custom kernel + window actions here (no app menu to host them).
  template.push({
    label: 'View',
    submenu: [
      ...(isMac
        ? []
        : [
            { label: 'Show Window', click: () => actions.showWindow() },
            { label: 'Start Kernel', click: () => actions.startKernel() },
            { label: 'Stop Kernel', click: () => actions.stopKernel() },
            { type: 'separator' } as const,
          ]),
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  })

  // Window submenu (macOS native convention).
  if (isMac) {
    template.push({
      label: 'Window',
      role: 'windowMenu',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
    })
  }

  return template
}
