import type { MenuItemConstructorOptions } from 'electron'
import type { TrayDeps } from '../tray'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTray } from '../tray'

// --- electron mock -----------------------------------------------------------
// Capture every menu template buildFromTemplate receives so we can inspect /
// click items, and every Tray instance so tooltips are assertable. The real
// electron module only fully works inside the Electron runtime, so we stub the
// pieces tray.ts touches.
const builtTemplates: MenuItemConstructorOptions[][] = []
const trayInstances: Array<{ tooltips: string[] }> = []

vi.mock('electron', () => {
  return {
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
      tooltips: string[] = []
      setToolTip = vi.fn((tip: string) => {
        this.tooltips.push(tip)
      })

      setContextMenu = vi.fn()
      on = vi.fn()
      destroy = vi.fn()
      constructor() {
        trayInstances.push(this)
      }
    },
  }
})

const CLASH = { url: 'http://127.0.0.1:9090', secret: 's3cr3t' }

function fakeLoginItem(initial = false): TrayDeps['loginItem'] & {
  setEnabled: ReturnType<typeof vi.fn>
} {
  let enabled = initial
  return {
    isEnabled: () => enabled,
    setEnabled: vi.fn((v: boolean) => {
      enabled = v
    }),
  }
}

function baseDeps(fetchImpl: typeof fetch): TrayDeps {
  return {
    showWindow: vi.fn(),
    startKernel: vi.fn(),
    stopKernel: vi.fn(),
    restartKernel: vi.fn(),
    quit: vi.fn(),
    iconPath: '/x/tray.png',
    clash: CLASH,
    loginItem: fakeLoginItem(),
    fetchImpl,
  }
}

const okFetch = () =>
  vi.fn(async () => jsonResponse({ mode: 'rule' })) as unknown as typeof fetch

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

/** Locate the Proxy Mode submenu's radio items. */
function proxyModeItems(): MenuItemConstructorOptions[] {
  const submenu = findItem(lastTemplate(), 'Proxy Mode')?.submenu
  if (!Array.isArray(submenu)) throw new Error('Proxy Mode submenu missing')
  return submenu
}

beforeEach(() => {
  builtTemplates.length = 0
  trayInstances.length = 0
})

describe('createTray menu items', () => {
  it('keeps the core menu items', async () => {
    createTray(baseDeps(okFetch()))
    const t = lastTemplate()
    expect(findItem(t, 'Open Dashboard')).toBeTruthy()
    expect(findItem(t, 'Start Kernel')).toBeTruthy()
    expect(findItem(t, 'Stop Kernel')).toBeTruthy()
    expect(findItem(t, 'Restart Kernel')).toBeTruthy()
    expect(findItem(t, 'Open at Login')).toBeTruthy()
    expect(findItem(t, 'Quit')).toBeTruthy()
    expect(findItem(t, 'Proxy Mode')).toBeTruthy()
  })

  it('wires Open Dashboard + kernel actions to the injected deps', () => {
    const deps = baseDeps(okFetch())
    createTray(deps)
    ;(findItem(lastTemplate(), 'Open Dashboard')!.click as () => void)()
    ;(findItem(lastTemplate(), 'Start Kernel')!.click as () => void)()
    ;(findItem(lastTemplate(), 'Stop Kernel')!.click as () => void)()
    ;(findItem(lastTemplate(), 'Restart Kernel')!.click as () => void)()
    ;(findItem(lastTemplate(), 'Quit')!.click as () => void)()
    expect(deps.showWindow).toHaveBeenCalledTimes(1)
    expect(deps.startKernel).toHaveBeenCalledTimes(1)
    expect(deps.stopKernel).toHaveBeenCalledTimes(1)
    expect(deps.restartKernel).toHaveBeenCalledTimes(1)
    expect(deps.quit).toHaveBeenCalledTimes(1)
  })

  it('delegates Open at Login to the injected login-item controller', () => {
    const loginItem = fakeLoginItem()
    createTray({ ...baseDeps(okFetch()), loginItem })

    const item = findItem(lastTemplate(), 'Open at Login')
    expect(item?.type).toBe('checkbox')
    expect(item?.checked).toBe(false)
    // electron passes the toggled MenuItem; simulate checking the box.
    ;(item!.click as (i: unknown) => unknown)({ checked: true })

    expect(loginItem.setEnabled).toHaveBeenCalledWith(true)
    // The rebuilt menu reflects the new state.
    expect(findItem(lastTemplate(), 'Open at Login')?.checked).toBe(true)
  })
})

