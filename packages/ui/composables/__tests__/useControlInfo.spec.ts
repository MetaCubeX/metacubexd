// packages/ui/composables/__tests__/useControlInfo.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const getInfo = vi.fn()
vi.mock('../useControlApi', () => ({
  useControlApi: () => ({ getInfo }),
}))

// Re-import per test to reset the module-level singleton.
async function freshUseControlInfo() {
  vi.resetModules()
  const mod = await import('../useControlInfo')
  return mod.useControlInfo
}

describe('composables/useControlInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hasAgent=true and features populated when /info succeeds', async () => {
    getInfo.mockResolvedValue({
      hasAgent: true,
      version: '1.0.0',
      platform: { os: 'darwin', arch: 'arm64' },
      kernel: { bundled: true, path: '/k', version: 'v1.19.27' },
      features: ['profiles', 'logs-sse', 'kernel-control'],
    })
    const useControlInfo = await freshUseControlInfo()
    const { hasAgent, features, hasFeature, ready } = useControlInfo()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(hasAgent.value).toBe(true)
    expect(features.value).toEqual(['profiles', 'logs-sse', 'kernel-control'])
    expect(hasFeature('kernel-control')).toBe(true)
    expect(hasFeature('logs-sse')).toBe(true)
  })

  it('hasAgent=false and no features when /info rejects (404 / network)', async () => {
    getInfo.mockRejectedValue(new Error('404'))
    const useControlInfo = await freshUseControlInfo()
    const { hasAgent, features, hasFeature, ready } = useControlInfo()
    await vi.waitUntil(() => ready.value)
    await nextTick()
    expect(hasAgent.value).toBe(false)
    expect(features.value).toEqual([])
    expect(hasFeature('kernel-control')).toBe(false)
  })

  it('probes /info only once even when called from multiple components', async () => {
    getInfo.mockResolvedValue({
      hasAgent: true,
      version: '1',
      platform: { os: 'linux', arch: 'x64' },
      kernel: { bundled: true, path: '/k' },
      features: ['profiles'],
    })
    const useControlInfo = await freshUseControlInfo()
    useControlInfo()
    useControlInfo()
    useControlInfo()
    await vi.waitUntil(() => useControlInfo().ready.value)
    expect(getInfo).toHaveBeenCalledTimes(1)
  })
})
