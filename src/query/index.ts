import { focusManager, QueryClient } from '@tanstack/solid-query'

// Setup focus manager to listen to visibility changes
if (typeof window !== 'undefined') {
  focusManager.setEventListener((handleFocus) => {
    const visibilitychangeHandler = () => {
      handleFocus(document.visibilityState === 'visible')
    }
    window.addEventListener('visibilitychange', visibilitychangeHandler, false)
    window.addEventListener('focus', () => handleFocus(true), false)

    return () => {
      window.removeEventListener('visibilitychange', visibilitychangeHandler)
      window.removeEventListener('focus', () => handleFocus(true))
    }
  })
}

// Create a query client with default options
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch when window gains focus
      refetchOnWindowFocus: true,
      // Refetch when reconnecting
      refetchOnReconnect: true,
      // Data is considered stale after 30 seconds
      staleTime: 30 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Retry delay increases with each attempt
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
})

// Query keys factory for type-safe and consistent query keys
export const queryKeys = {
  // Backend config
  backendConfig: ['backendConfig'] as const,
  backendVersion: ['backendVersion'] as const,

  // Proxies
  proxies: ['proxies'] as const,
  proxyProviders: ['proxyProviders'] as const,

  // Rules
  rules: ['rules'] as const,
  ruleProviders: ['ruleProviders'] as const,

  // Releases
  frontendRelease: (version: string) => ['frontendRelease', version] as const,
  backendRelease: (version: string) => ['backendRelease', version] as const,
  frontendReleases: (version: string) => ['frontendReleases', version] as const,
  backendReleases: (version: string) => ['backendReleases', version] as const,
} as const

export { QueryClientProvider, useQueryClient } from '@tanstack/solid-query'