describe('createTray kernel status line', () => {
  it('renders a disabled status line with version when getKernelState is given', () => {
    createTray({
      ...baseDeps(okFetch()),
      getKernelState: () => ({ status: 'running', version: 'v1.19.2' }),
    })
    const line = findItem(lastTemplate(), 'Kernel: running · v1.19.2')
    expect(line).toBeTruthy()
    expect(line?.enabled).toBe(false)
  })

  it('omits the status line without getKernelState', () => {
    createTray(baseDeps(okFetch()))
    const hasLine = lastTemplate().some((i) =>
      String(i.label ?? '').startsWith('Kernel:'),
    )
    expect(hasLine).toBe(false)
  })

  it('disables Start while running and Stop/Restart while stopped', () => {
    createTray({
      ...baseDeps(okFetch()),
      getKernelState: () => ({ status: 'running' }),
    })
    expect(findItem(lastTemplate(), 'Start Kernel')?.enabled).toBe(false)
    expect(findItem(lastTemplate(), 'Stop Kernel')?.enabled).toBe(true)
    expect(findItem(lastTemplate(), 'Restart Kernel')?.enabled).toBe(true)

    builtTemplates.length = 0
    createTray({
      ...baseDeps(okFetch()),
      getKernelState: () => ({ status: 'stopped' }),
    })
    expect(findItem(lastTemplate(), 'Start Kernel')?.enabled).toBe(true)
    expect(findItem(lastTemplate(), 'Stop Kernel')?.enabled).toBe(false)
    expect(findItem(lastTemplate(), 'Restart Kernel')?.enabled).toBe(false)
  })

  it('keeps every action enabled when the state is unknown', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'Start Kernel')?.enabled).toBe(true)
    expect(findItem(lastTemplate(), 'Stop Kernel')?.enabled).toBe(true)
    expect(findItem(lastTemplate(), 'Restart Kernel')?.enabled).toBe(true)
  })

  it('rebuilds on kernel-state events (fresh status line)', () => {
    let state = { status: 'stopped' }
    let fire: (() => void) | null = null
    createTray({
      ...baseDeps(okFetch()),
      getKernelState: () => state,
      onKernelState: (cb) => {
        fire = cb
      },
    })
    expect(findItem(lastTemplate(), 'Kernel: stopped')).toBeTruthy()
    state = { status: 'running' }
    fire!()
    expect(findItem(lastTemplate(), 'Kernel: running')).toBeTruthy()
  })

  it('reflects the health summary in the tooltip', () => {
    createTray({
      ...baseDeps(okFetch()),
      getKernelState: () => ({ status: 'running' }),
      systemProxy: {
        isEnabled: vi.fn(async () => false),
        enable: vi.fn(async () => {}),
        disable: vi.fn(async () => {}),
      },
    })
    const tooltips = trayInstances[0]!.tooltips
    expect(tooltips.at(-1)).toBe(
      'MetaCubeXD — kernel running · system proxy off',
    )
  })
})

describe('createTray proxy-mode submenu', () => {
  it('renders three radio mode items (Rule/Global/Direct)', () => {
    createTray(baseDeps(okFetch()))
    const labels = proxyModeItems().map((i) => i.label)
    expect(labels).toEqual(['Rule', 'Global', 'Direct'])
    expect(proxyModeItems().every((i) => i.type === 'radio')).toBe(true)
  })

  it('pATCHes /configs with the mode + bearer auth when an item is clicked', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ mode: 'rule' }))
    const onBackendInvalidate = vi.fn()
    createTray({
      ...baseDeps(fetchImpl as unknown as typeof fetch),
      onBackendInvalidate,
    })
    fetchImpl.mockClear()

    const global = proxyModeItems().find((i) => i.label === 'Global')
    expect(global?.click).toBeTypeOf('function')
    // electron passes the MenuItem as first arg; click ignores it here.
    // click itself is sync (`void switchMode(...)`); wait for the PATCH + notify.
    await (global!.click as (i: unknown) => unknown)({})
    await vi.waitFor(() => {
      expect(onBackendInvalidate).toHaveBeenCalledTimes(1)
    })

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
    expect(onBackendInvalidate).toHaveBeenCalledTimes(1)
  })

  it('does not notify the UI when the mode PATCH fails', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }))
    const onBackendInvalidate = vi.fn()
    createTray({
      ...baseDeps(fetchImpl as unknown as typeof fetch),
      onBackendInvalidate,
    })
    fetchImpl.mockClear()
    onBackendInvalidate.mockClear()

    const global = proxyModeItems().find((i) => i.label === 'Global')
    await (global!.click as (i: unknown) => unknown)({})
    await vi.waitFor(() => {
      expect(fetchImpl).toHaveBeenCalled()
    })
    expect(onBackendInvalidate).not.toHaveBeenCalled()
  })

  it('marks the current mode (from GET /configs) as checked after rebuild', async () => {
    let resolveFetch: (r: Response) => void = () => {}
    // URL-aware: only the /configs GET uses the controllable deferred; the
    // /proxies GET (background group refresh) resolves immediately so it can't
    // race the single resolver.
    const fetchImpl = vi.fn((url: string) => {
      if (String(url).endsWith('/proxies')) {
        return Promise.resolve(jsonResponse({ proxies: {} }))
      }
      return new Promise<Response>((res) => {
        resolveFetch = res
      })
    }) as unknown as typeof fetch

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
      expect(findItem(lastTemplate(), 'Proxy Mode')).toBeTruthy()
    })
  })
})

