import { createEffect, onCleanup } from 'solid-js'

// Hook to enable window focus refetch for existing signals
export const useWindowFocusRefetch = (
  refetchFn: () => void | Promise<void>,
  options: {
    enabled?: () => boolean
    staleTime?: number // Minimum time between refetches in ms
  } = {},
) => {
  const { enabled = () => true, staleTime = 30000 } = options
  let lastFetchTime = 0

  const handleFocus = async () => {
    if (!enabled()) return

    const now = Date.now()

    // Only refetch if enough time has passed since last fetch
    if (now - lastFetchTime >= staleTime) {
      lastFetchTime = now
      await refetchFn()
    }
  }

  createEffect(() => {
    if (!enabled()) return

    window.addEventListener('focus', handleFocus)
    // Also handle visibility change for tab switches
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus()
      }
    })

    onCleanup(() => {
      window.removeEventListener('focus', handleFocus)
    })
  })
}
