import type { AddressInfo } from 'node:net'
import type { KernelState, ProfileMeta } from './types'
import { Buffer } from 'node:buffer'
import { mkdtempSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { toNodeListener } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createControlRouter } from './http'

function fakeState(over: Partial<KernelState> = {}): KernelState {
  return {
    status: 'stopped',
    externalController: '127.0.0.1:9090',
    secret: 'sek',
    ...over,
  }
}

function makeSystemProxy(enabled = false) {
  return {
    isEnabled: vi.fn(async () => enabled),
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    describe: vi.fn(() => ({ port: 7890, bypass: ['localhost', '127.0.0.1'] })),
  }
}

function makeDeps(token?: string) {
  const state = fakeState()
  const supervisor = {
    getState: vi.fn(() => state),
    start: vi.fn(async () =>
      fakeState({ status: 'running', pid: 1, version: '1.19.27' }),
    ),
    stop: vi.fn(async () => fakeState({ status: 'stopped' })),
    restart: vi.fn(async () => fakeState({ status: 'running', pid: 2 })),
    validate: vi.fn(async () => ({ valid: true, message: 'ok' })),
    on: vi.fn(),
    dispose: vi.fn(),
  }
  const profileList: ProfileMeta[] = [
    { id: 'p1', name: 'home', type: 'local', updatedAt: 1 },
  ]
  const profiles = {
    list: vi.fn(async () => profileList),
    read: vi.fn(async () => 'mixed-port: 7890\n'),
    create: vi.fn(async (i: { name: string }) => ({
      id: 'p2',
      name: i.name,
      type: 'local' as const,
      updatedAt: 2,
    })),
    update: vi.fn(async () => ({
      id: 'p1',
      name: 'x',
      type: 'local' as const,
      updatedAt: 3,
    })),
    delete: vi.fn(async () => {}),
    duplicate: vi.fn(async () => ({
      id: 'p3',
      name: 'home copy',
      type: 'local' as const,
      updatedAt: 4,
    })),
    importFromUrl: vi.fn(async () => ({
      id: 'p4',
      name: 'sub',
      type: 'remote' as const,
      updatedAt: 5,
    })),
    refresh: vi.fn(async (id: string) => ({
      id,
      name: 'sub',
      type: 'remote' as const,
      url: 'https://sub',
      updatedAt: 6,
      subscriptionInfo: {
        upload: 1,
        download: 2,
        total: 3,
        expire: 4,
      },
    })),
    getActiveId: vi.fn(async (): Promise<string | undefined> => undefined),
    setActive: vi.fn(async () => {}),
    getSection: vi.fn(async (): Promise<unknown> => null),
    setSection: vi.fn(async () => {}),
  }
  const info = vi.fn(() => ({
    hasAgent: true,
    version: '0.0.0',
    platform: { os: 'linux', arch: 'x64' },
    kernel: { bundled: true, path: '/bin/mihomo', version: '1.19.27' },
    features: ['profiles', 'logs-sse', 'kernel-control'],
  }))
  const homeDir = mkdtempSync(join(tmpdir(), 'mcxd-http-'))
  return { supervisor, profiles, info, homeDir, token }
}

async function mount(deps: ReturnType<typeof makeDeps>) {
  const app = createControlRouter(deps as never)
  const server = createServer(toNodeListener(app))
  await new Promise<void>((r) => server.listen(0, r))
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}

describe('createControlRouter — info + kernel + auth', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/health is public 200', async () => {
    srv = await mount(makeDeps('tok'))
    const res = await fetch(`${srv.base}/api/control/health`)
    expect(res.status).toBe(200)
  })

  it('gET /api/control/info returns the capability shape', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/info`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.hasAgent).toBe(true)
    expect(body.features).toContain('kernel-control')
    expect(body.platform).toMatchObject({ os: 'linux', arch: 'x64' })
  })

  it('protected route returns 401 without Bearer when token set', async () => {
    srv = await mount(makeDeps('tok'))
    const res = await fetch(`${srv.base}/api/control/kernel/status`)
    expect(res.status).toBe(401)
  })

  it('protected route returns 200 with correct Bearer', async () => {
    srv = await mount(makeDeps('tok'))
    const res = await fetch(`${srv.base}/api/control/kernel/status`, {
      headers: { Authorization: 'Bearer tok' },
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Record<string, unknown>).status).toBe(
      'stopped',
    )
  })

  it('wrong Bearer returns 401', async () => {
    srv = await mount(makeDeps('tok'))
    const res = await fetch(`${srv.base}/api/control/kernel/status`, {
      headers: { Authorization: 'Bearer nope' },
    })
    expect(res.status).toBe(401)
  })

  it('no token configured (in-process) skips auth', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/kernel/status`)
    expect(res.status).toBe(200)
  })

  it('pOST kernel start/stop/restart return KernelState', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const start = await fetch(`${srv.base}/api/control/kernel/start`, {
      method: 'POST',
    })
    expect(((await start.json()) as Record<string, unknown>).status).toBe(
      'running',
    )
    expect(deps.supervisor.start).toHaveBeenCalledOnce()

    const stop = await fetch(`${srv.base}/api/control/kernel/stop`, {
      method: 'POST',
    })
    expect(((await stop.json()) as Record<string, unknown>).status).toBe(
      'stopped',
    )

    const restart = await fetch(`${srv.base}/api/control/kernel/restart`, {
      method: 'POST',
    })
    expect(((await restart.json()) as Record<string, unknown>).status).toBe(
      'running',
    )
  })
})