type FakeSystemProxy = NonNullable<TrayDeps['systemProxy']>

describe('createTray system-proxy checkbox', () => {
  function depsWithSysProxy(sysProxy: FakeSystemProxy): TrayDeps {
    return { ...baseDeps(okFetch()), systemProxy: sysProxy }
  }

  it('omits the System Proxy item when no controller is injected', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'System Proxy')).toBeUndefined()
    // Core items remain intact.
    expect(findItem(lastTemplate(), 'Proxy Mode')).toBeTruthy()
    expect(findItem(lastTemplate(), 'Quit')).toBeTruthy()
  })

  it('renders a checkbox System Proxy item when a controller is injected', () => {
    const sysProxy: FakeSystemProxy = {
      isEnabled: vi.fn(async () => false),
      enable: vi.fn(async () => {}),
      disable: vi.fn(async () => {}),
    }
    createTray(depsWithSysProxy(sysProxy))
    const item = findItem(lastTemplate(), 'System Proxy')
    expect(item).toBeTruthy()
    expect(item?.type).toBe('checkbox')
    // Existing items still present.
    expect(findItem(lastTemplate(), 'Proxy Mode')).toBeTruthy()
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
      const item = findItem(lastTemplate(), 'System Proxy')
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

    const item = findItem(lastTemplate(), 'System Proxy')
    expect(item?.click).toBeTypeOf('function')
    await (item!.click as (i: unknown) => unknown)({})

    expect(sysProxy.enable).toHaveBeenCalledTimes(1)
    expect(sysProxy.disable).not.toHaveBeenCalled()
    await vi.waitFor(() => {
      const next = findItem(lastTemplate(), 'System Proxy')
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
      expect(findItem(lastTemplate(), 'System Proxy')?.checked).toBe(true)
    })

    const item = findItem(lastTemplate(), 'System Proxy')
    await (item!.click as (i: unknown) => unknown)({})

    expect(sysProxy.disable).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      const next = findItem(lastTemplate(), 'System Proxy')
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
      expect(findItem(lastTemplate(), 'System Proxy')).toBeTruthy()
      expect(findItem(lastTemplate(), 'Proxy Mode')).toBeTruthy()
    })
  })
})

type FakeTun = NonNullable<TrayDeps['tun']>

describe('createTray TUN checkbox', () => {
  it('omits the TUN Mode item when no controller is injected', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'TUN Mode')).toBeUndefined()
  })

  it('reflects status().enabled as the checkbox state', async () => {
    const tun: FakeTun = {
      status: vi.fn(async () => ({ enabled: true })),
      enable: vi.fn(async () => {}),
      disable: vi.fn(async () => {}),
    }
    createTray({ ...baseDeps(okFetch()), tun })
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'TUN Mode')?.checked).toBe(true)
    })
  })

  it('calls enable() when toggled from off, disable() when toggled from on', async () => {
    let enabled = false
    const tun: FakeTun = {
      status: vi.fn(async () => ({ enabled })),
      enable: vi.fn(async () => {
        enabled = true
      }),
      disable: vi.fn(async () => {
        enabled = false
      }),
    }
    createTray({ ...baseDeps(okFetch()), tun })

    await (
      findItem(lastTemplate(), 'TUN Mode')!.click as (i: unknown) => unknown
    )({})
    expect(tun.enable).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'TUN Mode')?.checked).toBe(true)
    })

    await (
      findItem(lastTemplate(), 'TUN Mode')!.click as (i: unknown) => unknown
    )({})
    expect(tun.disable).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'TUN Mode')?.checked).toBe(false)
    })
  })

  it('re-syncs with reality when enable() rejects (checkbox stays off)', async () => {
    const tun: FakeTun = {
      status: vi.fn(async () => ({ enabled: false })),
      enable: vi.fn(async () => {
        throw new Error('helper install declined')
      }),
      disable: vi.fn(async () => {}),
    }
    createTray({ ...baseDeps(okFetch()), tun })

    await (
      findItem(lastTemplate(), 'TUN Mode')!.click as (i: unknown) => unknown
    )({})
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'TUN Mode')?.checked).toBe(false)
    })
  })
})

