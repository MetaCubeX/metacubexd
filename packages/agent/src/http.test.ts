import type { AddressInfo } from 'node:net'
import type { KernelState, ProfileMeta } from './types'
import { mkdtempSync } from 'node:fs'
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
    getActiveId: vi.fn(async () => undefined),
    setActive: vi.fn(async () => {}),
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
    const body = await res.json()
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
    expect((await res.json()).status).toBe('stopped')
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
    expect((await start.json()).status).toBe('running')
    expect(deps.supervisor.start).toHaveBeenCalledOnce()

    const stop = await fetch(`${srv.base}/api/control/kernel/stop`, {
      method: 'POST',
    })
    expect((await stop.json()).status).toBe('stopped')

    const restart = await fetch(`${srv.base}/api/control/kernel/restart`, {
      method: 'POST',
    })
    expect((await restart.json()).status).toBe('running')
  })
})
