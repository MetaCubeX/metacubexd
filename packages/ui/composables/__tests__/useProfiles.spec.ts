// packages/ui/composables/__tests__/useProfiles.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProfiles } from '../useProfiles'

const api = {
  listProfiles: vi.fn(),
  createProfile: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  deleteProfile: vi.fn(),
  duplicateProfile: vi.fn(),
  importProfile: vi.fn(),
  activateProfile: vi.fn(),
  validateProfile: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

const meta = (id: string, name = id) => ({
  id,
  name,
  type: 'local' as const,
  updatedAt: 1,
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

  it('load() returns profile detail', async () => {
    api.getProfile.mockResolvedValue({ meta: meta('a'), content: 'x: 1' })
    const p = useProfiles()
    const detail = await p.load('a')
    expect(detail.content).toBe('x: 1')
  })
})
