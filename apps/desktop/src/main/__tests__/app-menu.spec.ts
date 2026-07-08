import type { MenuItemConstructorOptions } from 'electron'
import type { AppMenuActions } from '../app-menu'

import { describe, expect, it, vi } from 'vitest'
import { buildAppMenu } from '../app-menu'

// buildAppMenu is a pure template builder — no electron runtime needed. It
// returns MenuItemConstructorOptions[] suitable for Menu.buildFromTemplate.

function noopActions(): AppMenuActions {
  return {
    showWindow: vi.fn(),
    startKernel: vi.fn(),
    stopKernel: vi.fn(),
    restartKernel: vi.fn(),
    openExternal: vi.fn(),
    openDataFolder: vi.fn(),
    openLogsFolder: vi.fn(),
    showAbout: vi.fn(),
    checkForUpdates: vi.fn(),
  }
}

/** Find a top-level submenu by its label. */
function findSubmenu(
  template: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] | undefined {
  const item = template.find((i) => i.label === label)
  if (!item || !Array.isArray(item.submenu)) return undefined
  return item.submenu
}

/** Collect every `role` present (recursively, one level deep) in a submenu. */
function rolesIn(submenu: MenuItemConstructorOptions[]): string[] {
  return submenu
    .map((i) => i.role)
    .filter((r): r is NonNullable<typeof r> => r !== undefined)
}

describe('buildAppMenu', () => {
  it('includes an Edit submenu with the standard editing roles', () => {
    const template = buildAppMenu({
      platform: 'linux',
      actions: noopActions(),
    })
    const edit = findSubmenu(template, 'Edit')
    expect(edit).toBeTruthy()
    const roles = rolesIn(edit!)
    // These roles are what make Cmd/Ctrl+C / V / A work in inputs + Monaco.
    expect(roles).toEqual(
      expect.arrayContaining([
        'undo',
        'redo',
        'cut',
        'copy',
        'paste',
        'selectAll',
      ]),
    )
  })

  it('on macOS prepends an app menu and includes a Window submenu', () => {
    const template = buildAppMenu({
      platform: 'darwin',
      actions: noopActions(),
    })
    // The macOS app menu is the first item, labelled with the app name and
    // carrying the standard appMenu roles (about/quit live here).
    const appMenu = template[0]
    expect(appMenu).toBeTruthy()
    const appRoles = Array.isArray(appMenu!.submenu)
      ? rolesIn(appMenu!.submenu)
      : []
    expect(appRoles).toEqual(expect.arrayContaining(['about', 'quit']))
    // The Window submenu carries the window-management roles.
    const windowMenu = findSubmenu(template, 'Window')
    expect(windowMenu).toBeTruthy()
    expect(rolesIn(windowMenu!)).toEqual(
      expect.arrayContaining(['minimize', 'close']),
    )
  })

  it('omits the macOS app menu on non-macOS platforms', () => {
    const template = buildAppMenu({
      platform: 'win32',
      actions: noopActions(),
    })
    // No app-menu role group at the head; the first submenu is not the macOS
    // app menu (which would carry the `about`/`quit` roles).
    const first = template[0]
    const firstRoles =
      first && Array.isArray(first.submenu) ? rolesIn(first.submenu) : []
    expect(firstRoles).not.toContain('about')
    // No Window submenu with the macOS minimize/zoom/close role group.
    expect(findSubmenu(template, 'Window')).toBeUndefined()
    // Edit menu (the copy/paste fix) is still present on every platform.
    expect(findSubmenu(template, 'Edit')).toBeTruthy()
  })

  it('wires custom Show window / Start / Stop / Restart kernel items to the actions', () => {
    const actions = noopActions()
    const template = buildAppMenu({ platform: 'darwin', actions })
    // Custom items live in the View submenu (or app menu); locate by label
    // across all submenus and fire their click handlers.
    const allItems = template.flatMap((i) =>
      Array.isArray(i.submenu) ? i.submenu : [],
    )
    const show = allItems.find((i) => i.label === 'Show Window')
    const start = allItems.find((i) => i.label === 'Start Kernel')
    const stop = allItems.find((i) => i.label === 'Stop Kernel')
    const restart = allItems.find((i) => i.label === 'Restart Kernel')
    expect(show?.click).toBeTypeOf('function')
    expect(start?.click).toBeTypeOf('function')
    expect(stop?.click).toBeTypeOf('function')
    expect(restart?.click).toBeTypeOf('function')
    ;(show!.click as () => void)()
    ;(start!.click as () => void)()
    ;(stop!.click as () => void)()
    ;(restart!.click as () => void)()
    expect(actions.showWindow).toHaveBeenCalledTimes(1)
    expect(actions.startKernel).toHaveBeenCalledTimes(1)
    expect(actions.stopKernel).toHaveBeenCalledTimes(1)
    expect(actions.restartKernel).toHaveBeenCalledTimes(1)
  })

  it('includes a Help menu with project links + folders + update check on every platform', () => {
    for (const platform of ['darwin', 'win32', 'linux'] as const) {
      const actions = noopActions()
      const help = findSubmenu(buildAppMenu({ platform, actions }), 'Help')
      expect(help).toBeTruthy()

      const github = help!.find((i) => i.label === 'GitHub Repository')
      const issues = help!.find((i) => i.label === 'Report an Issue')
      const data = help!.find((i) => i.label === 'Open Data Folder')
      const logs = help!.find((i) => i.label === 'Open Logs Folder')
      const updates = help!.find((i) => i.label === 'Check for Updates…')
      expect(github?.click).toBeTypeOf('function')
      expect(issues?.click).toBeTypeOf('function')
      expect(data?.click).toBeTypeOf('function')
      expect(logs?.click).toBeTypeOf('function')
      expect(updates?.click).toBeTypeOf('function')
      ;(github!.click as () => void)()
      ;(issues!.click as () => void)()
      ;(data!.click as () => void)()
      ;(logs!.click as () => void)()
      ;(updates!.click as () => void)()
      expect(actions.openExternal).toHaveBeenCalledWith(
        'https://github.com/MetaCubeX/metacubexd',
      )
      expect(actions.openExternal).toHaveBeenCalledWith(
        'https://github.com/MetaCubeX/metacubexd/issues',
      )
      expect(actions.openDataFolder).toHaveBeenCalledTimes(1)
      expect(actions.openLogsFolder).toHaveBeenCalledTimes(1)
      expect(actions.checkForUpdates).toHaveBeenCalledTimes(1)
    }
  })

  it('hosts About in Help on non-mac (macOS keeps the app-menu about role)', () => {
    const actions = noopActions()
    const helpWin = findSubmenu(
      buildAppMenu({ platform: 'win32', actions }),
      'Help',
    )
    const about = helpWin!.find((i) => i.label === 'About MetaCubeXD')
    expect(about?.click).toBeTypeOf('function')
    ;(about!.click as () => void)()
    expect(actions.showAbout).toHaveBeenCalledTimes(1)

    const helpMac = findSubmenu(
      buildAppMenu({ platform: 'darwin', actions: noopActions() }),
      'Help',
    )
    expect(helpMac!.find((i) => i.label === 'About MetaCubeXD')).toBeUndefined()
  })
})
