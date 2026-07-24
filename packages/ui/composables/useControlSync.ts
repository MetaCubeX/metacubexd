// packages/ui/composables/useControlSync.ts
// The desktop main process mutates control state outside the SPA (tray system-
// proxy / TUN toggles, profile switches) and pokes the renderer back via the
// `backend:invalidate` IPC. vue-query-backed data (config/proxies/rules) is
// refetched centrally in desktop-sync.client.ts, but the capability composables
// (useTun / useSystemProxy / useProfiles) hold their state in local refs, so
// they would stay stale until the page is re-opened. This helper lets each of
// them re-run its loader when the backend reports a change, scoped to the
// composable's lifetime. A no-op on web builds (no bridge). (#2148)

interface MetacubexdBridge {
  isDesktop?: boolean
  onBackendInvalidate?: (cb: (payload: unknown) => void) => () => void
}

function readBridge(): MetacubexdBridge | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { metacubexd?: MetacubexdBridge }).metacubexd
}

/**
 * Subscribe `cb` to desktop backend-invalidate events. Returns the unsubscribe
 * fn (and auto-cleans via onScopeDispose when called inside an effect scope, so
 * composables can use it directly without manual teardown).
 */
export function onControlInvalidate(cb: () => void): () => void {
  const bridge = readBridge()
  const unsub = bridge?.isDesktop
    ? bridge.onBackendInvalidate?.(() => cb())
    : undefined
  if (!unsub) return () => {}
  // Clean up automatically when the owning component/composable scope dies, so
  // a long-lived bridge subscription can't outlive the page that needed it.
  if (getCurrentScope()) onScopeDispose(unsub)
  return unsub
}
