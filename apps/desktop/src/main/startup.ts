/** Subset of Electron's `LoginItemSettings` we care about for silent start. */
export interface LoginSettings {
  /** macOS/Windows signal that the OS auto-launched the app at login. */
  wasOpenedAtLogin?: boolean
}

/** argv token that requests a hidden (tray-only) launch. */
const HIDDEN_FLAG = '--hidden'

/**
 * Decide whether the app should start minimized to the tray (window not shown).
 *
 * True when the launch was a login-launch — either because the OS reports it
 * via `wasOpenedAtLogin`, or because the login item was registered with the
 * `--hidden` arg (see tray.ts "Open at login"). Pure so it is fully unit-testable
 * without standing up Electron.
 */
export function shouldStartHidden(
  argv: readonly string[],
  loginSettings: LoginSettings,
): boolean {
  return argv.includes(HIDDEN_FLAG) || loginSettings.wasOpenedAtLogin === true
}
