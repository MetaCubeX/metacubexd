// packages/ui/plugins/desktop-endpoint.client.ts
import { useEndpointStore } from '~/stores/endpoint'

// Desktop preload bridge shape (SHARED CONTRACTS, owned by Plan 04).
interface MetacubexdBridge {
  isDesktop?: boolean
  endpoint?: { url: string; secret: string }
}

const LOCAL_ID = 'local-mihomo'

export default defineNuxtPlugin(() => {
  const w =
    typeof window !== 'undefined'
      ? (window as unknown as { metacubexd?: MetacubexdBridge })
      : undefined
  const bridge = w?.metacubexd?.endpoint
  if (!bridge?.url) return // web build / no desktop bridge => today's behaviour

  const store = useEndpointStore()
  const existing = store.endpointList.find((e) => e.id === LOCAL_ID)

  if (existing) {
    // The control port is deterministic (21000) so the renderer origin — and
    // thus localStorage — is stable across launches, but boot() rotates the
    // clash secret (and may shift the port) every launch. Refresh the persisted
    // managed endpoint to the current bridge values; otherwise the stale secret
    // makes the kernel 401 and the UI shows "Backend Unreachable" despite a
    // healthy kernel. Only the *selection* is guarded below, never the values.
    if (existing.url !== bridge.url || existing.secret !== bridge.secret) {
      store.updateEndpoint(LOCAL_ID, { url: bridge.url, secret: bridge.secret })
    }
    if (!store.selectedEndpoint) store.setSelectedEndpoint(LOCAL_ID)
    return
  }

  // First seed: only auto-select when the user has not already chosen another
  // endpoint, so we never clobber an existing selection (selectedEndpoint is a
  // string id, '' default).
  if (store.selectedEndpoint) return

  store.addEndpoint({
    id: LOCAL_ID,
    url: bridge.url,
    secret: bridge.secret,
    label: 'Local mihomo (desktop)',
  })
  store.setSelectedEndpoint(LOCAL_ID)
})
