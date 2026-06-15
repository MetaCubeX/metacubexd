// packages/ui/composables/__tests__/useTun.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTun } from '../useTun'

const api = {
  getTun: vi.fn(),
  setTun: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// hasFeature is driven by the gating probe; toggle it per test.
let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'tun',
  }),
}))

// Errors surface via toast — never swallowed.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

const status = (
  over: Partial<{
    enabled: boolean
    mode: 'sidecar' | 'tun'
    stack?: string
  }> = {},
) => ({
  enabled: false,
  mode: 'sidecar' as const,
  ...over,
})

describe('composables/useTun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.getTun.mockResolvedValue(status())
    api.setTun.mockResolvedValue(status())
  })

  it('available reflects hasFeature(tun) — true when the feature is present', () => {
    expect(useTun().available.value).toBe(true)
  })

  it('available is false when the tun feature is absent (remote backend)', () => {
    featurePresent = false
    expect(useTun().available.value).toBe(false)
  })

  it('load() GETs the tun status and populates status', async () => {
    api.getTun.mockResolvedValue(
      status({ enabled: true, mode: 'tun', stack: 'gvisor' }),
    )
    const tun = useTun()
    await tun.load()
    expect(api.getTun).toHaveBeenCalledOnce()
    expect(tun.status.value).toEqual({
      enabled: true,
      mode: 'tun',
      stack: 'gvisor',
    })
  })

  it('enable(stack) POSTs { enabled: true, stack } and syncs status', async () => {
    api.setTun.mockResolvedValue(
      status({ enabled: true, mode: 'tun', stack: 'system' }),
    )
    const tun = useTun()
    await tun.enable('system')
    expect(api.setTun).toHaveBeenCalledWith({ enabled: true, stack: 'system' })
    expect(tun.status.value).toEqual({
      enabled: true,
      mode: 'tun',
      stack: 'system',
    })
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('enable() omits stack when none is provided', async () => {
    const tun = useTun()
    await tun.enable()
    expect(api.setTun).toHaveBeenCalledWith({ enabled: true })
  })

  it('disable() POSTs { enabled: false } (recover-network) and syncs status', async () => {
    api.setTun.mockResolvedValue(status({ enabled: false, mode: 'sidecar' }))
    const tun = useTun()
    await tun.disable()
    expect(api.setTun).toHaveBeenCalledWith({ enabled: false })
    expect(tun.status.value).toEqual({ enabled: false, mode: 'sidecar' })
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('busy is true while enable() is in flight (install/elevation takes time)', async () => {
    let resolveSet: (v: unknown) => void = () => {}
    api.setTun.mockReturnValue(
      new Promise((res) => {
        resolveSet = res
      }),
    )
    const tun = useTun()
    const p = tun.enable('gvisor')
    expect(tun.busy.value).toBe(true)
    resolveSet(status({ enabled: true, mode: 'tun', stack: 'gvisor' }))
    await p
    expect(tun.busy.value).toBe(false)
  })

  it('busy is true while disable() is in flight', async () => {
    let resolveSet: (v: unknown) => void = () => {}
    api.setTun.mockReturnValue(
      new Promise((res) => {
        resolveSet = res
      }),
    )
    const tun = useTun()
    const p = tun.disable()
    expect(tun.busy.value).toBe(true)
    resolveSet(status())
    await p
    expect(tun.busy.value).toBe(false)
  })

  it('load() surfaces failures via toast.error (no swallowing) and clears busy', async () => {
    api.getTun.mockRejectedValue(new Error('access denied'))
    const tun = useTun()
    await tun.load()
    expect(toast.error).toHaveBeenCalled()
    expect(tun.busy.value).toBe(false)
  })

  it('enable() surfaces failures via toast.error (no swallowing) and clears busy', async () => {
    api.setTun.mockRejectedValue(new Error('helper install rejected'))
    const tun = useTun()
    await tun.enable('gvisor')
    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(tun.busy.value).toBe(false)
  })

  it('disable() surfaces failures via toast.error (no swallowing) and clears busy', async () => {
    api.setTun.mockRejectedValue(new Error('teardown failed'))
    const tun = useTun()
    await tun.disable()
    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(tun.busy.value).toBe(false)
  })
})
