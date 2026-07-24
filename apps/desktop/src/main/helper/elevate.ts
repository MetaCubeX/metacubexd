/**
 * Per-OS elevation runner used by the privileged-helper installer.
 *
 * The installer generates a platform-specific install/uninstall *script* and
 * hands it here for ONE elevation prompt. macOS uses osascript, Linux uses
 * pkexec, Windows uses UAC via PowerShell `Start-Process -Verb RunAs`.
 *
 * IMPORTANT: the script itself does NOT carry privilege — `sc create` /
 * `systemctl` / writing LaunchDaemons all need the elevate wrapper. Running
 * the raw script through a plain `exec` on Windows/Linux was the #2116 TUN
 * 500 (Access Denied on `sc create` / writing HKLM).
 *
 * All side effects go through the injected `exec` + `fs` so tests assert the
 * exact elevated command strings without prompting or touching disk.
 */

import {
  unlinkSync as nodeUnlinkSync,
  writeFileSync as nodeWriteFileSync,
} from 'node:fs'
import { tmpdir as nodeTmpdir } from 'node:os'
import { join as nodeJoin } from 'node:path'

export type ExecFn = (
  cmd: string,
) => Promise<{ stdout: string; stderr: string }>

/** Minimal fs surface the Windows temp-script path needs. */
export interface ElevateFs {
  writeFileSync: (path: string, data: string) => void
  unlinkSync: (path: string) => void
  tmpdir: () => string
  join: (...parts: string[]) => string
}

export interface CreateHelperElevateOptions {
  platform: NodeJS.Platform
  exec: ExecFn
  /** Injected fs; defaults to node:fs + os.tmpdir + path.join. */
  fs?: ElevateFs
  /** Override the temp .cmd basename (tests); defaults to a unique name. */
  tempName?: () => string
}

const defaultFs: ElevateFs = {
  writeFileSync: nodeWriteFileSync,
  unlinkSync: nodeUnlinkSync,
  tmpdir: nodeTmpdir,
  join: nodeJoin,
}

/** Escape a string for embedding inside a single-quoted bash literal. */
function shSingleQuote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`
}

/** Escape a path for embedding inside a PowerShell single-quoted string. */
function psSingleQuote(s: string): string {
  return `'${s.replaceAll("'", "''")}'`
}

/**
 * Build the elevate function for the given platform. Unknown platforms throw
 * when invoked (mirrors the installer's unsupported-platform contract).
 */
export function createHelperElevate(
  opts: CreateHelperElevateOptions,
): (script: string) => Promise<{ stdout: string; stderr: string }> {
  const { platform, exec } = opts
  const fs = opts.fs ?? defaultFs
  const tempName =
    opts.tempName ?? (() => `mcxd-elevate-${process.pid}-${Date.now()}.cmd`)

  return async (script: string) => {
    switch (platform) {
      case 'darwin': {
        // Escape for embedding inside an AppleScript string literal.
        const escaped = script.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
        return exec(
          `osascript -e 'do shell script "${escaped}" with administrator privileges'`,
        )
      }
      case 'linux': {
        // ONE PolicyKit prompt. The install script needs root for systemd unit
        // writes + systemctl; pkexec is what actually elevates.
        return exec(`pkexec /bin/bash -c ${shSingleQuote(script)}`)
      }
      case 'win32': {
        // Write the multi-line install script to a temp .cmd, then ShellExecute
        // it with the runas verb so UAC prompts. Plain `exec(script)` has no
        // elevation and `sc create` / HKLM writes fail with Access Denied.
        const tmpPath = fs.join(fs.tmpdir(), tempName())
        fs.writeFileSync(tmpPath, script)
        // Resolve PowerShell by ABSOLUTE path. Electron sometimes spawns the
        // elevate with a reduced PATH (and some installs omit System32 from the
        // user PATH), so the bare `powershell` lookup fails with "'powershell'
        // is not recognized as an internal or external command", breaking every
        // helper install + TUN enable (#2149). The canonical binary lives under
        // %SystemRoot%\System32\WindowsPowerShell\v1.0.
        const root =
          process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows'
        const powershell = `${root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
        try {
          return await exec(
            `"${powershell}" -NoProfile -NonInteractive -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c',${psSingleQuote(tmpPath)} -Verb RunAs -Wait -WindowStyle Hidden"`,
          )
        } finally {
          try {
            fs.unlinkSync(tmpPath)
          } catch {
            /* best-effort cleanup */
          }
        }
      }
      default:
        throw new Error(`unsupported platform for helper elevate: ${platform}`)
    }
  }
}
