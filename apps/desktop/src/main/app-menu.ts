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
  /** Restart the mihomo kernel supervisor. */
  restartKernel: () => void
  /** Open a URL in the system browser (shell.openExternal). */
  openExternal: (url: string) => void
  /** Reveal the userData dir (profiles/configs) in the OS file manager. */
  openDataFolder: () => void
  /** Reveal the rotated kernel/app log files in the OS file manager. */
  openLogsFolder: () => void
  /** Show the about panel (app.showAboutPanel; non-mac has no `about` role slot). */
  showAbout: () => void
  /** Query GitHub for a newer release and surface the result. */
  checkForUpdates: () => void
}

/** Project links surfaced in the Help menu. */
export const HELP_URLS = {
  repository: 'https://github.com/MetaCubeX/metacubexd',
  issues: 'https://github.com/MetaCubeX/metacubexd/issues',
} as const

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
        { label: 'Restart Kernel', click: () => actions.restartKernel() },
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
            { label: 'Restart Kernel', click: () => actions.restartKernel() },
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

  // Help menu: project links + the userData escape hatch (support asks "send me
  // your config" — Open Data Folder saves users spelunking for the path). macOS
  // marks it role:'help' so the OS places it last and adds the search field;
  // non-mac additionally hosts About here (no app menu to carry the role).
  template.push({
    label: 'Help',
    ...(isMac ? { role: 'help' as const } : {}),
    submenu: [
      {
        label: 'GitHub Repository',
        click: () => actions.openExternal(HELP_URLS.repository),
      },
      {
        label: 'Report an Issue',
        click: () => actions.openExternal(HELP_URLS.issues),
      },
      { type: 'separator' },
      { label: 'Open Data Folder', click: () => actions.openDataFolder() },
      { label: 'Open Logs Folder', click: () => actions.openLogsFolder() },
      { type: 'separator' },
      {
        label: 'Check for Updates…',
        click: () => actions.checkForUpdates(),
      },
      ...(isMac
        ? []
        : [
            { type: 'separator' } as const,
            { label: 'About MetaCubeXD', click: () => actions.showAbout() },
          ]),
    ],
  })

  return template
}
