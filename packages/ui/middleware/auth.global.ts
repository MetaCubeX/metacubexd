export default defineNuxtRouteMiddleware((to) => {
  // Skip middleware on server
  if (import.meta.server) return

  // Skip endpoint check in mock mode
  const config = useRuntimeConfig()
  if (config.public.mockMode) {
    return
  }

  const endpointStore = useEndpointStore()
  const hasEndpoint = !!endpointStore.currentEndpoint

  // The landing ('/') is the connection entry and '/setup' manages backends —
  // both stay reachable without a configured endpoint (and this avoids a
  // redirect loop when we send no-endpoint users to '/').
  if (to.path === '/' || to.path === '/setup') {
    return
  }

  // Redirect to the connection entry if no endpoint is configured
  if (!hasEndpoint) {
    return navigateTo('/', { replace: true })
  }
})
