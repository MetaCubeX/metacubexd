// packages/ui/composables/__tests__/useKernelVersions.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKernelVersions } from '../useKernelVersions'

const api = {
  getKernelVersions: vi.fn(),
  switchKernel: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// hasFeature is driven by the gating probe; toggle it per test.
let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'kernel-version',
  }),
}))

// Failures must surface via toast — never swallowed. Hoisted so the mock
// factory (which runs before the module body) can reference it.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

const versions = (
  over: Partial<{
    versions: string[]
    current?: string
    bundled: string
  }> = {},
) => ({
  versions: ['v1.19.27', 'v1.19.0'],
  current: 'v1.19.27',
  bundled: 'v1.19.27',
  ...over,
})

describe('composables/useKernelVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    api.getKernelVersions.mockResolvedValue(versions())
    api.switchKernel.mockResolvedValue({ ok: true })
  })

  it('available reflects hasFeature(kernel-version) — true when present', () => {
    expect(useKernelVersions().available.value).toBe(true)
  })

  it('available is false when the kernel-version feature is absent', () => {
    featurePresent = false
    expect(useKernelVersions().available.value).toBe(false)
  })

  it('load() GETs the versions and populates versions/current/bundled', async () => {
    api.getKernelVersions.mockResolvedValue(
      versions({ versions: ['v1.19.27', 'v1.19.0'], current: 'v1.19.0' }),
    )
    const k = useKernelVersions()
    await k.load()
    expect(api.getKernelVersions).toHaveBeenCalled()
    expect(k.versions.value).toEqual(['v1.19.27', 'v1.19.0'])
    expect(k.current.value).toBe('v1.19.0')
    expect(k.bundled.value).toBe('v1.19.27')
    // The select defaults to the currently active version.
    expect(k.selected.value).toBe('v1.19.0')
  })

  it('switching() reflects the in-flight switch (controls disable while busy)', async () => {
    let resolveSwitch: () => void = () => {}
    api.switchKernel.mockReturnValue(
      new Promise<void>((res) => {
        resolveSwitch = res
      }),
    )
    const k = useKernelVersions()
    k.selected.value = 'v1.19.0'
    const p = k.switch()
    expect(k.switching.value).toBe(true)
    resolveSwitch()
    await p
    expect(k.switching.value).toBe(false)
  })

  it('switch() POSTs the selected version, refreshes, and toasts success', async () => {
    const k = useKernelVersions()
    await k.load()
    k.selected.value = 'v1.19.0'
    await k.switch()
    expect(api.switchKernel).toHaveBeenCalledWith('v1.19.0')
    // Re-reads the version list after a successful switch (the kernel restarts).
    expect(api.getKernelVersions).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('switch() surfaces failures via toast.error and clears the busy flag', async () => {
    api.switchKernel.mockRejectedValue(new Error('download failed'))
    const k = useKernelVersions()
    k.selected.value = 'v1.19.0'
    await k.switch()
    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(k.switching.value).toBe(false)
  })

  it('switch() is a no-op when nothing is selected', async () => {
    const k = useKernelVersions()
    k.selected.value = ''
    await k.switch()
    expect(api.switchKernel).not.toHaveBeenCalled()
  })

  it('load() surfaces a fetch failure via toast.error', async () => {
    api.getKernelVersions.mockRejectedValue(new Error('boom'))
    const k = useKernelVersions()
    await k.load()
    expect(toast.error).toHaveBeenCalled()
  })
})
