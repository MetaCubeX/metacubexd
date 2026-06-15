// packages/ui/composables/useWindowControls.ts
import { getCurrentScope, onScopeDispose } from 'vue'
import { useDesktop } from './useDesktop'

/**
 * Reactive window-control state for the custom title bar. Seeds the maximized
 * flag from the live window (it may reopen already maximized), then keeps it in
 * sync via the main-process maximize/unmaximize events. Uses onScopeDispose (not
 * onUnmounted) so the subscription tears down in any effect scope — including
 * unit tests — exactly like useBackendWebSocket does.
 */
export function useWindowControls() {
  const { windowControls } = useDesktop()
  const isMaximized = ref(false)

  // Seed from the live window state; best-effort (default false is safe).
  void Promise.resolve(windowControls.isMaximized())
    .then((v) => {
      isMaximized.value = v
    })
    .catch(() => {})

  // Stay in sync with the real window; unsubscribe when the scope disposes.
  const off = windowControls.onMaximizeChange((v) => {
    isMaximized.value = v
  })
  if (getCurrentScope()) onScopeDispose(off)

  return {
    isMaximized,
    minimize: () => windowControls.minimize(),
    toggleMaximize: () => windowControls.toggleMaximize(),
    close: () => windowControls.close(),
  }
}
