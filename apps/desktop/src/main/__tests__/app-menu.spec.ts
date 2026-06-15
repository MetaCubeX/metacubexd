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

  it('wires custom Show window / Start / Stop kernel items to the actions', () => {
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
    expect(show?.click).toBeTypeOf('function')
    expect(start?.click).toBeTypeOf('function')
    expect(stop?.click).toBeTypeOf('function')
    ;(show!.click as () => void)()
    ;(start!.click as () => void)()
    ;(stop!.click as () => void)()
    expect(actions.showWindow).toHaveBeenCalledTimes(1)
    expect(actions.startKernel).toHaveBeenCalledTimes(1)
    expect(actions.stopKernel).toHaveBeenCalledTimes(1)
  })
})
