// packages/ui/composables/__tests__/useSystemProxy.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSystemProxy } from '../useSystemProxy'

const api = {
  getSysProxy: vi.fn(),
  setSysProxy: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// hasFeature is driven by the gating probe; toggle it per test.
let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'system-proxy',
  }),
}))

const state = (
  over: Partial<{ enabled: boolean; port: number; bypass: string[] }> = {},
) => ({
  enabled: false,
  port: 7890,
  bypass: ['localhost', '127.0.0.1'],
  ...over,
})

describe('composables/useSystemProxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.getSysProxy.mockResolvedValue(state())
    api.setSysProxy.mockResolvedValue(state())
  })

  it('available reflects hasFeature(system-proxy) — true when the feature is present', () => {
    const sp = useSystemProxy()
    expect(sp.available.value).toBe(true)
  })

  it('available is false when the system-proxy feature is absent', () => {
    featurePresent = false
    const sp = useSystemProxy()
    expect(sp.available.value).toBe(false)
  })

  it('load() GETs the sysproxy state and populates enabled/port/bypassText', async () => {
    api.getSysProxy.mockResolvedValue(
      state({ enabled: true, port: 7891, bypass: ['localhost', '10.0.0.0/8'] }),
    )
    const sp = useSystemProxy()
    await sp.load()
    expect(api.getSysProxy).toHaveBeenCalled()
    expect(sp.enabled.value).toBe(true)
    expect(sp.port.value).toBe(7891)
    // bypass list is rendered one-entry-per-line into the editable textarea.
    expect(sp.bypassText.value).toBe('localhost\n10.0.0.0/8')
  })

  it('save() POSTs { enabled, bypass } with bypass parsed one-entry-per-line', async () => {
    const sp = useSystemProxy()
    sp.enabled.value = true
    sp.bypassText.value = 'localhost\n  127.0.0.1  \n\n192.168.0.0/16'
    await sp.save()
    expect(api.setSysProxy).toHaveBeenCalledWith({
      enabled: true,
      // blank lines dropped, entries trimmed
      bypass: ['localhost', '127.0.0.1', '192.168.0.0/16'],
    })
  })

  it('save() syncs local state from the POST response', async () => {
    api.setSysProxy.mockResolvedValue(
      state({ enabled: true, port: 7890, bypass: ['localhost'] }),
    )
    const sp = useSystemProxy()
    sp.enabled.value = true
    await sp.save()
    expect(sp.enabled.value).toBe(true)
    expect(sp.port.value).toBe(7890)
    expect(sp.bypassText.value).toBe('localhost')
  })

  it('toggle(false) sets enabled then saves (disable path)', async () => {
    api.setSysProxy.mockResolvedValue(state({ enabled: false }))
    const sp = useSystemProxy()
    sp.enabled.value = true
    await sp.toggle(false)
    expect(api.setSysProxy).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    )
    expect(sp.enabled.value).toBe(false)
  })
})
