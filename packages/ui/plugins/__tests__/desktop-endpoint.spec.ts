// packages/ui/plugins/__tests__/desktop-endpoint.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addEndpoint = vi.fn()
const setSelectedEndpoint = vi.fn()
const updateEndpoint = vi.fn()
const store: any = {
  selectedEndpoint: '',
  endpointList: [] as any[],
  addEndpoint,
  setSelectedEndpoint,
  updateEndpoint,
}
vi.mock('~/stores/endpoint', () => ({
  useEndpointStore: () => store,
}))

// Re-import per test so the plugin's default export runs fresh against the
// current window stub.
async function runPlugin() {
  vi.resetModules()
  const mod = await import('../desktop-endpoint.client')
  // Nuxt plugins default-export a function receiving the nuxtApp; we don't use
  // it, so pass an empty object.
  await (mod.default as any)({})
}

describe('plugins/desktop-endpoint.client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.selectedEndpoint = ''
    store.endpointList = []
    delete (globalThis as any).window
  })

  it('seeds local-mihomo and selects it when the bridge endpoint is present and no endpoint is selected', async () => {
    ;(globalThis as any).window = {
      metacubexd: {
        isDesktop: true,
        endpoint: { url: 'http://127.0.0.1:9090', secret: 's3cr3t' },
      },
    }
    await runPlugin()
    expect(addEndpoint).toHaveBeenCalledWith({
      id: 'local-mihomo',
      url: 'http://127.0.0.1:9090',
      secret: 's3cr3t',
      label: 'Local mihomo (desktop)',
    })
    expect(setSelectedEndpoint).toHaveBeenCalledWith('local-mihomo')
  })

  it('does nothing when there is no desktop bridge (web build)', async () => {
    ;(globalThis as any).window = { location: { origin: 'https://x' } }
    await runPlugin()
    expect(addEndpoint).not.toHaveBeenCalled()
    expect(setSelectedEndpoint).not.toHaveBeenCalled()
  })

  it('refreshes the persisted local-mihomo url+secret on relaunch (rotating secret)', async () => {
    // Control port is deterministic (21000) so the renderer origin is stable and
    // localStorage persists the local endpoint across launches — but boot()
    // regenerates the clash secret every launch. The stored secret goes stale and
    // the kernel 401s ("Backend Unreachable") unless we refresh it here.
    store.selectedEndpoint = 'local-mihomo'
    store.endpointList = [
      {
        id: 'local-mihomo',
        url: 'http://127.0.0.1:21001',
        secret: 'stale-secret',
        label: 'Local mihomo (desktop)',
      },
    ]
    ;(globalThis as any).window = {
      metacubexd: {
        isDesktop: true,
        endpoint: { url: 'http://127.0.0.1:21001', secret: 'fresh-secret' },
      },
    }
    await runPlugin()
    expect(updateEndpoint).toHaveBeenCalledWith('local-mihomo', {
      url: 'http://127.0.0.1:21001',
      secret: 'fresh-secret',
    })
    // It must not create a duplicate entry when one already exists.
    expect(addEndpoint).not.toHaveBeenCalled()
  })

  it('does not override an already-selected endpoint', async () => {
    store.selectedEndpoint = 'some-remote'
    ;(globalThis as any).window = {
      metacubexd: {
        isDesktop: true,
        endpoint: { url: 'http://127.0.0.1:9090', secret: 's3cr3t' },
      },
    }
    await runPlugin()
    expect(addEndpoint).not.toHaveBeenCalled()
    expect(setSelectedEndpoint).not.toHaveBeenCalled()
  })
})
