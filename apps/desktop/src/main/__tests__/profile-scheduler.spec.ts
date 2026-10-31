import type { MihomoSupervisor } from '@metacubexd/agent/types'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProfileStore } from '@metacubexd/agent'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parse, stringify } from 'yaml'
import { createDesktopProfileScheduler } from '../profile-scheduler'
import { createTunConfigWriter } from '../tun-config'
import { createTunController } from '../tun-controller'

const directories: string[] = []
afterEach(async () => {
  for (const dir of directories.splice(0))
    await rm(dir, { recursive: true, force: true })
})

async function fixture() {
  const homeDir = await mkdtemp(join(tmpdir(), 'mcxd-desktop-refresh-'))
  directories.push(homeDir)
  const activeConfigPath = join(homeDir, 'config.yaml')
  let subscription = 'mode: rule\n'
  const profiles = createProfileStore({
    dir: join(homeDir, 'profiles'),
    activeConfigPath,
    fetch: vi.fn(async () => new Response(subscription)) as typeof fetch,
  })
  const profile = await profiles.importFromUrl(
    'https://subscription.invalid/config',
  )
  await profiles.update(profile.id, { updateInterval: 1 })
  await profiles.setActive(profile.id)
  let sidecar = true
  let privileged = false
  let failPrivileged = false
  let stopGate: Promise<void> | undefined
  const stopReached = vi.fn()
  const state = {
    status: 'running' as const,
    externalController: '127.0.0.1:9090',
    secret: 'managed-secret',
  }
  const supervisor = {
    getState: () => state,
    validate: vi.fn(async (path: string) => ({
      valid: !(await readFile(path, 'utf8')).includes('bad'),
      message: 'invalid refreshed config',
    })),
    restart: vi.fn(async () => {
      expect(privileged).toBe(false)
      return state
    }),
  } as unknown as MihomoSupervisor
  const writeSection = createTunConfigWriter({ profiles, activeConfigPath })
  const controller = createTunController({
    injectTun: (value) => writeSection('tun', value),
    removeTun: () => writeSection('tun', null),
    stopKernel: async () => {
      stopReached()
      await stopGate
      privileged = false
      sidecar = false
    },
    startSidecar: async () => {
      expect(privileged).toBe(false)
      sidecar = true
      const current = parse(await readFile(activeConfigPath, 'utf8'))
      await writeFile(
        activeConfigPath,
        stringify({
          ...current,
          'external-controller': state.externalController,
          secret: state.secret,
        }),
      )
    },
    startPrivileged: async () => {
      expect(sidecar).toBe(false)
      if (failPrivileged) throw new Error('privileged start failed')
      privileged = true
    },
  })
  const notify = vi.fn()
  let timer: (() => void) | undefined
  const scheduler = createDesktopProfileScheduler({
    profiles,
    supervisor,
    tunController: controller,
    homeDir,
    notify,
    now: () => Date.now() + 120_000,
    setTimer: (callback) => {
      timer = callback
      return 0 as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: () => {},
  })
  return {
    profiles,
    profile,
    supervisor,
    controller,
    notify,
    activeConfigPath,
    setSubscription: (value: string) => {
      subscription = value
    },
    failPrivileged: () => {
      failPrivileged = true
    },
    isPrivileged: () => privileged,
    pauseStops: () => {
      let release!: () => void
      stopGate = new Promise<void>((resolve) => {
        release = resolve
      })
      return release
    },
    stopReached,
    async tick() {
      scheduler.start()
      timer!()
      await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce())
      scheduler.stop()
    },
  }
}

describe('desktop scheduled subscription refresh', () => {
  it('keeps a later user disable after an in-flight automatic TUN restart', async () => {
    const f = await fixture()
    await f.controller.enable({ stack: 'gvisor' })
    f.stopReached.mockClear()
    const releaseStops = f.pauseStops()
    f.setSubscription('mode: global\n')
    const ticking = f.tick()
    await vi.waitFor(() => expect(f.stopReached).toHaveBeenCalledOnce())
    const disabling = f.controller.disable()
    releaseStops()
    await Promise.all([ticking, disabling])
    expect(await f.controller.status()).toEqual({
      enabled: false,
      mode: 'sidecar',
    })
    expect(f.isPrivileged()).toBe(false)
  })

  it('validates and applies the active subscription before reporting success', async () => {
    const f = await fixture()
    f.setSubscription('mode: global\n')
    await f.tick()
    expect(f.supervisor.validate).toHaveBeenCalledOnce()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
    expect(f.stopReached).toHaveBeenCalledOnce()
    expect(await readFile(f.activeConfigPath, 'utf8')).toContain('mode: global')
    expect(f.notify).toHaveBeenCalledWith(
      'Subscription updated',
      expect.any(String),
    )
  })

  it('retains the running config and reports a failed validation', async () => {
    const f = await fixture()
    f.setSubscription('mode: bad\n')
    await f.tick()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
    expect(await readFile(f.activeConfigPath, 'utf8')).toContain('mode: rule')
    expect(f.notify).toHaveBeenCalledWith(
      'Subscription update failed',
      'invalid refreshed config',
    )
  })

  it('restores the active TUN stack without starting a second kernel', async () => {
    const f = await fixture()
    await f.controller.enable({ stack: 'gvisor' })
    f.setSubscription('mode: global\n')
    await f.tick()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
    expect(f.isPrivileged()).toBe(true)
    expect(await f.controller.status()).toEqual({
      enabled: true,
      mode: 'tun',
      stack: 'gvisor',
    })
    const active = parse(await readFile(f.activeConfigPath, 'utf8'))
    expect(active).toMatchObject({
      mode: 'global',
      tun: { enable: true, stack: 'gvisor' },
      secret: 'managed-secret',
    })
    expect(await f.profiles.getSection(f.profile.id, 'mode')).toBe('global')
    expect(await f.profiles.getSection(f.profile.id, 'secret')).toBeNull()
  })

  it('reports a failed TUN restoration and leaves its recovered sidecar usable', async () => {
    const f = await fixture()
    await f.controller.enable({ stack: 'gvisor' })
    f.failPrivileged()
    f.setSubscription('mode: global\n')
    await f.tick()
    expect(f.supervisor.restart).not.toHaveBeenCalled()
    expect(f.isPrivileged()).toBe(false)
    expect(await f.controller.status()).toEqual({
      enabled: false,
      mode: 'sidecar',
    })
    expect(f.notify).toHaveBeenCalledWith(
      'Subscription update failed',
      'privileged start failed',
    )
  })
})
