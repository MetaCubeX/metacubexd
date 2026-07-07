import ky from 'ky'

// packages/ui/composables/__tests__/useControlApi.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveControlConfig, useControlApi } from '../useControlApi'

// We test the pure resolver in isolation; ky is mocked so no network happens.
const kyExtend = vi.fn()
vi.mock('ky', () => ({
  default: { create: vi.fn(() => ({ extend: kyExtend })) },
}))

describe('composables/useControlApi resolveControlConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).window
  })
  afterEach(() => {
    delete (globalThis as any).window
  })

  it('uses the desktop bridge base+token when window.metacubexd.control is set', () => {
    ;(globalThis as any).window = {
      metacubexd: {
        isDesktop: true,
        control: { base: 'http://127.0.0.1:8123/api/control', token: 'abc' },
      },
      location: { origin: 'file://' },
    }
    const cfg = resolveControlConfig()
    expect(cfg.base).toBe('http://127.0.0.1:8123/api/control')
    expect(cfg.token).toBe('abc')
  })

  it('falls back to same-origin /api/control with no token when no bridge', () => {
    ;(globalThis as any).window = {
      location: { origin: 'https://dash.example.com' },
    }
    const cfg = resolveControlConfig()
    expect(cfg.base).toBe('https://dash.example.com/api/control')
    expect(cfg.token).toBeUndefined()
  })

  it('uses the controlToken injected via config.js for the same-origin base (#2074)', () => {
    ;(globalThis as any).window = {
      location: { origin: 'http://192.168.5.30:8088' },
      __METACUBEXD_CONFIG__: { defaultBackendURL: '', controlToken: 'test' },
    }
    const cfg = resolveControlConfig()
    expect(cfg.base).toBe('http://192.168.5.30:8088/api/control')
    expect(cfg.token).toBe('test')
  })

  it('builds a ky client with the Authorization header when a token is present', () => {
    ;(globalThis as any).window = {
      metacubexd: { control: { base: 'http://x/api/control', token: 'tok' } },
      location: { origin: 'file://' },
    }
    useControlApi()
    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'http://x/api/control',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })
})