describe('createControlRouter — profiles + SSE', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/profiles returns ProfileMeta[]', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/profiles`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toMatchObject({ id: 'p1', name: 'home' })
  })

  it('pOST /api/control/profiles creates from {name, content?}', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'new', content: 'a: 1\n' }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.create).toHaveBeenCalledWith({
      name: 'new',
      content: 'a: 1\n',
    })
    expect(((await res.json()) as Record<string, unknown>).name).toBe('new')
  })

  it('pOST /api/control/profiles passes through type for merge profiles', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'overlay',
        content: 'a: 1\n',
        type: 'merge',
      }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.create).toHaveBeenCalledWith({
      name: 'overlay',
      content: 'a: 1\n',
      type: 'merge',
    })
  })

  it('pUT /api/control/profiles/:id passes through enabled', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.update).toHaveBeenCalledWith('p1', { enabled: false })
  })

  it('gET /api/control/profiles/:id returns { meta, content }', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/profiles/p1`)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.meta).toMatchObject({ id: 'p1' })
    expect(body.content).toBe('mixed-port: 7890\n')
  })

  it('pUT /api/control/profiles/:id updates', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'renamed' }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.update).toHaveBeenCalledWith('p1', { name: 'renamed' })
  })

  it('dELETE /api/control/profiles/:id returns 204', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)
    expect(deps.profiles.delete).toHaveBeenCalledWith('p1')
  })

  it('pOST /api/control/profiles/:id/duplicate returns ProfileMeta', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/profiles/p1/duplicate`, {
      method: 'POST',
    })
    expect(((await res.json()) as Record<string, unknown>).id).toBe('p3')
  })

  it('pOST /api/control/profiles/import imports from { url, name? }', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://sub', name: 'sub' }),
    })
    expect(((await res.json()) as Record<string, unknown>).type).toBe('remote')
    expect(deps.profiles.importFromUrl).toHaveBeenCalledWith(
      'https://sub',
      'sub',
    )
  })

  it('pOST /api/control/profiles/:id/refresh returns the updated meta', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1/refresh`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.refresh).toHaveBeenCalledWith('p1')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.id).toBe('p1')
    expect(body.type).toBe('remote')
    expect(body.updatedAt).toBe(6)
  })

  it('pOST /api/control/profiles/:id/activate sets active then returns KernelState', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1/activate`, {
      method: 'POST',
    })
    expect(deps.profiles.setActive).toHaveBeenCalledWith('p1')
    expect(deps.supervisor.restart).toHaveBeenCalledOnce()
    expect(((await res.json()) as Record<string, unknown>).status).toBe(
      'running',
    )
  })

  it('pOST /api/control/profiles/:id/validate materializes a temp candidate then returns { valid, message }', async () => {
    const deps = makeDeps()
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/profiles/p1/validate`, {
      method: 'POST',
    })
    const body = await res.json()
    expect(body).toEqual({ valid: true, message: 'ok' })
    // It reads the profile by id and validates a real candidate PATH, never the bare id.
    expect(deps.profiles.read).toHaveBeenCalledWith('p1')
    const validatedPath = (
      deps.supervisor.validate.mock.calls as unknown as [string][][]
    )[0]![0] as unknown as string
    expect(validatedPath).toBe(join(deps.homeDir, '.validate-p1.yaml'))
    expect(validatedPath).not.toBe('p1')
  })

  it('gET /api/control/kernel/logs streams text/event-stream and pushes a state event', async () => {
    const deps = makeDeps()
    // Capture the registered 'log' callback so we can drive a fake log line.
    let logCb:
      | ((l: { stream: string; line: string; ts: number }) => void)
      | undefined
    deps.supervisor.on = vi.fn((event: string, cb: never) => {
      if (event === 'log') logCb = cb as never
    }) as never
    srv = await mount(deps)

    const res = await fetch(`${srv.base}/api/control/kernel/logs`)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    // First chunk should be the seeded state event.
    const first = await reader.read()
    const seeded = dec.decode(first.value)
    expect(seeded).toContain('"type":"state"')

    // Drive a log line through the captured callback and read the next chunk.
    logCb?.({ stream: 'stdout', line: 'hello-from-kernel', ts: 1 })
    const next = await reader.read()
    expect(dec.decode(next.value)).toContain('hello-from-kernel')

    await reader.cancel()
  })
})

describe('createControlRouter — system proxy', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/sysproxy reflects isEnabled() + describe()', async () => {
    const deps = { ...makeDeps(), systemProxy: makeSystemProxy(true) }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/sysproxy`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      enabled: true,
      port: 7890,
      bypass: ['localhost', '127.0.0.1'],
    })
    expect(deps.systemProxy.isEnabled).toHaveBeenCalledOnce()
    expect(deps.systemProxy.describe).toHaveBeenCalled()
  })

  it('pOST /api/control/sysproxy {enabled:true, bypass} calls enable(bypass)', async () => {
    const deps = { ...makeDeps(), systemProxy: makeSystemProxy(false) }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/sysproxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, bypass: ['example.com'] }),
    })
    expect(res.status).toBe(200)
    expect(deps.systemProxy.enable).toHaveBeenCalledWith(['example.com'])
    expect(deps.systemProxy.disable).not.toHaveBeenCalled()
    // Response mirrors the GET shape (enabled + describe()).
    expect(await res.json()).toEqual({
      enabled: false,
      port: 7890,
      bypass: ['localhost', '127.0.0.1'],
    })
  })

  it('pOST /api/control/sysproxy {enabled:false} calls disable()', async () => {
    const deps = { ...makeDeps(), systemProxy: makeSystemProxy(true) }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/sysproxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.status).toBe(200)
    expect(deps.systemProxy.disable).toHaveBeenCalledOnce()
    expect(deps.systemProxy.enable).not.toHaveBeenCalled()
  })

  it('gET /api/control/sysproxy is 404 JSON when no controller is injected', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/sysproxy`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'system-proxy unavailable' })
  })

  it('pOST /api/control/sysproxy is 404 JSON when no controller is injected', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/sysproxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'system-proxy unavailable' })
  })
})

function makeKernelManager() {
  return {
    listVersions: vi.fn(async () => ({
      versions: ['v1.19.27', 'v1.19.0'],
      current: 'v1.19.27',
      bundled: 'v1.19.27',
    })),
    switch: vi.fn(async () => {}),
  }
}

describe('createControlRouter — geo assets', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('pOST /api/control/geo/update downloads the 3 files into homeDir and returns { ok, files }', async () => {
    const requested: string[] = []
    const geoFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(Buffer.from(`bytes:${url}`), { status: 200 })
    })
    const deps = {
      ...makeDeps(),
      geoFetch: geoFetch as unknown as typeof fetch,
    }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/geo/update`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ok: true,
      files: ['geoip.dat', 'geosite.dat', 'country.mmdb'],
    })
    // It fetched three assets and wrote them under homeDir.
    expect(requested).toHaveLength(3)
    const written = readdirSync(deps.homeDir)
    expect(written).toEqual(
      expect.arrayContaining(['geoip.dat', 'geosite.dat', 'country.mmdb']),
    )
  })
})

