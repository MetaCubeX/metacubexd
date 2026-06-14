import type { MenuItemConstructorOptions } from 'electron'
import type { TrayDeps } from '../tray'

import { app } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTray } from '../tray'

// --- electron mock -----------------------------------------------------------
// Capture every menu template buildFromTemplate receives so we can inspect /
// click items. The real electron module only fully works inside the Electron
// runtime, so we stub the pieces tray.ts touches.
const builtTemplates: MenuItemConstructorOptions[][] = []

vi.mock('electron', () => {
  return {
    app: {
      getLoginItemSettings: () => ({ openAtLogin: false }),
      setLoginItemSettings: vi.fn(),
    },
    Menu: {
      buildFromTemplate: (template: MenuItemConstructorOptions[]) => {
        builtTemplates.push(template)
        return { template }
      },
    },
    nativeImage: {
      createFromPath: () => ({
        isEmpty: () => true,
        setTemplateImage: vi.fn(),
      }),
      createEmpty: () => ({}),
    },
    Tray: class {
      setToolTip = vi.fn()
      setContextMenu = vi.fn()
      on = vi.fn()
      destroy = vi.fn()
    },
  }
})

const CLASH = { url: 'http://127.0.0.1:9090', secret: 's3cr3t' }

function baseDeps(fetchImpl: typeof fetch): TrayDeps {
  return {
    getWindow: () => null,
    startKernel: vi.fn(),
    stopKernel: vi.fn(),
    quit: vi.fn(),
    iconPath: '/x/tray.png',
    clash: CLASH,
    fetchImpl,
  }
}

/** Flatten the last-built template's labels (for "existing items" assertions). */
function lastTemplate(): MenuItemConstructorOptions[] {
  const t = builtTemplates.at(-1)
  if (!t) throw new Error('no template built')
  return t
}

function findItem(
  template: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions | undefined {
  return template.find((i) => i.label === label)
}

/** Locate the Proxy mode submenu's radio items. */
function proxyModeItems(): MenuItemConstructorOptions[] {
  const submenu = findItem(lastTemplate(), 'Proxy mode')?.submenu
  if (!Array.isArray(submenu)) throw new Error('Proxy mode submenu missing')
  return submenu
}

describe('createTray proxy-mode submenu', () => {
  beforeEach(() => {
    builtTemplates.length = 0
  })

  it('keeps the existing menu items', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ mode: 'rule' }),
    ) as unknown as typeof fetch
    createTray(baseDeps(fetchImpl))
    const t = lastTemplate()
    expect(findItem(t, 'Show')).toBeTruthy()
    expect(findItem(t, 'Start kernel')).toBeTruthy()
    expect(findItem(t, 'Stop kernel')).toBeTruthy()
    expect(findItem(t, 'Open at login')).toBeTruthy()
    expect(findItem(t, 'Quit')).toBeTruthy()
    expect(findItem(t, 'Proxy mode')).toBeTruthy()
  })

  it('registers the login item with the --hidden arg so login-launch starts hidden', () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ mode: 'rule' }),
    ) as unknown as typeof fetch
    const setLoginItemSettings = vi.mocked(app.setLoginItemSettings)
    setLoginItemSettings.mockClear()
    createTray(baseDeps(fetchImpl))

    const openAtLogin = findItem(lastTemplate(), 'Open at login')
    expect(openAtLogin?.type).toBe('checkbox')
    expect(openAtLogin?.click).toBeTypeOf('function')
    // electron passes the toggled MenuItem; simulate checking the box.
    ;(openAtLogin!.click as (i: unknown) => unknown)({ checked: true })

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--hidden'],
    })
  })

  it('renders three radio mode items (Rule/Global/Direct)', () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ mode: 'rule' }),
    ) as unknown as typeof fetch
    createTray(baseDeps(fetchImpl))
    const labels = proxyModeItems().map((i) => i.label)
    expect(labels).toEqual(['Rule', 'Global', 'Direct'])
    expect(proxyModeItems().every((i) => i.type === 'radio')).toBe(true)
  })

  it('pATCHes /configs with the mode + bearer auth when an item is clicked', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ mode: 'rule' }))
    createTray(baseDeps(fetchImpl as unknown as typeof fetch))
    fetchImpl.mockClear()

    const global = proxyModeItems().find((i) => i.label === 'Global')
    expect(global?.click).toBeTypeOf('function')
    // electron passes the MenuItem as first arg; click ignores it here.
    await (global!.click as (i: unknown) => unknown)({})

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:9090/configs',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer s3cr3t',
        }),
        body: JSON.stringify({ mode: 'global' }),
      }),
    )
  })

  it('marks the current mode (from GET /configs) as checked after rebuild', async () => {
    let resolveFetch: (r: Response) => void = () => {}
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res
        }),
    ) as unknown as typeof fetch

    createTray(baseDeps(fetchImpl))
    // The initial rebuild fires a GET to learn the current mode.
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:9090/configs',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer s3cr3t' }),
      }),
    )
    resolveFetch(jsonResponse({ mode: 'direct' }))
    // Allow the async GET handler + rebuild to flush.
    await vi.waitFor(() => {
      const direct = proxyModeItems().find((i) => i.label === 'Direct')
      expect(direct?.checked).toBe(true)
    })
  })

  it('does not throw and keeps the menu when the GET fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom')
    }) as unknown as typeof fetch
    expect(() => createTray(baseDeps(fetchImpl))).not.toThrow()
    // menu still has the submenu after the failed fetch settles
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'Proxy mode')).toBeTruthy()
    })
  })
})

