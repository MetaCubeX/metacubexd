// packages/ui/composables/useBusyKeys.ts

// Tracks WHICH keyed actions are currently in flight, so each row/button can
// reflect only its OWN loading state instead of sharing one global `busy` ref
// that greys every control on the page. Keys are caller-defined strings, e.g.
// `activate:${id}` or `create`. Re-firing a key that is already in flight is
// ignored, which doubles as a cheap double-submit guard.
//
// Framework-free (no component instance needed) so it is unit-testable in
// isolation. A reactive Set drives the reactivity: `.has()` in a template or
// computed tracks reads; `.add()`/`.delete()` trigger updates.
export function useBusyKeys() {
  const keys = reactive(new Set<string>())

  const isBusy = (key: string) => keys.has(key)
  const anyBusy = computed(() => keys.size > 0)

  // Run `fn` while `key` is marked busy; always clears the key, even on reject
  // (the rejection still propagates so callers can surface their own error).
  const run = async (key: string, fn: () => Promise<unknown>) => {
    if (keys.has(key)) return
    keys.add(key)
    try {
      await fn()
    } finally {
      keys.delete(key)
    }
  }

  return { isBusy, anyBusy, run }
}
