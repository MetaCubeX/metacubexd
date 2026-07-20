import type { FsLike } from './paths'

/** The three global-hotkey actions the desktop app exposes. */
export interface HotkeyActions {
  /** Toggle the OS system proxy on/off. */
  toggleSystemProxy: () => void
  /** Cycle the kernel proxy mode rule -> global -> direct -> rule. */
  cycleProxyMode: () => void
  /** Show the window when hidden, hide it when visible. */
  toggleWindow: () => void
}

/** Accelerator string per action (Electron accelerator syntax). */
export type HotkeyBindings = Record<keyof HotkeyActions, string>

/**
 * Default global accelerators. Chosen to be distinct and unlikely to clash with
 * common OS/app shortcuts (CommandOrControl+Shift+<letter>). Overridable per
 * action via `<userData>/hotkeys.json` (see {@link loadHotkeyBindings}).
 */
export const DEFAULT_HOTKEYS: HotkeyBindings = {
  toggleSystemProxy: 'CommandOrControl+Shift+P',
  cycleProxyMode: 'CommandOrControl+Shift+M',
  toggleWindow: 'CommandOrControl+Shift+W',
}

/** Minimal slice of Electron's GlobalShortcut the registrar needs. */
export interface GlobalShortcutLike {
  register: (accelerator: string, callback: () => void) => boolean
  unregisterAll: () => void
}

export interface RegisterHotkeysOptions {
  globalShortcut: GlobalShortcutLike
  actions: HotkeyActions
  /**
   * Partial overrides merged over {@link DEFAULT_HOTKEYS}; any action not listed
   * keeps its default accelerator. An empty-string accelerator skips that action.
   */
  bindings?: Partial<HotkeyBindings>
}

const ACTION_KEYS: readonly (keyof HotkeyActions)[] = [
  'toggleSystemProxy',
  'cycleProxyMode',
  'toggleWindow',
]

/** The action list, exported for the settings IPC/UI to iterate. */
export const HOTKEY_ACTION_KEYS = ACTION_KEYS

/** One accelerator that could not be registered (taken by another app / invalid). */
export interface FailedHotkey {
  action: keyof HotkeyActions
  accelerator: string
}

export interface HotkeyRegistrationResult {
  /** Actions whose accelerator registered successfully. */
  registered: (keyof HotkeyActions)[]
  /**
   * Actions whose accelerator did NOT register: `register()` returned false
   * (already owned by another app / the OS) or threw (malformed accelerator in
   * a user-edited hotkeys.json). The caller surfaces these — a silently dead
   * hotkey is indistinguishable from a broken app to the user.
   */
  failed: FailedHotkey[]
}

/**
 * Register a global accelerator per action via the injected `globalShortcut`.
 * Custom `bindings` override the defaults per action; an empty accelerator skips
 * that action. The `globalShortcut` is injected so tests assert the
 * accelerator -> callback wiring without touching the real OS registry.
 * Returns which actions registered and which failed (conflict/invalid) so the
 * caller can notify instead of the shortcut dying silently.
 */
export function registerHotkeys(
  opts: RegisterHotkeysOptions,
): HotkeyRegistrationResult {
  const { globalShortcut, actions } = opts
  const bindings: HotkeyBindings = { ...DEFAULT_HOTKEYS, ...opts.bindings }
  const result: HotkeyRegistrationResult = { registered: [], failed: [] }
  for (const action of ACTION_KEYS) {
    const accelerator = bindings[action]
    if (!accelerator) continue // skip empty/disabled bindings
    let ok = false
    try {
      ok = globalShortcut.register(accelerator, actions[action])
    } catch {
      // Electron throws on a syntactically invalid accelerator string (a typo
      // in a hand-edited hotkeys.json) — report it like a conflict.
      ok = false
    }
    if (ok) result.registered.push(action)
    else result.failed.push({ action, accelerator })
  }
  return result
}

/**
 * Sanitize an unknown-typed bindings patch (it crosses the IPC boundary) into a
 * full HotkeyBindings: known actions with string values only, merged over the
 * defaults. An empty string survives — it means "disable this hotkey".
 */
export function sanitizeHotkeyBindings(patch: unknown): HotkeyBindings {
  const result: HotkeyBindings = { ...DEFAULT_HOTKEYS }
  if (patch && typeof patch === 'object') {
    const overrides = patch as Record<string, unknown>
    for (const action of ACTION_KEYS) {
      const value = overrides[action]
      if (typeof value === 'string') result[action] = value.trim()
    }
  }
  return result
}

/**
 * Persist the bindings to `<userData>/hotkeys.json` (the same file
 * {@link loadHotkeyBindings} reads). The full record is written so the file is
 * self-describing and hand-editable.
 */
export function saveHotkeyBindings(
  path: string,
  fs: FsLike,
  bindings: HotkeyBindings,
): void {
  fs.writeFileSync(path, `${JSON.stringify(bindings, null, 2)}\n`)
}

/**
 * Read per-action accelerator overrides from `<userData>/hotkeys.json` (shape:
 * `Partial<HotkeyBindings>`), merged over {@link DEFAULT_HOTKEYS}. Non-string
 * values are ignored; a missing or malformed file yields the defaults. Pure /
 * fs-injected so it is unit-testable without touching disk.
 */
export function loadHotkeyBindings(path: string, fs: FsLike): HotkeyBindings {
  if (!fs.existsSync(path)) return { ...DEFAULT_HOTKEYS }
  try {
    const parsed = JSON.parse(fs.readFileSync(path)) as unknown
    const result: HotkeyBindings = { ...DEFAULT_HOTKEYS }
    if (parsed && typeof parsed === 'object') {
      const overrides = parsed as Record<string, unknown>
      for (const action of ACTION_KEYS) {
        const value = overrides[action]
        if (typeof value === 'string') result[action] = value
      }
    }
    return result
  } catch {
    /* fall through to defaults on malformed JSON */
  }
  return { ...DEFAULT_HOTKEYS }
}