type FakeSystemProxy = NonNullable<TrayDeps['systemProxy']>

describe('createTray system-proxy checkbox', () => {
  beforeEach(() => {
    builtTemplates.length = 0
  })

  const okFetch = () =>
    vi.fn(async () => jsonResponse({ mode: 'rule' })) as unknown as typeof fetch

  function depsWithSysProxy(sysProxy: FakeSystemProxy): TrayDeps {
    return { ...baseDeps(okFetch()), systemProxy: sysProxy }
  }

  it('omits the System proxy item when no controller is injected', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'System proxy')).toBeUndefined()
    // Wave-1 items remain intact.
    expect(findItem(lastTemplate(), 'Proxy mode')).toBeTruthy()
    expect(findItem(lastTemplate(), 'Quit')).toBeTruthy()
  })

  it('renders a checkbox System proxy item when a controller is injected', () => {
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => false),
      enable: vi.fn(async () => {}),
      disable: vi.fn(async () => {}),
    }
    createTray(depsWithSysProxy(sysProxy))
    const item = findItem(lastTemplate(), 'System proxy')
    expect(item).toBeTruthy()
    expect(item?.type).toBe('checkbox')
    // Existing items still present.
    expect(findItem(lastTemplate(), 'Proxy mode')).toBeTruthy()
  })

  it('reflects isEnabled() === true as a checked box after rebuild', async () => {
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => true),
      enable: vi.fn(async () => {}),
      disable: vi.fn(async () => {}),
    }
    createTray(depsWithSysProxy(sysProxy))
    expect(sysProxy.isEnabled).toHaveBeenCalled()
    await vi.waitFor(() => {
      const item = findItem(lastTemplate(), 'System proxy')
      expect(item?.checked).toBe(true)
    })
  })

  it('calls enable() then rebuilds checked when toggled from off', async () => {
    let enabled = false
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => enabled),
      enable: vi.fn(async () => {
        enabled = true
      }),
      disable: vi.fn(async () => {
        enabled = false
      }),
    }
    createTray(depsWithSysProxy(sysProxy))

    const item = findItem(lastTemplate(), 'System proxy')
    expect(item?.click).toBeTypeOf('function')
    await (item!.click as (i: unknown) => unknown)({})

    expect(sysProxy.enable).toHaveBeenCalledTimes(1)
    expect(sysProxy.disable).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      const next = findItem(lastTemplate(), 'System proxy')
      expect(next?.checked).toBe(true)
    })
  })

  it('calls disable() then rebuilds unchecked when toggled from on', async () => {
    let enabled = true
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => enabled),
      enable: vi.fn(async () => {
        enabled = true
      }),
      disable: vi.fn(async () => {
        enabled = false
      }),
    }
    createTray(depsWithSysProxy(sysProxy))
    // Wait for the initial isEnabled() to settle so the cached value is "on".
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'System proxy')?.checked).toBe(true)
    })

    const item = findItem(lastTemplate(), 'System proxy')
    await (item!.click as (i: unknown) => unknown)({})

    expect(sysProxy.disable).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      const next = findItem(lastTemplate(), 'System proxy')
      expect(next?.checked).toBe(false)
    })
  })

  it('does not throw and keeps the menu when isEnabled() rejects', async () => {
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => {
        throw new Error('boom')
      }),
      enable: vi.fn(async () => {}),
      disable: vi.fn(async () => {}),
    }
    expect(() => createTray(depsWithSysProxy(sysProxy))).not.toThrow()
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'System proxy')).toBeTruthy()
      expect(findItem(lastTemplate(), 'Proxy mode')).toBeTruthy()
    })
  })
})

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}
