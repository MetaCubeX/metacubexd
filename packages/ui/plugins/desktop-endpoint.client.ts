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
  // Only auto-seed when the user has not already chosen an endpoint, so we never
  // clobber an existing selection (selectedEndpoint is a string id, '' default).
  if (store.selectedEndpoint) return

  store.addEndpoint({
    id: LOCAL_ID,
    url: bridge.url,
    secret: bridge.secret,
    label: 'Local mihomo (desktop)',
  })
  store.setSelectedEndpoint(LOCAL_ID)
})
