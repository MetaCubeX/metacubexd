// packages/ui/composables/__tests__/useGeoAssets.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeoAssets } from '../useGeoAssets'

const api = {
  updateGeoAssets: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'geo-assets',
  }),
}))

// Hoisted so the mock factory (runs before the module body) can reference it.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

describe('composables/useGeoAssets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.updateGeoAssets.mockResolvedValue({
      ok: true,
      files: ['geoip.dat', 'geosite.dat', 'country.mmdb'],
    })
  })

  it('available reflects hasFeature(geo-assets) — true when present', () => {
    expect(useGeoAssets().available.value).toBe(true)
  })

  it('available is false when the geo-assets feature is absent', () => {
    featurePresent = false
    expect(useGeoAssets().available.value).toBe(false)
  })

  it('update() POSTs geo/update and toasts success with the downloaded files', async () => {
    const g = useGeoAssets()
    await g.update()
    expect(api.updateGeoAssets).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('updating() reflects the in-flight request (button disables while busy)', async () => {
    let resolveUpdate: (v: unknown) => void = () => {}
    api.updateGeoAssets.mockReturnValue(
      new Promise((res) => {
        resolveUpdate = res
      }),
    )
    const g = useGeoAssets()
    const p = g.update()
    expect(g.updating.value).toBe(true)
    resolveUpdate({ ok: true, files: [] })
    await p
    expect(g.updating.value).toBe(false)
  })

  it('update() surfaces failures via toast.error and clears the busy flag', async () => {
    api.updateGeoAssets.mockRejectedValue(new Error('network down'))
    const g = useGeoAssets()
    await g.update()
    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(g.updating.value).toBe(false)
  })
})
