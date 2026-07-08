/**
 * Cross-platform "open at login" controller behind one interface, so the tray
 * checkbox works on every OS:
 *
 *  - macOS / Windows: Electron's app.get/setLoginItemSettings, registered with
 *    the `--hidden` arg so a login-launch starts minimized to the tray (see
 *    shouldStartHidden in startup.ts).
 *  - Linux: app.setLoginItemSettings is a documented NO-OP, so the checkbox
 *    silently did nothing there. The freedesktop way is an XDG autostart entry
 *    (~/.config/autostart/<name>.desktop) — written/removed here.
 *
 * Everything OS-touching is injected (Electron app slice, fs slice, env) so the
 * per-platform wiring is unit-testable without Electron or a real disk.
 */

/** argv token that requests a hidden (tray-only) launch (startup.ts contract). */
const HIDDEN_FLAG = '--hidden'

export interface LoginItemController {
  /** Whether the app is currently registered to start at login. */
  isEnabled: () => boolean
  /** Register (true) / unregister (false) the login item. */
  setEnabled: (enabled: boolean) => void
}

/** The slice of Electron's `app` the darwin/win32 path needs. */
export interface LoginItemAppLike {
  getLoginItemSettings: () => { openAtLogin: boolean }
  setLoginItemSettings: (settings: {
    openAtLogin: boolean
    args: string[]
  }) => void
}

/** Minimal fs surface for the Linux XDG autostart path (injectable). */
export interface AutostartFsLike {
  existsSync: (p: string) => boolean
  mkdirSync: (p: string) => void
  writeFileSync: (p: string, data: string) => void
  unlinkSync: (p: string) => void
}

export interface LinuxAutostartOptions {
  fs: AutostartFsLike
  /** XDG autostart dir, e.g. ~/.config/autostart (caller resolves XDG_CONFIG_HOME). */
  autostartDir: string
  /**
   * The executable the .desktop entry launches. For AppImage builds this must
   * be the .AppImage path (process.env.APPIMAGE), NOT process.execPath — the
   * latter points inside the transient mount that disappears after exit.
   */
  execPath: string
  /** Entry base name (also the .desktop file name). */
  name: string
}

/**
 * Escape one argument for a .desktop `Exec=` line (freedesktop Desktop Entry
 * spec: quote the arg, backslash-escape the reserved characters inside).
 */
export function desktopExecArg(arg: string): string {
  return `"${arg.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`
}

/** Render the XDG autostart .desktop entry content. */
export function buildAutostartDesktopEntry(
  execPath: string,
  name: string,
): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${name}`,
    `Exec=${desktopExecArg(execPath)} ${HIDDEN_FLAG}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
}

/** Linux: register via an XDG autostart .desktop file. */
export function createLinuxAutostart(
  opts: LinuxAutostartOptions,
): LoginItemController {
  const { fs, autostartDir, execPath, name } = opts
  const entryPath = `${autostartDir}/${name}.desktop`
  return {
    isEnabled: () => fs.existsSync(entryPath),
    setEnabled(enabled) {
      if (enabled) {
        if (!fs.existsSync(autostartDir)) fs.mkdirSync(autostartDir)
        fs.writeFileSync(entryPath, buildAutostartDesktopEntry(execPath, name))
      } else if (fs.existsSync(entryPath)) {
        fs.unlinkSync(entryPath)
      }
    },
  }
}

/** macOS / Windows: delegate to Electron's login-item settings. */
export function createElectronLoginItem(
  app: LoginItemAppLike,
): LoginItemController {
  return {
    isEnabled: () => app.getLoginItemSettings().openAtLogin,
    setEnabled(enabled) {
      // Always register with `--hidden` so a login-launch starts minimized to
      // the tray (shouldStartHidden reads it back).
      app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_FLAG] })
    },
  }
}

export interface CreateLoginItemOptions {
  platform: NodeJS.Platform
  app: LoginItemAppLike
  linux: LinuxAutostartOptions
}

/** Pick the per-platform controller. */
export function createLoginItemController(
  opts: CreateLoginItemOptions,
): LoginItemController {
  return opts.platform === 'linux'
    ? createLinuxAutostart(opts.linux)
    : createElectronLoginItem(opts.app)
}
