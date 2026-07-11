// packages/ui/plugins/desktop-sync.client.ts
// Keep the desktop panel's cached Clash config/proxies in sync when the main
// process mutates state outside the SPA (tray mode switch, profile activate,
// window re-focus). Web builds have no bridge and skip this plugin. (#2117)
import { useQueryClient } from '@tanstack/vue-query'
import { queryKeys } from '~/composables/useQueries'
import { useProxiesStore } from '~/stores/proxies'

interface BackendInvalidatePayload {
  reason?: string
}

interface MetacubexdBridge {
  isDesktop?: boolean
  onBackendInvalidate?: (
    cb: (payload: BackendInvalidatePayload) => void,
  ) => () => void
}

export default defineNuxtPlugin({
  name: 'desktop-sync',
  // vue-query registers QueryClient; we must run after it.
  dependsOn: ['vue-query'],
  setup() {
    const bridge =
      typeof window !== 'undefined'
        ? (window as unknown as { metacubexd?: MetacubexdBridge }).metacubexd
        : undefined
    if (!bridge?.isDesktop || !bridge.onBackendInvalidate) return

    const queryClient = useQueryClient()
    const proxiesStore = useProxiesStore()

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.config })
      void queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
      void queryClient.invalidateQueries({ queryKey: queryKeys.rules })
      void proxiesStore.fetchProxies().catch(() => {
        /* best-effort; ConnectionErrorBanner covers sustained failures */
      })
    }

    const unsub = bridge.onBackendInvalidate(() => refresh())

    // External Clash clients won't push through our IPC — refresh when the
    // panel regains focus so selected nodes / mode converge without a hard reload.
    // Throttle so alt-tabbing doesn't hammer GET /proxies + /configs.
    let lastFocusRefresh = 0
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusRefresh < 3000) return
      lastFocusRefresh = now
      refresh()
    }
    window.addEventListener('focus', onFocus)

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        unsub()
        window.removeEventListener('focus', onFocus)
      })
    }
  },
})
