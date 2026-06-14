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
  const get = vi.fn(() => ({ json }))
  const post = vi.fn(() => ({ json }))
  const put = vi.fn(() => ({ json }))
  const del = vi.fn(() => ({ json }))

  beforeEach(() => {
    vi.clearAllMocks()
    json.mockResolvedValue({ ok: true })
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

  it('deleteProfile() DELETEs profiles/:id', async () => {
    await useControlApi().deleteProfile('id1')
    expect(del).toHaveBeenCalledWith('profiles/id1')
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
})
