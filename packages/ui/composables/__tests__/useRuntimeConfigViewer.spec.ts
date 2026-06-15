// packages/ui/composables/__tests__/useRuntimeConfigViewer.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRuntimeConfigViewer } from '../useRuntimeConfigViewer'

const api = {
  getRuntimeConfig: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'runtime-config',
  }),
}))

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

describe('composables/useRuntimeConfigViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.getRuntimeConfig.mockResolvedValue('mixed-port: 7890\nsecret: xyz\n')
  })

  it('available reflects hasFeature(runtime-config) — true when present', () => {
    expect(useRuntimeConfigViewer().available.value).toBe(true)
  })

  it('available is false when the runtime-config feature is absent', () => {
    featurePresent = false
    expect(useRuntimeConfigViewer().available.value).toBe(false)
  })

  it('refresh() GETs config/runtime and stores the returned text', async () => {
    const v = useRuntimeConfigViewer()
    await v.refresh()
    expect(api.getRuntimeConfig).toHaveBeenCalledOnce()
    expect(v.content.value).toBe('mixed-port: 7890\nsecret: xyz\n')
  })

  it('loading() reflects the in-flight request (refresh button disables while busy)', async () => {
    let resolveGet: (v: unknown) => void = () => {}
    api.getRuntimeConfig.mockReturnValue(
      new Promise((res) => {
        resolveGet = res
      }),
    )
    const v = useRuntimeConfigViewer()
    const p = v.refresh()
    expect(v.loading.value).toBe(true)
    resolveGet('a: 1')
    await p
    expect(v.loading.value).toBe(false)
  })

  it('refresh() surfaces failures via toast.error and clears the busy flag (no swallowing)', async () => {
    api.getRuntimeConfig.mockRejectedValue(new Error('500 boom'))
    const v = useRuntimeConfigViewer()
    await v.refresh()
    expect(toast.error).toHaveBeenCalled()
    expect(v.loading.value).toBe(false)
  })
})
