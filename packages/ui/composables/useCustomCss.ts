// Custom CSS injection (advanced users): persists a CSS string (config store /
// localStorage) and reflects it into a single managed <style> element in
// document.head. Pure frontend — works identically for hosted and desktop.

// id of the managed style element kept in sync with the persisted CSS.
export const CUSTOM_CSS_STYLE_ID = 'mcxd-custom-css'

// Module-scoped stop handle so repeated useCustomCss() calls keep exactly one
// active watcher (each mount re-wires; the previous watcher is torn down).
let stopWatch: (() => void) | null = null

// Inject / update / remove the managed <style> element to match `css`.
// Empty or whitespace-only CSS removes the element entirely.
export function applyCustomCss(css: string) {
  if (typeof document === 'undefined') return

  const existing = document.getElementById(CUSTOM_CSS_STYLE_ID)
  const trimmed = css.trim()

  if (!trimmed) {
    existing?.remove()
    return
  }

  if (existing) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }

  const style = document.createElement('style')
  style.id = CUSTOM_CSS_STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
}

export function useCustomCss() {
  const configStore = useConfigStore()
  const customCss = toRef(configStore, 'customCss')

  if (typeof document !== 'undefined') {
    // Re-wire a single immediate watcher each mount: immediate so the persisted
    // CSS is reflected synchronously, and re-created (after stopping the prior
    // one) so we never leak or duplicate watchers across mounts.
    stopWatch?.()
    stopWatch = watch(customCss, (value) => applyCustomCss(value ?? ''), {
      immediate: true,
    })
  }

  return {
    customCss,
    applyCustomCss,
  }
}