type FakeProfiles = NonNullable<TrayDeps['profiles']>

describe('createTray profiles submenu', () => {
  function profilesOf(
    list: { id: string; name: string }[],
    active: string | undefined,
  ): FakeProfiles & { activate: ReturnType<typeof vi.fn> } {
    return {
      list: vi.fn(async () => list),
      activeId: vi.fn(async () => active),
      activate: vi.fn(async () => {}),
    }
  }

  function profileItems(): MenuItemConstructorOptions[] {
    const submenu = findItem(lastTemplate(), 'Profiles')?.submenu
    if (!Array.isArray(submenu)) throw new Error('Profiles submenu missing')
    return submenu
  }

  it('omits the submenu when no store is injected', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'Profiles')).toBeUndefined()
  })

  it('omits the submenu while the store has no profiles', async () => {
    const profiles = profilesOf([], undefined)
    createTray({ ...baseDeps(okFetch()), profiles })
    await vi.waitFor(() => expect(profiles.list).toHaveBeenCalled())
    expect(findItem(lastTemplate(), 'Profiles')).toBeUndefined()
  })

  it('renders radio items marking the active profile', async () => {
    const profiles = profilesOf(
      [
        { id: 'a', name: 'Home' },
        { id: 'b', name: 'Work' },
      ],
      'b',
    )
    createTray({ ...baseDeps(okFetch()), profiles })
    await vi.waitFor(() => {
      const items = profileItems()
      expect(items.map((i) => i.label)).toEqual(['Home', 'Work'])
      expect(items.every((i) => i.type === 'radio')).toBe(true)
      expect(items.find((i) => i.label === 'Work')?.checked).toBe(true)
      expect(items.find((i) => i.label === 'Home')?.checked).toBe(false)
    })
  })

  it('activates the clicked profile and re-marks the selection', async () => {
    const profiles = profilesOf(
      [
        { id: 'a', name: 'Home' },
        { id: 'b', name: 'Work' },
      ],
      'a',
    )
    createTray({ ...baseDeps(okFetch()), profiles })
    await vi.waitFor(() => expect(profileItems().length).toBe(2))

    const work = profileItems().find((i) => i.label === 'Work')
    await (work!.click as (i: unknown) => unknown)({})

    expect(profiles.activate).toHaveBeenCalledWith('b')
    await vi.waitFor(() => {
      expect(profileItems().find((i) => i.label === 'Work')?.checked).toBe(true)
    })
  })

  it('clicking the already-active profile is a no-op', async () => {
    const profiles = profilesOf([{ id: 'a', name: 'Home' }], 'a')
    createTray({ ...baseDeps(okFetch()), profiles })
    await vi.waitFor(() => expect(profileItems().length).toBe(1))

    await (profileItems()[0]!.click as (i: unknown) => unknown)({})
    expect(profiles.activate).not.toHaveBeenCalled()
  })

  it('keeps the previous selection when activate() rejects', async () => {
    const active = 'a'
    const profiles: FakeProfiles = {
      list: vi.fn(async () => [
        { id: 'a', name: 'Home' },
        { id: 'b', name: 'Work' },
      ]),
      activeId: vi.fn(async () => active),
      activate: vi.fn(async () => {
        throw new Error('validation failed')
      }),
    }
    createTray({ ...baseDeps(okFetch()), profiles })
    await vi.waitFor(() => expect(profileItems().length).toBe(2))

    const work = profileItems().find((i) => i.label === 'Work')
    await (work!.click as (i: unknown) => unknown)({})

    // The rebuild + background refresh re-syncs against the store (still 'a').
    await vi.waitFor(() => {
      expect(profileItems().find((i) => i.label === 'Home')?.checked).toBe(true)
      expect(profileItems().find((i) => i.label === 'Work')?.checked).toBe(
        false,
      )
    })
    void active
  })
})