describe('composables/useControlApi methods', () => {
  const json = vi.fn()
  const text = vi.fn()
  const get = vi.fn(() => ({ json, text }))
  const post = vi.fn(() => ({ json, text }))
  const put = vi.fn(() => ({ json, text }))
  const del = vi.fn(() => ({ json, text }))

  beforeEach(() => {
    vi.clearAllMocks()
    json.mockResolvedValue({ ok: true })
    text.mockResolvedValue('a: 1')
    ;(ky.create as any).mockReturnValue({ get, post, put, delete: del })
    ;(globalThis as any).window = {
      metacubexd: { control: { base: 'http://x/api/control', token: 't' } },
      location: { origin: 'file://' },
    }
  })

  it('getInfo() GETs info', async () => {
    const api = useControlApi()
    await api.getInfo()
    expect(get).toHaveBeenCalledWith('info')
  })

  it('getKernelStatus() GETs kernel/status', async () => {
    await useControlApi().getKernelStatus()
    expect(get).toHaveBeenCalledWith('kernel/status')
  })

  it('startKernel/stopKernel/restartKernel POST the right paths', async () => {
    const api = useControlApi()
    await api.startKernel()
    await api.stopKernel()
    await api.restartKernel()
    expect(post).toHaveBeenCalledWith('kernel/start')
    expect(post).toHaveBeenCalledWith('kernel/stop')
    expect(post).toHaveBeenCalledWith('kernel/restart')
  })

  it('listProfiles() GETs profiles', async () => {
    await useControlApi().listProfiles()
    expect(get).toHaveBeenCalledWith('profiles')
  })

  it('createProfile() POSTs profiles with json body', async () => {
    await useControlApi().createProfile({ name: 'p1', content: 'a: 1' })
    expect(post).toHaveBeenCalledWith('profiles', {
      json: { name: 'p1', content: 'a: 1' },
    })
  })

  it('createProfile() accepts type "script" for a JS transform profile', async () => {
    await useControlApi().createProfile({ name: 'js', type: 'script' })
    expect(post).toHaveBeenCalledWith('profiles', {
      json: { name: 'js', type: 'script' },
    })
  })

  it('getProfile() GETs profiles/:id', async () => {
    await useControlApi().getProfile('id1')
    expect(get).toHaveBeenCalledWith('profiles/id1')
  })

  it('updateProfile() PUTs profiles/:id with json body', async () => {
    await useControlApi().updateProfile('id1', { content: 'b: 2' })
    expect(put).toHaveBeenCalledWith('profiles/id1', {
      json: { content: 'b: 2' },
    })
  })

  it('updateProfile() forwards updateInterval for auto-update (#2107)', async () => {
    await useControlApi().updateProfile('id1', { updateInterval: 60 })
    expect(put).toHaveBeenCalledWith('profiles/id1', {
      json: { updateInterval: 60 },
    })
  })

  it('deleteProfile() DELETEs profiles/:id', async () => {
    await useControlApi().deleteProfile('id1')
    expect(del).toHaveBeenCalledWith('profiles/id1')
  })

  it('rollbackKernel() POSTs kernel/rollback (#2109)', async () => {
    await useControlApi().rollbackKernel()
    expect(post).toHaveBeenCalledWith('kernel/rollback')
  })

  it('recoverKernel() POSTs kernel/recover (#2109)', async () => {
    await useControlApi().recoverKernel()
    expect(post).toHaveBeenCalledWith('kernel/recover')
  })

  it('duplicateProfile() POSTs profiles/:id/duplicate', async () => {
    await useControlApi().duplicateProfile('id1', 'copy')
    expect(post).toHaveBeenCalledWith('profiles/id1/duplicate', {
      json: { name: 'copy' },
    })
  })

  it('importProfile() POSTs profiles/import', async () => {
    await useControlApi().importProfile('http://sub', 'subname')
    expect(post).toHaveBeenCalledWith('profiles/import', {
      json: { url: 'http://sub', name: 'subname' },
    })
  })

  it('activateProfile() POSTs profiles/:id/activate', async () => {
    await useControlApi().activateProfile('id1')
    expect(post).toHaveBeenCalledWith('profiles/id1/activate')
  })

  it('refreshProfile() POSTs profiles/:id/refresh', async () => {
    await useControlApi().refreshProfile('id1')
    expect(post).toHaveBeenCalledWith('profiles/id1/refresh')
  })

  it('validateProfile() POSTs profiles/:id/validate', async () => {
    await useControlApi().validateProfile('id1')
    expect(post).toHaveBeenCalledWith('profiles/id1/validate')
  })

  it('logsUrl() returns the SSE URL with ?token=', () => {
    const url = useControlApi().logsUrl()
    expect(url).toBe('http://x/api/control/kernel/logs?token=t')
  })

  it('getSysProxy() GETs sysproxy', async () => {
    await useControlApi().getSysProxy()
    expect(get).toHaveBeenCalledWith('sysproxy')
  })

  it('setSysProxy() POSTs sysproxy with json body', async () => {
    await useControlApi().setSysProxy({
      enabled: true,
      bypass: ['localhost'],
    })
    expect(post).toHaveBeenCalledWith('sysproxy', {
      json: { enabled: true, bypass: ['localhost'] },
    })
  })

  it('getKernelVersions() GETs kernel/versions', async () => {
    await useControlApi().getKernelVersions()
    expect(get).toHaveBeenCalledWith('kernel/versions')
  })

  it('switchKernel() POSTs kernel/switch with the version json body', async () => {
    await useControlApi().switchKernel('v1.19.0')
    expect(post).toHaveBeenCalledWith('kernel/switch', {
      json: { version: 'v1.19.0' },
    })
  })

  it('updateGeoAssets() POSTs geo/update', async () => {
    await useControlApi().updateGeoAssets()
    expect(post).toHaveBeenCalledWith('geo/update')
  })

  it('getRuntimeConfig() GETs config/runtime as text (text/yaml, not JSON)', async () => {
    const out = await useControlApi().getRuntimeConfig()
    expect(get).toHaveBeenCalledWith('config/runtime')
    expect(text).toHaveBeenCalledOnce()
    expect(json).not.toHaveBeenCalled()
    expect(out).toBe('a: 1')
  })

  it('getConfigSection() GETs config/section with the key as a search param', async () => {
    json.mockResolvedValue(['MATCH,DIRECT'])
    const out = await useControlApi().getConfigSection('rules')
    expect(get).toHaveBeenCalledWith('config/section', {
      searchParams: { key: 'rules' },
    })
    expect(out).toEqual(['MATCH,DIRECT'])
  })

  it('setConfigSection() PUTs config/section with { key, value } json body', async () => {
    await useControlApi().setConfigSection({
      key: 'rules',
      value: ['MATCH,REJECT'],
    })
    expect(put).toHaveBeenCalledWith('config/section', {
      json: { key: 'rules', value: ['MATCH,REJECT'] },
    })
  })

  it('webdavBackup() POSTs backup with { webdav, uiSettings } json body', async () => {
    const webdav = {
      url: 'https://dav.example.com',
      username: 'u',
      password: 'p',
      dir: 'metacubexd',
    }
    const uiSettings = { app: 'metacubexd', settings: { theme: 'dark' } }
    await useControlApi().webdavBackup({ webdav, uiSettings })
    expect(post).toHaveBeenCalledWith('backup', {
      json: { webdav, uiSettings },
    })
  })

  it('webdavRestore() POSTs restore with { webdav } json body', async () => {
    const webdav = {
      url: 'https://dav.example.com',
      username: 'u',
      password: 'p',
    }
    await useControlApi().webdavRestore({ webdav })
    expect(post).toHaveBeenCalledWith('restore', { json: { webdav } })
  })

  it('getTun() GETs tun', async () => {
    await useControlApi().getTun()
    expect(get).toHaveBeenCalledWith('tun')
  })

  it('setTun() POSTs tun with { enabled, stack } json body', async () => {
    await useControlApi().setTun({ enabled: true, stack: 'gvisor' })
    expect(post).toHaveBeenCalledWith('tun', {
      json: { enabled: true, stack: 'gvisor' },
    })
  })

  it('setTun() POSTs tun with just { enabled } when no stack given', async () => {
    await useControlApi().setTun({ enabled: false })
    expect(post).toHaveBeenCalledWith('tun', { json: { enabled: false } })
  })

  it('uninstallTun() POSTs tun/uninstall (no body)', async () => {
    await useControlApi().uninstallTun()
    expect(post).toHaveBeenCalledWith('tun/uninstall')
  })
})
