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

/**
 * Register a global accelerator per action via the injected `globalShortcut`.
 * Custom `bindings` override the defaults per action; an empty accelerator skips
 * that action. The `globalShortcut` is injected so tests assert the
 * accelerator -> callback wiring without touching the real OS registry.
 */
export function registerHotkeys(opts: RegisterHotkeysOptions): void {
  const { globalShortcut, actions } = opts
  const bindings: HotkeyBindings = { ...DEFAULT_HOTKEYS, ...opts.bindings }
  for (const action of ACTION_KEYS) {
    const accelerator = bindings[action]
    if (!accelerator) continue // skip empty/disabled bindings
    globalShortcut.register(accelerator, actions[action])
  }
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