describe('createControlRouter — kernel version management', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/kernel/versions returns listVersions()', async () => {
    const deps = { ...makeDeps(), kernelManager: makeKernelManager() }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/kernel/versions`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      versions: ['v1.19.27', 'v1.19.0'],
      current: 'v1.19.27',
      bundled: 'v1.19.27',
    })
    expect(deps.kernelManager.listVersions).toHaveBeenCalledOnce()
  })

  it('pOST /api/control/kernel/switch { version } calls switch then returns { ok: true }', async () => {
    const deps = { ...makeDeps(), kernelManager: makeKernelManager() }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/kernel/switch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 'v1.19.0' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(deps.kernelManager.switch).toHaveBeenCalledWith('v1.19.0')
  })

  it('gET /api/control/kernel/versions is 404 JSON when no kernelManager is injected', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/kernel/versions`)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'kernel-version unavailable' })
  })

  it('pOST /api/control/kernel/switch is 404 JSON when no kernelManager is injected', async () => {
    srv = await mount(makeDeps())
    const res = await fetch(`${srv.base}/api/control/kernel/switch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 'v1.19.0' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'kernel-version unavailable' })
  })
})

describe('createControlRouter — WebDAV backup/restore', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  function makeWebdav() {
    const calls: { put: [string, string][]; get: string[]; mkcol: string[] } = {
      put: [],
      get: [],
      mkcol: [],
    }
    let stored = ''
    const client = {
      put: vi.fn(async (path: string, body: string) => {
        calls.put.push([path, body])
        stored = body
      }),
      get: vi.fn(async (path: string) => {
        calls.get.push(path)
        return stored
      }),
      mkcol: vi.fn(async (dir: string) => {
        calls.mkcol.push(dir)
      }),
    }
    const opts: unknown[] = []
    const createWebdavClient = vi.fn((o: unknown) => {
      opts.push(o)
      return client
    })
    return { client, calls, opts, createWebdavClient }
  }

  it('pOST /backup builds a bundle of all profiles and uploads it via webdav', async () => {
    const dav = makeWebdav()
    const deps = {
      ...makeDeps(),
      createWebdavClient: dav.createWebdavClient,
    }
    srv = await mount(deps as never)

    const res = await fetch(`${srv.base}/api/control/backup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webdav: {
          url: 'https://dav/',
          username: 'u',
          password: 'p',
          dir: 'mcxd',
        },
        uiSettings: { theme: 'dark' },
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.path).toBe('mcxd/metacubexd-backup.json')

    // Client constructed with the request credentials.
    expect(dav.opts[0]).toMatchObject({
      url: 'https://dav/',
      username: 'u',
      password: 'p',
    })
    // mkcol best-effort on the dir, then put the bundle.
    expect(dav.calls.mkcol).toEqual(['mcxd'])
    expect(dav.calls.put).toHaveLength(1)
    const [putPath, putBody] = dav.calls.put[0]!
    expect(putPath).toBe('mcxd/metacubexd-backup.json')
    const bundle = JSON.parse(putBody) as Record<string, unknown>
    expect(bundle.version).toBe(1)
    expect(bundle.uiSettings).toEqual({ theme: 'dark' })
    expect(bundle.profiles).toEqual([
      {
        meta: { id: 'p1', name: 'home', type: 'local', updatedAt: 1 },
        content: 'mixed-port: 7890\n',
      },
    ])
  })

  it('pOST /backup tolerates a failing mkcol (best-effort) and still uploads', async () => {
    const dav = makeWebdav()
    dav.client.mkcol = vi.fn(async () => {
      throw new Error('mkcol boom')
    })
    const deps = {
      ...makeDeps(),
      createWebdavClient: dav.createWebdavClient,
    }
    srv = await mount(deps as never)

    const res = await fetch(`${srv.base}/api/control/backup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webdav: { url: 'https://dav/', username: 'u', password: 'p' },
      }),
    })
    expect(res.status).toBe(200)
    expect(dav.calls.put).toHaveLength(1)
    // No dir provided -> bundle lands at the root.
    expect(dav.calls.put[0]![0]).toBe('metacubexd-backup.json')
  })

  it('pOST /restore re-creates profiles from the bundle and returns uiSettings', async () => {
    const dav = makeWebdav()
    const bundle = {
      version: 1,
      profiles: [
        {
          meta: { id: 'x1', name: 'restored', type: 'local', updatedAt: 9 },
          content: 'port: 1234\n',
        },
        {
          meta: {
            id: 'x2',
            name: 'sub',
            type: 'remote',
            url: 'https://s',
            updatedAt: 10,
          },
          content: 'proxies: []\n',
        },
      ],
      uiSettings: { lang: 'zh' },
    }
    dav.client.get = vi.fn(async () => JSON.stringify(bundle))

    const deps = {
      ...makeDeps(),
      createWebdavClient: dav.createWebdavClient,
    }
    srv = await mount(deps as never)

    const res = await fetch(`${srv.base}/api/control/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webdav: {
          url: 'https://dav/',
          username: 'u',
          password: 'p',
          dir: 'mcxd',
        },
      }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(body.restored).toBe(2)
    expect(body.uiSettings).toEqual({ lang: 'zh' })

    // Downloads the bundle from the same path the backup writes.
    expect(dav.client.get).toHaveBeenCalledWith('mcxd/metacubexd-backup.json')
    // Recreates via profiles.create (new ids — avoids clashes), passing name/content/type.
    expect(deps.profiles.create).toHaveBeenCalledTimes(2)
    expect(deps.profiles.create).toHaveBeenCalledWith({
      name: 'restored',
      content: 'port: 1234\n',
      type: 'local',
    })
  })

  it('pOST /backup surfaces a webdav put failure (no silent swallow)', async () => {
    const dav = makeWebdav()
    dav.client.put = vi.fn(async () => {
      throw new Error('webdav PUT failed 403')
    })
    const deps = {
      ...makeDeps(),
      createWebdavClient: dav.createWebdavClient,
    }
    srv = await mount(deps as never)

    const res = await fetch(`${srv.base}/api/control/backup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webdav: { url: 'https://dav/', username: 'u', password: 'p' },
      }),
    })
    expect(res.status).toBeGreaterThanOrEqual(500)
  })
})

describe('createControlRouter — runtime config viewer', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/config/runtime returns the activeConfigPath file as text/yaml', async () => {
    const runtimeYaml =
      'mixed-port: 7890\nexternal-controller: 127.0.0.1:9090\nsecret: sek\n'
    const readFile = vi.fn(async () => runtimeYaml)
    const deps = {
      ...makeDeps(),
      activeConfigPath: '/home/active.yaml',
      readFile:
        readFile as unknown as typeof import('node:fs/promises').readFile,
    }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/config/runtime`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/yaml')
    expect(await res.text()).toBe(runtimeYaml)
    // Reads the actual activeConfigPath file (not the active profile source).
    expect(readFile).toHaveBeenCalledWith('/home/active.yaml', 'utf8')
  })

  it('gET /api/control/config/runtime returns empty string when the file does not exist', async () => {
    const readFile = vi.fn(async () => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const deps = {
      ...makeDeps(),
      activeConfigPath: '/home/missing.yaml',
      readFile:
        readFile as unknown as typeof import('node:fs/promises').readFile,
    }
    srv = await mount(deps as never)
    const res = await fetch(`${srv.base}/api/control/config/runtime`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
  })

  it('gET /api/control/config (active profile source) still works alongside runtime', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => 'p1')
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('mixed-port: 7890\n')
  })
})

