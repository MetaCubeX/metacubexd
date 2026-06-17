// packages/ui/composables/__tests__/useProfileStatus.spec.ts
import type { Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const listProfiles = vi.fn()
vi.mock('../useControlApi', () => ({
  useControlApi: () => ({ listProfiles }),
}))

// Controllable useControlInfo singleton stand-in. These refs live in THIS test
// module (not reset by vi.resetModules), so re-importing useProfileStatus picks
// up the same controllable state.
const hasAgent: Ref<boolean> = ref(true)
const controlReady: Ref<boolean> = ref(true)
const featureList: Ref<string[]> = ref(['profiles'])
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasAgent,
    ready: controlReady,
    hasFeature: (f: string) => hasAgent.value && featureList.value.includes(f),
  }),
}))

// Re-import per test to reset the module-level singleton (started guard + refs).
async function freshUseProfileStatus() {
  vi.resetModules()
  const mod = await import('../useProfileStatus')
  return mod.useProfileStatus
}

function baseProfile(id: string) {
  return { id, name: id, type: 'local' }
}

describe('composables/useProfileStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasAgent.value = true
    controlReady.value = true
    featureList.value = ['profiles']
  })

  it('counts only base profiles (excludes merge/script) when agent + feature present', async () => {
    listProfiles.mockResolvedValue([
      baseProfile('a'),
      { id: 'm', name: 'm', type: 'merge' },
      { id: 's', name: 's', type: 'script' },
      baseProfile('b'),
    ])
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile, baseProfileCount } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(baseProfileCount.value).toBe(2)
    expect(hasBaseProfile.value).toBe(true)
    expect(listProfiles).toHaveBeenCalledTimes(1)
  })

  it('hasBaseProfile=false when only merge/script overlays exist', async () => {
    listProfiles.mockResolvedValue([
      { id: 'm', name: 'm', type: 'merge' },
      { id: 's', name: 's', type: 'script' },
    ])
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(hasBaseProfile.value).toBe(false)
  })

  it('degrades gracefully (count 0, ready true) when listProfiles rejects', async () => {
    listProfiles.mockRejectedValue(new Error('401'))
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile, baseProfileCount } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(baseProfileCount.value).toBe(0)
    expect(hasBaseProfile.value).toBe(false)
  })

  it('web mode (no agent): never lists, ready true, hasBaseProfile false', async () => {
    hasAgent.value = false
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(hasBaseProfile.value).toBe(false)
    expect(listProfiles).toHaveBeenCalledTimes(0)
  })

  it('agent present but no profiles feature: never lists', async () => {
    featureList.value = []
    const useProfileStatus = await freshUseProfileStatus()
    const { ready } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(listProfiles).toHaveBeenCalledTimes(0)
  })

  it('refresh() after an import flips hasBaseProfile true', async () => {
    listProfiles.mockResolvedValue([])
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile, refresh } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(hasBaseProfile.value).toBe(false)

    listProfiles.mockResolvedValue([baseProfile('imported')])
    await refresh()
    await nextTick()
    expect(hasBaseProfile.value).toBe(true)
  })

  it('refresh() called directly in web mode does not list (double-guard)', async () => {
    hasAgent.value = false
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, refresh } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    await refresh()
    await nextTick()
    expect(listProfiles).toHaveBeenCalledTimes(0)
  })

  it('defers listing until controlReady flips true, then lists exactly once', async () => {
    controlReady.value = false
    listProfiles.mockResolvedValue([baseProfile('a')])
    const useProfileStatus = await freshUseProfileStatus()
    const { ready, hasBaseProfile } = useProfileStatus()

    // Control probe not settled yet: must not list and must not be ready.
    await nextTick()
    expect(ready.value).toBe(false)
    expect(listProfiles).toHaveBeenCalledTimes(0)

    controlReady.value = true
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(listProfiles).toHaveBeenCalledTimes(1)
    expect(hasBaseProfile.value).toBe(true)
  })

  // Regression: the control-ready watch must live in a DETACHED effect scope, so
  // the first-caller component unmounting mid-probe cannot dispose it and wedge
  // `ready` at false for the rest of the session.
  it('control-ready watch survives the first caller component unmounting mid-probe', async () => {
    controlReady.value = false
    listProfiles.mockResolvedValue([baseProfile('a')])
    const useProfileStatus = await freshUseProfileStatus()

    // First caller runs inside a component-like (non-detached) scope, which is
    // then stopped (component unmounts) BEFORE the control probe settles.
    const componentScope = effectScope()
    let status!: ReturnType<typeof useProfileStatus>
    componentScope.run(() => {
      status = useProfileStatus()
    })
    componentScope.stop()

    expect(status.ready.value).toBe(false)
    expect(listProfiles).toHaveBeenCalledTimes(0)

    // Control info settles AFTER the unmount. The watch must still fire.
    controlReady.value = true
    await vi.waitUntil(() => status.ready.value)
    await nextTick()
    expect(listProfiles).toHaveBeenCalledTimes(1)
    expect(status.hasBaseProfile.value).toBe(true)
  })

  it('probes once across multiple useProfileStatus() calls', async () => {
    listProfiles.mockResolvedValue([baseProfile('a')])
    const useProfileStatus = await freshUseProfileStatus()
    useProfileStatus()
    useProfileStatus()
    const { ready } = useProfileStatus()
    await vi.waitUntil(() => ready.value)
    expect(listProfiles).toHaveBeenCalledTimes(1)
  })
})