describe('createTray copy proxy command', () => {
  it('omits the item when no copyProxyCommand is injected', () => {
    createTray(baseDeps(okFetch()))
    expect(findItem(lastTemplate(), 'Copy Proxy Command')).toBeUndefined()
  })

  it('invokes the injected copyProxyCommand on click', () => {
    const copyProxyCommand = vi.fn()
    createTray({ ...baseDeps(okFetch()), copyProxyCommand })
    const item = findItem(lastTemplate(), 'Copy Proxy Command')
    expect(item?.click).toBeTypeOf('function')
    ;(item!.click as () => void)()
    expect(copyProxyCommand).toHaveBeenCalledTimes(1)
  })
})

/** A URL-aware fetch: /configs -> mode, /proxies -> the given groups map. */
function proxiesFetch(proxies: Record<string, unknown>): typeof fetch {
  return vi.fn(async (url: string) => {
    if (String(url).endsWith('/proxies')) return jsonResponse({ proxies })
    return jsonResponse({ mode: 'rule' })
  }) as unknown as typeof fetch
}

describe('createTray proxy-groups submenu', () => {
  const GROUPS = {
    GLOBAL: { type: 'Selector', now: 'Auto', all: ['Auto'] },
    Auto: { type: 'Selector', now: 'HK', all: ['HK', 'JP'] },
  }

  it('omits the submenu when the kernel reports no selectable groups', async () => {
    createTray(baseDeps(okFetch()))
    // Let the background refreshGroups() settle (okFetch has no `proxies`).
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'Proxy Mode')).toBeTruthy()
    })
    expect(findItem(lastTemplate(), 'Proxy Groups')).toBeUndefined()
  })

  it('renders a per-group submenu with the selected node checked', async () => {
    createTray({ ...baseDeps(okFetch()), fetchImpl: proxiesFetch(GROUPS) })
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'Proxy Groups')).toBeTruthy()
    })
    const groups = findItem(lastTemplate(), 'Proxy Groups')?.submenu
    if (!Array.isArray(groups)) throw new Error('Proxy Groups submenu missing')
    const auto = groups.find((g) => g.label === 'Auto')
    const nodes = auto?.submenu
    if (!Array.isArray(nodes)) throw new Error('Auto submenu missing')
    expect(nodes.map((n) => n.label)).toEqual(['HK', 'JP'])
    expect(nodes.find((n) => n.label === 'HK')?.checked).toBe(true)
    expect(nodes.find((n) => n.label === 'JP')?.checked).toBe(false)
  })

  it('sends a PUT for the selected node and invalidates the panel on click', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('/proxies'))
        return jsonResponse({ proxies: GROUPS })
      return jsonResponse({ mode: 'rule' })
    }) as unknown as typeof fetch
    const onBackendInvalidate = vi.fn()
    createTray({ ...baseDeps(okFetch()), fetchImpl, onBackendInvalidate })
    await vi.waitFor(() => {
      expect(findItem(lastTemplate(), 'Proxy Groups')).toBeTruthy()
    })
    const groups = findItem(lastTemplate(), 'Proxy Groups')!
      .submenu as MenuItemConstructorOptions[]
    const jp = (
      groups.find((g) => g.label === 'Auto')!
        .submenu as MenuItemConstructorOptions[]
    ).find((n) => n.label === 'JP')
    await (jp!.click as (i: unknown) => unknown)({})
    await vi.waitFor(() => {
      expect(onBackendInvalidate).toHaveBeenCalled()
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:9090/proxies/Auto',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'JP' }),
      }),
    )
  })
})

describe('createTray speed line', () => {
  it('appends the injected speed line to the tooltip', () => {
    createTray({ ...baseDeps(okFetch()), getSpeedLine: () => '↑ 1.0K ↓ 2.0M' })
    const tip = trayInstances.at(-1)?.tooltips.at(-1)
    expect(tip).toContain('↑ 1.0K ↓ 2.0M')
  })

  it('omits the speed segment when the getter returns null', () => {
    createTray({ ...baseDeps(okFetch()), getSpeedLine: () => null })
    const tip = trayInstances.at(-1)?.tooltips.at(-1)
    expect(tip).toBe('MetaCubeXD')
  })
})

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}
