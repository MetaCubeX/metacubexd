// packages/ui/composables/__tests__/useProfiles.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProfiles } from '../useProfiles'

const { invalidateQueries } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}))
vi.mock('../useQueries', () => ({ queryKeys: { config: ['config'] } }))

const api = {
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  duplicateProfile: vi.fn(),
  importProfile: vi.fn(),
  activateProfile: vi.fn(),
  refreshProfile: vi.fn(),
  refreshAndActivateProfile: vi.fn(),
  validateProfile: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// Hoisted so the vue-sonner mock factory (runs before the module body) can
// reference it — useProfiles now surfaces failures via toast (no swallowing).
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

// useProxiesStore is auto-imported in the app; stub it so activate() can drop
// active connections (break-connections-on-change) without pinning pinia here.
const closeAllConnectionsMock = vi.fn().mockResolvedValue(undefined)
vi.stubGlobal('useProxiesStore', () => ({
  closeAllConnections: closeAllConnectionsMock,
}))

const meta = (id: string, name = id) => ({
  id,
  name,
  type: 'local' as const,
  updatedAt: 1,
})

const mergeMeta = (
  id: string,
  over: { enabled?: boolean; name?: string } = {},
) => ({
  id,
  name: over.name ?? id,
  type: 'merge' as const,
  updatedAt: 1,
  ...(over.enabled != null ? { enabled: over.enabled } : {}),
})

const scriptMeta = (
  id: string,
  over: { enabled?: boolean; name?: string } = {},
) => ({
  id,
  name: over.name ?? id,
  type: 'script' as const,
  updatedAt: 1,
  ...(over.enabled != null ? { enabled: over.enabled } : {}),
})

describe('composables/useProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listProfiles.mockResolvedValue([meta('a'), meta('b')])
  })

  it('refresh() loads the profile list', async () => {
    const p = useProfiles()
    await p.refresh()
    expect(p.profiles.value.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('refresh() seeds activeBaseId from the agent `active` flag (#2148)', async () => {
    api.listProfiles.mockResolvedValue([
      { ...meta('a'), active: false },
      { ...meta('b'), active: true },
    ])
    const p = useProfiles()
    await p.refresh()
    expect(p.activeBaseId.value).toBe('b')
  })

  it('refresh() ignores merge/script profiles when seeding activeBaseId', async () => {
    api.listProfiles.mockResolvedValue([
      { ...mergeMeta('m'), active: true },
      { ...meta('a'), active: false },
    ])
    const p = useProfiles()
    await p.refresh()
    expect(p.activeBaseId.value).toBeUndefined()
  })

  it('create() then re-lists', async () => {
    api.createProfile.mockResolvedValue(meta('c'))
    const p = useProfiles()
    await p.create({ name: 'c' })
    expect(api.createProfile).toHaveBeenCalledWith({ name: 'c' })
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('duplicate() forwards id + name then re-lists', async () => {
    api.duplicateProfile.mockResolvedValue(meta('a-copy'))
    const p = useProfiles()
    await p.duplicate('a', 'a-copy')
    expect(api.duplicateProfile).toHaveBeenCalledWith('a', 'a-copy')
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('remove() deletes then re-lists', async () => {
    api.deleteProfile.mockResolvedValue(undefined)
    const p = useProfiles()
    await p.remove('a')
    expect(api.deleteProfile).toHaveBeenCalledWith('a')
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('importUrl() imports then re-lists', async () => {
    api.importProfile.mockResolvedValue(meta('sub'))
    const p = useProfiles()
    await p.importUrl('http://sub', 'sub')
    expect(api.importProfile).toHaveBeenCalledWith('http://sub', 'sub')
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('save() updates content then re-lists', async () => {
    api.updateProfile.mockResolvedValue(meta('a'))
    const p = useProfiles()
    await p.save('a', 'mode: rule')
    expect(api.updateProfile).toHaveBeenCalledWith('a', {
      content: 'mode: rule',
    })
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('setUpdateInterval() persists minutes then re-lists (#2107)', async () => {
    api.updateProfile.mockResolvedValue(meta('a'))
    const p = useProfiles()
    await p.setUpdateInterval('a', 60)
    expect(api.updateProfile).toHaveBeenCalledWith('a', {
      updateInterval: 60,
    })
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('validate() returns the validate result', async () => {
    api.validateProfile.mockResolvedValue({ valid: true, message: 'ok' })
    const p = useProfiles()
    const res = await p.validate('a')
    expect(res).toEqual({ valid: true, message: 'ok' })
  })

  it('activate() returns new KernelState and re-lists', async () => {
    api.activateProfile.mockResolvedValue({
      status: 'running',
      externalController: '127.0.0.1:9090',
      secret: 's',
    })
    const p = useProfiles()
    const state = await p.activate('a')
    expect(state.status).toBe('running')
    expect(api.listProfiles).toHaveBeenCalled()
  })

  it('activate() invalidates the cached runtime config mode (#2137)', async () => {
    api.activateProfile.mockResolvedValue({
      status: 'running',
      externalController: '127.0.0.1:9090',
      secret: 's',
    })
    const p = useProfiles()

    await p.activate('a')

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['config'] })
  })

  it('activate() drops active connections so the new profile takes effect immediately', async () => {
    api.activateProfile.mockResolvedValue({
      status: 'running',
      externalController: '127.0.0.1:9090',
      secret: 's',
    })
    const p = useProfiles()
    await p.activate('a')
    expect(closeAllConnectionsMock).toHaveBeenCalledTimes(1)
  })

  it('load() returns profile detail', async () => {
    api.getProfile.mockResolvedValue({ meta: meta('a'), content: 'x: 1' })
    const p = useProfiles()
    const detail = await p.load('a')
    expect(detail.content).toBe('x: 1')
  })

  describe('merge profiles', () => {
    it('createMerge() POSTs { name, type: "merge" } then re-lists', async () => {
      api.createProfile.mockResolvedValue(mergeMeta('m'))
      const p = useProfiles()
      await p.createMerge('overlay')
      expect(api.createProfile).toHaveBeenCalledWith({
        name: 'overlay',
        type: 'merge',
      })
      expect(api.listProfiles).toHaveBeenCalled()
    })

    it('baseProfiles / mergeProfiles split the list by type', async () => {
      api.listProfiles.mockResolvedValue([
        meta('a'),
        mergeMeta('m1'),
        meta('b'),
        mergeMeta('m2'),
      ])
      const p = useProfiles()
      await p.refresh()
      expect(p.baseProfiles.value.map((m) => m.id)).toEqual(['a', 'b'])
      expect(p.mergeProfiles.value.map((m) => m.id)).toEqual(['m1', 'm2'])
    })

    it('setEnabled() PUTs { enabled } then re-lists', async () => {
      api.updateProfile.mockResolvedValue(mergeMeta('m', { enabled: false }))
      const p = useProfiles()
      await p.setEnabled('m', false)
      expect(api.updateProfile).toHaveBeenCalledWith('m', { enabled: false })
      expect(api.listProfiles).toHaveBeenCalled()
    })

    it('setEnabled() re-activates the active base so the overlay re-composes', async () => {
      api.activateProfile.mockResolvedValue({
        status: 'running',
        externalController: '127.0.0.1:9090',
        secret: 's',
      })
      api.updateProfile.mockResolvedValue(mergeMeta('m', { enabled: true }))
      const p = useProfiles()
      // Activating a base records it as the active base for re-composition.
      await p.activate('a')
      api.activateProfile.mockClear()
      await p.setEnabled('m', true)
      expect(api.activateProfile).toHaveBeenCalledWith('a')
    })

    it('setEnabled() informs the user when there is no active base (no activate call)', async () => {
      api.updateProfile.mockResolvedValue(mergeMeta('m', { enabled: true }))
      const p = useProfiles()
      await p.setEnabled('m', true)
      expect(api.activateProfile).not.toHaveBeenCalled()
      expect(toast.info).toHaveBeenCalled()
    })

    it('saveMerge() re-composes by re-activating the active base', async () => {
      api.updateProfile.mockResolvedValue(mergeMeta('m'))
      api.activateProfile.mockResolvedValue({
        status: 'running',
        externalController: '127.0.0.1:9090',
        secret: 's',
      })
      const p = useProfiles()
      await p.activate('a')
      api.activateProfile.mockClear()
      await p.saveMerge('m', 'dns:\n  enable: true')
      expect(api.updateProfile).toHaveBeenCalledWith('m', {
        content: 'dns:\n  enable: true',
      })
      expect(api.activateProfile).toHaveBeenCalledWith('a')
    })

    it('setEnabled() surfaces failures via toast.error (no swallowing)', async () => {
      api.updateProfile.mockRejectedValue(new Error('disk full'))
      const p = useProfiles()
      await p.setEnabled('m', false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('script profiles', () => {
    it('createScript() POSTs { name, type: "script" } then re-lists', async () => {
      api.createProfile.mockResolvedValue(scriptMeta('s'))
      const p = useProfiles()
      await p.createScript('transform')
      expect(api.createProfile).toHaveBeenCalledWith({
        name: 'transform',
        type: 'script',
      })
      expect(api.listProfiles).toHaveBeenCalled()
    })

    it('scriptProfiles splits out type "script" (baseProfiles excludes them)', async () => {
      api.listProfiles.mockResolvedValue([
        meta('a'),
        mergeMeta('m1'),
        scriptMeta('s1'),
        meta('b'),
        scriptMeta('s2'),
      ])
      const p = useProfiles()
      await p.refresh()
      expect(p.baseProfiles.value.map((m) => m.id)).toEqual(['a', 'b'])
      expect(p.mergeProfiles.value.map((m) => m.id)).toEqual(['m1'])
      expect(p.scriptProfiles.value.map((m) => m.id)).toEqual(['s1', 's2'])
    })

    it('setScriptEnabled() PUTs { enabled } then re-lists', async () => {
      api.updateProfile.mockResolvedValue(scriptMeta('s', { enabled: false }))
      const p = useProfiles()
      await p.setScriptEnabled('s', false)
      expect(api.updateProfile).toHaveBeenCalledWith('s', { enabled: false })
      expect(api.listProfiles).toHaveBeenCalled()
    })

    it('setScriptEnabled() re-activates the active base so scripts recompose', async () => {
      api.activateProfile.mockResolvedValue({
        status: 'running',
        externalController: '127.0.0.1:9090',
        secret: 's',
      })
      api.updateProfile.mockResolvedValue(scriptMeta('s', { enabled: true }))
      const p = useProfiles()
      await p.activate('a')
      api.activateProfile.mockClear()
      await p.setScriptEnabled('s', true)
      expect(api.activateProfile).toHaveBeenCalledWith('a')
    })

    it('setScriptEnabled() informs the user when there is no active base', async () => {
      api.updateProfile.mockResolvedValue(scriptMeta('s', { enabled: true }))
      const p = useProfiles()
      await p.setScriptEnabled('s', true)
      expect(api.activateProfile).not.toHaveBeenCalled()
      expect(toast.info).toHaveBeenCalled()
    })

    it('saveScript() saves content then recomposes by re-activating the base', async () => {
      api.updateProfile.mockResolvedValue(scriptMeta('s'))
      api.activateProfile.mockResolvedValue({
        status: 'running',
        externalController: '127.0.0.1:9090',
        secret: 's',
      })
      const p = useProfiles()
      await p.activate('a')
      api.activateProfile.mockClear()
      await p.saveScript('s', 'export default (c) => c')
      expect(api.updateProfile).toHaveBeenCalledWith('s', {
        content: 'export default (c) => c',
      })
      expect(api.activateProfile).toHaveBeenCalledWith('a')
    })

    it('setScriptEnabled() surfaces failures via toast.error (no swallowing)', async () => {
      api.updateProfile.mockRejectedValue(new Error('disk full'))
      const p = useProfiles()
      await p.setScriptEnabled('s', false)
      expect(toast.error).toHaveBeenCalled()
    })
  })

  describe('refreshRemote', () => {
    it('re-fetches the subscription, re-lists, toasts success, returns true', async () => {
      api.refreshProfile.mockResolvedValue(meta('a'))
      api.listProfiles.mockResolvedValue([meta('a')])
      const p = useProfiles()
      const ok = await p.refreshRemote('a')
      expect(api.refreshProfile).toHaveBeenCalledWith('a')
      expect(api.listProfiles).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
      expect(ok).toBe(true)
    })

    it('surfaces a failure (e.g. non-remote / network) via toast.error, returns false, never throws', async () => {
      api.refreshProfile.mockRejectedValue(
        new Error('not a remote subscription'),
      )
      const p = useProfiles()
      const ok = await p.refreshRemote('local1')
      expect(toast.error).toHaveBeenCalled()
      expect(ok).toBe(false)
    })
  })

  describe('refreshAndApply', () => {
    it('refreshes + applies, re-lists, toasts success, returns true (#2108)', async () => {
      api.refreshAndActivateProfile.mockResolvedValue({
        meta: meta('a'),
        kernel: { status: 'running' },
      })
      api.listProfiles.mockResolvedValue([meta('a')])
      const p = useProfiles()
      const ok = await p.refreshAndApply('a')
      expect(api.refreshAndActivateProfile).toHaveBeenCalledWith('a')
      expect(api.listProfiles).toHaveBeenCalled()
      expect(toast.success).toHaveBeenCalled()
      expect(ok).toBe(true)
    })

    it('surfaces a failed apply (e.g. validation) via toast.error, returns false', async () => {
      api.refreshAndActivateProfile.mockRejectedValue(
        Object.assign(new Error('Request failed with status code 400'), {
          data: {
            statusMessage: 'profile validation failed',
            data: { error: 'GEOIP database download failed' },
          },
        }),
      )
      const p = useProfiles()
      const ok = await p.refreshAndApply('a')
      expect(toast.error).toHaveBeenCalledWith('profilesRefreshFailed', {
        description: 'GEOIP database download failed',
      })
      expect(ok).toBe(false)
    })
  })
})
