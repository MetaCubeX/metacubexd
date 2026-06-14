import ky from 'ky'

// packages/ui/composables/__tests__/useControlApi.spec.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveControlConfig, useControlApi } from '../useControlApi'

// We test the pure resolver in isolation; ky is mocked so no network happens.
const kyExtend = vi.fn()
vi.mock('ky', () => ({
  default: { create: vi.fn(() => ({ extend: kyExtend })) },
}))

describe('composables/useControlApi resolveControlConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (globalThis as any).window
  })
  afterEach(() => {
    delete (globalThis as any).window
  })

  it('uses the desktop bridge base+token when window.metacubexd.control is set', () => {
    ;(globalThis as any).window = {
      metacubexd: {
        isDesktop: true,
        control: { base: 'http://127.0.0.1:8123/api/control', token: 'abc' },
      },
      location: { origin: 'file://' },
    }
    const cfg = resolveControlConfig()
    expect(cfg.base).toBe('http://127.0.0.1:8123/api/control')
    expect(cfg.token).toBe('abc')
  })

  it('falls back to same-origin /api/control with no token when no bridge', () => {
    ;(globalThis as any).window = {
      location: { origin: 'https://dash.example.com' },
    }
    const cfg = resolveControlConfig()
    expect(cfg.base).toBe('https://dash.example.com/api/control')
    expect(cfg.token).toBeUndefined()
  })

  it('builds a ky client with the Authorization header when a token is present', () => {
    ;(globalThis as any).window = {
      metacubexd: { control: { base: 'http://x/api/control', token: 'tok' } },
      location: { origin: 'file://' },
    }
    useControlApi()
    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: 'http://x/api/control',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
      }),
    )
  })
})
