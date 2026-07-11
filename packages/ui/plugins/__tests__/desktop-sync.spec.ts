// packages/ui/plugins/__tests__/desktop-sync.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invalidateQueries = vi.fn()
const fetchProxies = vi.fn(() => Promise.resolve())

vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}))

vi.mock('~/stores/proxies', () => ({
  useProxiesStore: () => ({ fetchProxies }),
}))

vi.mock('~/composables/useQueries', () => ({
  queryKeys: {
    config: ['config'],
    proxies: ['proxies'],
    rules: ['rules'],
  },
}))

async function runPlugin() {
  vi.resetModules()
  const mod = await import('../desktop-sync.client')
  const plugin = mod.default as {
    setup: () => void | Promise<void>
  }
  await plugin.setup()
}

describe('plugins/desktop-sync.client', () => {
  let invalidateCb: ((payload: { reason?: string }) => void) | null = null
  let focusHandler: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCb = null
    focusHandler = null
    delete (globalThis as { window?: unknown }).window
  })

  it('no-ops when the desktop bridge is absent', async () => {
    ;(globalThis as { window: object }).window = {}
    await runPlugin()
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it('invalidates config/proxies/rules and refetches proxies on backend:invalidate', async () => {
    ;(globalThis as { window: object }).window = {
      metacubexd: {
        isDesktop: true,
        onBackendInvalidate: (cb: (p: { reason?: string }) => void) => {
          invalidateCb = cb
          return () => {}
        },
      },
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'focus') focusHandler = handler
      },
      removeEventListener: vi.fn(),
    }
    await runPlugin()

    expect(invalidateCb).toBeTypeOf('function')
    invalidateCb!({ reason: 'mode' })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['config'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['proxies'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['rules'] })
    expect(fetchProxies).toHaveBeenCalled()
  })

  it('also refreshes on window focus for external Clash clients', async () => {
    ;(globalThis as { window: object }).window = {
      metacubexd: {
        isDesktop: true,
        onBackendInvalidate: () => () => {},
      },
      addEventListener: (type: string, handler: () => void) => {
        if (type === 'focus') focusHandler = handler
      },
      removeEventListener: vi.fn(),
    }
    await runPlugin()

    expect(focusHandler).toBeTypeOf('function')
    focusHandler!()
    expect(fetchProxies).toHaveBeenCalled()
  })
})