describe('createControlRouter — config sections', () => {
  let srv: Awaited<ReturnType<typeof mount>>
  afterEach(async () => srv?.close())

  it('gET /api/control/config/section?key= returns the active profile section', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => 'p1')
    deps.profiles.getSection = vi.fn(async () => ['MATCH,DIRECT'])
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config/section?key=rules`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(['MATCH,DIRECT'])
    expect(deps.profiles.getSection).toHaveBeenCalledWith('p1', 'rules')
  })

  it('gET /api/control/config/section returns null when there is no active profile', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => undefined)
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config/section?key=rules`)
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
    expect(deps.profiles.getSection).not.toHaveBeenCalled()
  })

  it('pUT /api/control/config/section sets the section then re-activates + restarts', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => 'p1')
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config/section`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'rules', value: ['MATCH,REJECT'] }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.setSection).toHaveBeenCalledWith('p1', 'rules', [
      'MATCH,REJECT',
    ])
    expect(deps.profiles.setActive).toHaveBeenCalledWith('p1')
    expect(deps.supervisor.restart).toHaveBeenCalledOnce()
    expect(((await res.json()) as Record<string, unknown>).status).toBe(
      'running',
    )
  })

  it('pUT /api/control/config/section passes a null value through (delete)', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => 'p1')
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config/section`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'dns', value: null }),
    })
    expect(res.status).toBe(200)
    expect(deps.profiles.setSection).toHaveBeenCalledWith('p1', 'dns', null)
    expect(deps.profiles.setActive).toHaveBeenCalledWith('p1')
  })

  it('pUT /api/control/config/section returns 409 when there is no active profile', async () => {
    const deps = makeDeps()
    deps.profiles.getActiveId = vi.fn(async () => undefined)
    srv = await mount(deps)
    const res = await fetch(`${srv.base}/api/control/config/section`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: 'rules', value: [] }),
    })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'no active profile' })
    expect(deps.profiles.setSection).not.toHaveBeenCalled()
    expect(deps.supervisor.restart).not.toHaveBeenCalled()
  })
})
