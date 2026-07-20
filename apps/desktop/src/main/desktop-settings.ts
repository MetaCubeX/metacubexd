import type { FsLike } from './paths'

/**
 * Desktop-shell preferences persisted under `<userData>/desktop-settings.json`.
 * These are HOST-level knobs (main-process behavior) — dashboard/UI settings
 * live in the renderer's own storage. Every field has a safe default so a
 * missing/corrupt file never blocks boot.
 */
export interface DesktopSettings {
  /** Delayed silent update check after launch (notification-only). */
  silentUpdateCheck: boolean
  /**
   * Re-enable TUN automatically at boot when the last session ended in TUN
   * mode AND the privileged helper is already installed (never elevates
   * unattended). Off by default — auto-elevation-free or not, rerouting the
   * whole machine at login is opt-in.
   */
  tunAutoRestore: boolean
  /** Live up/down rate in the tray (macOS menu-bar title + tooltip line). */
  showTraySpeed: boolean
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  silentUpdateCheck: true,
  tunAutoRestore: false,
  showTraySpeed: true,
}

const SETTING_KEYS = Object.keys(
  DEFAULT_DESKTOP_SETTINGS,
) as (keyof DesktopSettings)[]

/**
 * Read the persisted settings merged over the defaults. Non-boolean values are
 * ignored per key; a missing or malformed file yields the defaults. Pure /
 * fs-injected so it is unit-testable without touching disk.
 */
export function loadDesktopSettings(path: string, fs: FsLike): DesktopSettings {
  const result: DesktopSettings = { ...DEFAULT_DESKTOP_SETTINGS }
  if (!fs.existsSync(path)) return result
  try {
    const parsed = JSON.parse(fs.readFileSync(path)) as unknown
    if (parsed && typeof parsed === 'object') {
      const overrides = parsed as Record<string, unknown>
      for (const key of SETTING_KEYS) {
        const value = overrides[key]
        if (typeof value === 'boolean') result[key] = value
      }
    }
  } catch {
    /* fall through to defaults on malformed JSON */
  }
  return result
}

/**
 * Merge a partial patch (unknown-typed — it crosses the IPC boundary) over the
 * current settings, accepting only known boolean keys. Returns the next
 * settings object; the caller persists + applies side effects.
 */
export function mergeDesktopSettings(
  current: DesktopSettings,
  patch: unknown,
): DesktopSettings {
  const next: DesktopSettings = { ...current }
  if (patch && typeof patch === 'object') {
    const overrides = patch as Record<string, unknown>
    for (const key of SETTING_KEYS) {
      const value = overrides[key]
      if (typeof value === 'boolean') next[key] = value
    }
  }
  return next
}

/** Persist the settings JSON (pretty-printed for hand-editing). */
export function saveDesktopSettings(
  path: string,
  fs: FsLike,
  settings: DesktopSettings,
): void {
  fs.writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`)
}
