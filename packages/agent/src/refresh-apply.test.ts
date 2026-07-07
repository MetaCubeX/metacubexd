import type { KernelState, MihomoSupervisor, ProfileStore } from './types'
import { describe, expect, it, vi } from 'vitest'
import { applyActiveRefresh } from './refresh-apply'

function fakeProfiles(activeId: string | undefined) {
  return {
    getActiveId: vi.fn(async () => activeId),
    setActive: vi.fn(async () => {}),
  } as unknown as ProfileStore
}

function fakeSupervisor() {
  const state: KernelState = {
    status: 'running',
    externalController: '127.0.0.1:9090',
    secret: 's',
  }
  return {
    restart: vi.fn(async () => ({ ...state, pid: 9 })),
  } as unknown as MihomoSupervisor
}

describe('applyActiveRefresh', () => {
  it('re-activates + restarts when the refreshed profile is the active base', async () => {
    const profiles = fakeProfiles('p1')
    const supervisor = fakeSupervisor()
    await applyActiveRefresh(profiles, supervisor, 'p1')
    expect(profiles.setActive).toHaveBeenCalledWith('p1')
    expect(supervisor.restart).toHaveBeenCalledOnce()
  })

  it('is a no-op when the refreshed profile is NOT the active base', async () => {
    const profiles = fakeProfiles('other')
    const supervisor = fakeSupervisor()
    await applyActiveRefresh(profiles, supervisor, 'p1')
    expect(profiles.setActive).not.toHaveBeenCalled()
    expect(supervisor.restart).not.toHaveBeenCalled()
  })

  it('is a no-op when there is no active profile', async () => {
    const profiles = fakeProfiles(undefined)
    const supervisor = fakeSupervisor()
    await applyActiveRefresh(profiles, supervisor, 'p1')
    expect(profiles.setActive).not.toHaveBeenCalled()
    expect(supervisor.restart).not.toHaveBeenCalled()
  })
})
