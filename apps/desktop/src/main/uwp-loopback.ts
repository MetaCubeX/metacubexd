import { exec as nodeExec } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * Windows UWP loopback-exemption helper.
 *
 * UWP / AppContainer apps (Edge, the Store, mail, etc.) are blocked by Windows
 * from reaching loopback (127.0.0.1) addresses. To proxy them through a local
 * mihomo listener, each app's package family name must be exempted from that
 * isolation via the built-in `CheckNetIsolation` tool:
 *
 *   list:    CheckNetIsolation LoopbackExempt -s
 *   exempt:  CheckNetIsolation LoopbackExempt -a -n=<packageFamilyName>
 *   remove:  CheckNetIsolation LoopbackExempt -d -n=<packageFamilyName>
 *
 * This module only generates and runs those commands; enumerating installed
 * UWP apps for a picker UI is out of scope (the main process exposes the
 * capability; the renderer supplies the package family name).
 *
 * WINDOWS-ONLY: `CheckNetIsolation` ships only on win32, so every operation
 * throws on other platforms. This was authored and unit-tested on macOS; the
 * generated command strings are asserted by tests but the real Windows runtime
 * behavior has NOT been verified on a Windows host.
 */

/**
 * Injected command runner. Mirrors `promisify(child_process.exec)` so tests can
 * substitute a recorder and assert the exact command strings issued — no test
 * ever shells out to the real OS. The default runs the real exec.
 */
export type ExecFn = (
  cmd: string,
) => Promise<{ stdout: string; stderr: string }>

const defaultExec: ExecFn = promisify(nodeExec)

export interface UwpLoopbackOptions {
  /** Defaults to process.platform. */
  platform?: NodeJS.Platform
  /** Injected runner; defaults to promisify(child_process.exec). */
  exec?: ExecFn
}

export interface UwpLoopback {
  /** Raw `CheckNetIsolation LoopbackExempt -s` stdout (currently exempted apps). */
  list: () => Promise<string>
  /** Add a loopback exemption for the given package family name. */
  exempt: (packageFamilyName: string) => Promise<void>
  /** Remove the loopback exemption for the given package family name. */
  remove: (packageFamilyName: string) => Promise<void>
}

export function createUwpLoopback(opts: UwpLoopbackOptions = {}): UwpLoopback {
  const platform = opts.platform ?? process.platform
  const exec = opts.exec ?? defaultExec

  function ensureWindows(): void {
    if (platform !== 'win32') {
      throw new Error(
        `UWP loopback exemption is Windows-only (CheckNetIsolation); ` +
          `unsupported platform: ${platform}`,
      )
    }
  }

  function ensurePackage(packageFamilyName: string): string {
    const pkg = packageFamilyName.trim()
    if (pkg.length === 0) {
      throw new Error('a non-empty package name is required')
    }
    return pkg
  }

  return {
    async list() {
      ensureWindows()
      const { stdout } = await exec('CheckNetIsolation LoopbackExempt -s')
      return stdout
    },
    async exempt(packageFamilyName) {
      ensureWindows()
      const pkg = ensurePackage(packageFamilyName)
      await exec(`CheckNetIsolation LoopbackExempt -a -n=${pkg}`)
    },
    async remove(packageFamilyName) {
      ensureWindows()
      const pkg = ensurePackage(packageFamilyName)
      await exec(`CheckNetIsolation LoopbackExempt -d -n=${pkg}`)
    },
  }
}
