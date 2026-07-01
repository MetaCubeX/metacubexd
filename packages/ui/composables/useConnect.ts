import type { EndpointCheckError } from '~/composables/useApi'
import { checkEndpointAPI } from '~/composables/useApi'
import { FALLBACK_BACKEND_URL } from '~/constants'
import { randomUUID, transformEndpointURL } from '~/utils'

// Single source of truth for connecting to a Mihomo backend. Shared by the
// landing entry (`/`, pages/index.vue) and the manager (`/setup`, pages/setup.vue)
// so the connect flow can never drift between the two screens.
export function useConnect() {
  const router = useRouter()
  const endpointStore = useEndpointStore()
  const runtimeConfig = useRuntimeConfig()

  const endpointError = ref<EndpointCheckError>(null)
  const isSubmitting = ref(false)

  // Live state of the automatic default-backend probe, surfaced as an
  // instrument-style status readout on the connect form.
  const probeState = ref<'idle' | 'probing' | 'unreachable'>('idle')
  const probeTarget = ref('')

  // Priority: runtime config (NUXT_PUBLIC_DEFAULT_BACKEND_URL) > config.js > fallback
  const defaultBackendURL = computed(() => {
    if (runtimeConfig.public.defaultBackendURL) {
      return runtimeConfig.public.defaultBackendURL as string
    }
    if (
      typeof window !== 'undefined' &&
      (window as any).__METACUBEXD_CONFIG__?.defaultBackendURL
    ) {
      return (window as any).__METACUBEXD_CONFIG__.defaultBackendURL as string
    }
    return FALLBACK_BACKEND_URL
  })

  function onSuccess(id: string) {
    endpointStore.setSelectedEndpoint(id)
    router.replace('/overview')
  }

  // Probe a backend, then save + select it and navigate on success.
  // Returns true on connect, false on error. A silent attempt (the automatic
  // default-backend probe) never sets the error banner or the loading spinner,
  // so the entry never greets a first-timer with a manufactured failure.
  async function connect(
    url: string,
    secret: string,
    options: { silent?: boolean; shouldNavigate?: () => boolean } = {},
  ): Promise<boolean> {
    const { silent = false, shouldNavigate } = options
    if (!silent) {
      isSubmitting.value = true
      endpointError.value = null
    }

    try {
      const transformedURL = transformEndpointURL(url)

      const error = await checkEndpointAPI(transformedURL, secret)
      if (error) {
        if (!silent) endpointError.value = error
        return false
      }

      // Only persist + select + navigate when we're actually connecting the
      // user. A silent probe the user has since bypassed (focused/edited the
      // form) leaves no trace — no stray endpoint, no navigation.
      if (!shouldNavigate || shouldNavigate()) {
        const id = randomUUID()
        const list = [...endpointStore.endpointList]
        const existing = list.find((history) => history.url === transformedURL)

        if (!existing) {
          endpointStore.setEndpointList([
            { id, url: transformedURL, secret },
            ...list,
          ])
        } else {
          // Reuse the saved entry, refresh its secret + id.
          existing.secret = secret
          existing.id = id
          endpointStore.setEndpointList(list)
        }

        onSuccess(id)
      }
      return true
    } finally {
      // A silent probe never set isSubmitting, so it must not clear a
      // concurrent user submit's spinner when it resolves.
      if (!silent) isSubmitting.value = false
    }
  }

  // Re-probe an already-saved endpoint, then select + navigate on success.
  async function selectEndpoint(id: string): Promise<boolean> {
    const endpoint = endpointStore.endpointList.find((e) => e.id === id)
    if (!endpoint) return false

    // Surface the re-probe on the shared status readout (statusConnecting)
    // instead of leaving it reading "idle" during the up-to-5s check.
    isSubmitting.value = true
    endpointError.value = null
    try {
      const error = await checkEndpointAPI(endpoint.url, endpoint.secret)
      if (error) {
        endpointError.value = error
        return false
      }
      onSuccess(id)
      return true
    } finally {
      isSubmitting.value = false
    }
  }

  // Zero-click connect on first load: honor a `?hostname` deep-link, else
  // (when `tryDefault`) attempt the default backend once if nothing is saved.
  // The attempted url/secret are written into `formData` first, so the fields
  // stay populated for a retry when the probe fails. No-ops in mock mode — the
  // app runs without a real backend there (matching the auth middleware).
  async function autoLogin(
    query: Record<string, any>,
    formData: { url: string; secret: string },
    options: { tryDefault?: boolean; shouldNavigate?: () => boolean } = {},
  ): Promise<void> {
    if (runtimeConfig.public.mockMode) return

    const { tryDefault = true, shouldNavigate } = options
    const hostname = query?.hostname

    if (hostname) {
      const protocol = query.http
        ? 'http:'
        : query.https
          ? 'https:'
          : typeof window !== 'undefined'
            ? window.location.protocol
            : 'http:'
      const port = query.port ? `:${query.port}` : ''

      formData.url = `${protocol}//${hostname}${port}`
      formData.secret = query.secret || ''
      await connect(formData.url, formData.secret)
      return
    }

    if (tryDefault && endpointStore.endpointList.length === 0) {
      formData.url = defaultBackendURL.value
      formData.secret = ''
      probeTarget.value = transformEndpointURL(defaultBackendURL.value)
      probeState.value = 'probing'
      // Silent: the default backend is a guess, not the user's request, so a
      // failed probe reports as an amber "no backend detected" readout rather
      // than painting a red error onto a fresh first-run screen.
      const ok = await connect(formData.url, formData.secret, {
        silent: true,
        shouldNavigate,
      })
      // If the user engaged mid-probe, a miss degrades to the idle prompt
      // rather than a stuck amber warning pointing at the default they bypassed.
      const engaged = shouldNavigate ? !shouldNavigate() : false
      probeState.value = ok || engaged ? 'idle' : 'unreachable'
    }
  }

  return {
    endpointError,
    isSubmitting,
    probeState,
    probeTarget,
    defaultBackendURL,
    connect,
    selectEndpoint,
    autoLogin,
  }
}
