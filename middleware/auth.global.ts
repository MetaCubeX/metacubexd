export default defineNuxtRouteMiddleware((to) => {
  // Skip middleware on server
  if (import.meta.server) return

  const endpointStore = useEndpointStore()
  const hasEndpoint = !!endpointStore.currentEndpoint

  // Allow access to setup page without endpoint
  if (to.path === '/setup') {
    return
  }

  // Redirect to setup if no endpoint configured
  if (!hasEndpoint) {
    return navigateTo('/setup', { replace: true })
  }
})
