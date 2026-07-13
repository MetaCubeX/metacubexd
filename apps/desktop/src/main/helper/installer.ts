/**
 * Per-OS privileged-helper install / uninstall — COMMAND GENERATION ONLY (spec
 * §12.4). This module composes the privileged service definition that runs the
 * bundled Electron binary as Node (`ELECTRON_RUN_AS_NODE=1`) against the helper
 * entry, as root/admin, and the secret-file write + service registration —
 * then hands the whole thing to an INJECTED `elevate` (ONE elevation prompt per
 * install/uninstall). It NEVER installs a service, elevates, or spawns a
 * privileged process itself: every side effect goes through the injected
 * `exec` / `elevate`, so tests assert the generated commands + service-
 * definition contents without ever touching the real OS.
 *
 * Real service install / elevation / privileged run is verified ONLY on real
 * machines (B-3 + user smoke), NOT here.
 */

/**
 * Injected un-elevated command runner (mirrors `promisify(child_process.exec)`).
 * Used for the cheap `isInstalled()` probe, which never needs privilege.
 */
export type ExecFn = (
  cmd: string,
) => Promise<{ stdout: string; stderr: string }>

/**
 * Injected elevation runner: takes a single shell script and runs it with
 * administrator privileges (ONE prompt). Real impl: mac `osascript ... with
 * administrator privileges`, linux `pkexec`, win UAC `Start-Process -Verb
 * RunAs` (see `helper/elevate.ts`). Tests record the script and never prompt.
 * The script itself is NOT privileged — elevate must wrap it.
 */
export type ElevateFn = (
  script: string,
) => Promise<{ stdout: string; stderr: string }>

/** Injected helper version probe (e.g. the helper client's `getVersion`). */
export type GetVersionFn = () => Promise<string>

export interface HelperInstallerPaths {
  /** LaunchDaemon label / service identifier (darwin). */
  label: string
  /** systemd unit / Windows service name (linux/win32). */
  serviceName: string
  /**
   * Root-owned, ROOT-ONLY (0600 / SYSTEM-ACL'd) path the per-install shared
   * secret is written to during install. The privileged helper reads it as root;
   * no other local user can. The app uses its own user-owned copy under userData
   * (it does not read this file). (spec §12.3)
   */
  secretPath: string
}

export interface HelperInstallOptions {
  /** Absolute path to the bundled Electron binary (run as Node). */
  electronBin: string
  /** Absolute path to the bundled helper entry (`out/helper/index.js`). */
  helperEntry: string
  /** Local socket / named-pipe path the helper listens on. */
  socketPath: string
  /** Per-install shared secret stamped onto every IPC request. */
  secret: string
}

export interface CreateHelperInstallerOptions {
  /** Defaults to process.platform. */
  platform: NodeJS.Platform
  /** Injected un-elevated runner (isInstalled probe). */
  exec: ExecFn
  /** Injected elevation runner (the ONE privileged script). */
  elevate: ElevateFn
  /** Service identifiers + secret destination path. */
  paths: HelperInstallerPaths
  /** Optional version probe; without it `installedVersion()` returns undefined. */
  getVersion?: GetVersionFn
}

export interface HelperInstaller {
  /** Generate + run (via ONE elevate) the per-OS privileged install. */
  install: (opts: HelperInstallOptions) => Promise<void>
  /** Symmetric teardown (via ONE elevate). */
  uninstall: () => Promise<void>
  /** Cheap, un-elevated probe of whether the service is registered. */
  isInstalled: () => Promise<boolean>
  /** The installed helper's reported version (undefined if no probe injected). */
  installedVersion: () => Promise<string | undefined>
}

/** macOS: the canonical LaunchDaemons plist path for a label. */
function launchDaemonPlistPath(label: string): string {
  return `/Library/LaunchDaemons/${label}.plist`
}

/** linux: the canonical systemd unit path for a service name. */
function systemdUnitPath(serviceName: string): string {
  return `/etc/systemd/system/${serviceName}.service`
}

/**
 * Compose the LaunchDaemon plist body: run the bundled Electron as Node against
 * the helper entry, with the env the helper reads (socket + secret), kept alive
 * as root.
 */
function buildLaunchDaemonPlist(
  label: string,
  opts: HelperInstallOptions,
  secretPath: string,
): string {
  // The env carries the PATH to the 0600 root-owned secret file, NOT the secret
  // value — the plist itself is root-owned but readable enough that embedding the
  // secret here would expose it to other local users (the cross-user privesc the
  // helper auth is meant to prevent). The helper reads the file as root.
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${opts.electronBin}</string>
    <string>${opts.helperEntry}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ELECTRON_RUN_AS_NODE</key>
    <string>1</string>
    <key>MCXD_HELPER_SOCKET</key>
    <string>${opts.socketPath}</string>
    <key>MCXD_HELPER_SECRET_FILE</key>
    <string>${secretPath}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>`
}

/**
 * Compose the systemd unit body: run the bundled Electron as Node against the
 * helper entry as root, with the helper env, enabled at boot.
 */
function buildSystemdUnit(
  opts: HelperInstallOptions,
  secretPath: string,
): string {
  // Carry the PATH to the 0600 root-owned secret file, not the secret value —
  // /etc/systemd/system unit files are world-readable, so an inline secret would
  // leak to every local user. The helper reads the file as root.
  return `[Unit]
Description=metacubexd privileged TUN helper
After=network.target

[Service]
Type=simple
User=root
Environment=ELECTRON_RUN_AS_NODE=1
Environment=MCXD_HELPER_SOCKET=${opts.socketPath}
Environment=MCXD_HELPER_SECRET_FILE=${secretPath}
ExecStart=${opts.electronBin} ${opts.helperEntry}
Restart=on-failure

[Install]
WantedBy=multi-user.target`
}

/**
 * Single-quote a string for safe inclusion in a POSIX `sh -c` heredoc/command.
 * Wrap in single quotes and escape embedded single quotes the standard way.
 */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Build the per-OS privileged install/uninstall script + the un-elevated
 * isInstalled probe. Unknown platform throws (no dispatch path).
 */
export function createHelperInstaller(
  opts: CreateHelperInstallerOptions,
): HelperInstaller {
  const { platform, exec, elevate, paths, getVersion } = opts
  const { label, serviceName, secretPath } = paths

  function unsupported(): never {
    throw new Error(`unsupported platform for helper install: ${platform}`)
  }

  // ---- macOS (LaunchDaemon + launchctl) ----

  function darwinInstallScript(o: HelperInstallOptions): string {
    const plistPath = launchDaemonPlistPath(label)
    const plist = buildLaunchDaemonPlist(label, o, secretPath)
    // ONE elevated script: write the secret root-owned + 0600 (root-only — the
    // helper reads it as root; no other local user may read it), write the
    // plist, then bootstrap the daemon into the system domain.
    return [
      `mkdir -p $(dirname ${shQuote(secretPath)})`,
      // Create the secret already-restricted: under `umask 077` the redirection
      // makes the file 0600 from the first byte, so the secret is NEVER briefly
      // world-readable between the write and the chmod (the chmod below stays as
      // an explicit belt-and-braces guarantee).
      `(umask 077; printf '%s' ${shQuote(o.secret)} > ${secretPath})`,
      `chown root: ${secretPath}`,
      `chmod 0600 ${secretPath}`,
      `cat > ${plistPath} <<'MCXD_PLIST_EOF'\n${plist}\nMCXD_PLIST_EOF`,
      `chown root:wheel ${plistPath}`,
      `chmod 0644 ${plistPath}`,
      `launchctl bootstrap system ${plistPath}`,
    ].join('\n')
  }

  function darwinUninstallScript(): string {
    const plistPath = launchDaemonPlistPath(label)
    return [
      `launchctl bootout system ${plistPath} || true`,
      `rm -f ${plistPath}`,
      `rm -f ${secretPath}`,
    ].join('\n')
  }

  async function darwinIsInstalled(): Promise<boolean> {
    const { stdout } = await exec(`launchctl print system/${label}`)
    return stdout.includes(label)
  }

  // ---- Linux (systemd + pkexec) ----

  function linuxInstallScript(o: HelperInstallOptions): string {
    const unitPath = systemdUnitPath(serviceName)
    const unit = buildSystemdUnit(o, secretPath)
    return [
      `mkdir -p $(dirname ${shQuote(secretPath)})`,
      // umask 077 -> the file is 0600 from the first byte, so the secret is never
      // briefly world-readable between write and chmod (chmod stays explicit).
      `(umask 077; printf '%s' ${shQuote(o.secret)} > ${secretPath})`,
      `chown root: ${secretPath}`,
      // 0600: root-only. The helper reads it as root; the world-readable unit
      // file carries only the PATH, never the secret value.
      `chmod 0600 ${secretPath}`,
      `cat > ${unitPath} <<'MCXD_UNIT_EOF'\n${unit}\nMCXD_UNIT_EOF`,
      `chmod 0644 ${unitPath}`,
      `systemctl daemon-reload`,
      `systemctl enable --now ${serviceName}`,
    ].join('\n')
  }

  function linuxUninstallScript(): string {
    const unitPath = systemdUnitPath(serviceName)
    return [
      `systemctl disable --now ${serviceName} || true`,
      `rm -f ${unitPath}`,
      `systemctl daemon-reload`,
      `rm -f ${secretPath}`,
    ].join('\n')
  }

  async function linuxIsInstalled(): Promise<boolean> {
    try {
      const { stdout } = await exec(`systemctl is-enabled ${serviceName}`)
      return /\benabled\b/.test(stdout)
    } catch (err) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 4 // not-found
      ) {
        return false
      }
      throw err
    }
  }

  // ---- Windows (sc + UAC runas) ----
  // NOTE: the named pipe is secured by an ACL granting the app's user read/write
  // and denying everyone else; the ACL is applied on the pipe at create time by
  // the helper (server-side), the service definition below only registers the
  // auto-start service + its env. The Windows branch is logic-only here.

  function winInstallScript(o: HelperInstallOptions): string {
    // sc create the auto-start service (runs as LocalSystem). Deliver its env via
    // the PER-SERVICE registry key (visible only to the service + admins) — NOT a
    // machine-wide `setx /M`, which was readable by every user AND set the wrong
    // variable name (MCXD_HELPER_ENV), so the service never actually received its
    // env. The secret lives ONLY in a SYSTEM-only ACL'd file; the registry env
    // carries the file PATH (MCXD_HELPER_SECRET_FILE), never the secret value.
    const serviceKey = `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${serviceName}`
    const envMultiSz = [
      'ELECTRON_RUN_AS_NODE=1',
      `MCXD_HELPER_SOCKET=${o.socketPath}`,
      `MCXD_HELPER_SECRET_FILE=${secretPath}`,
    ].join('\\0') // REG_MULTI_SZ separator for reg.exe
    return [
      `sc create ${serviceName} binPath= "${o.electronBin} ${o.helperEntry}" start= auto`,
      `reg add "${serviceKey}" /v Environment /t REG_MULTI_SZ /d "${envMultiSz}" /f`,
      `(echo ${o.secret})> "${secretPath}"`,
      `icacls "${secretPath}" /inheritance:r /grant:r "SYSTEM:(R)" "Administrators:(R)"`,
      `sc start ${serviceName}`,
    ].join('\r\n')
  }

  function winUninstallScript(): string {
    return [
      `sc stop ${serviceName}`,
      `sc delete ${serviceName}`,
      `del /f /q "${secretPath}"`,
    ].join('\r\n')
  }

  async function winIsInstalled(): Promise<boolean> {
    const { stdout } = await exec(`sc query ${serviceName}`)
    return stdout.includes(serviceName) && !/FAILED\s+1060/i.test(stdout)
  }

  return {
    async install(installOpts: HelperInstallOptions) {
      switch (platform) {
        case 'darwin':
          await elevate(darwinInstallScript(installOpts))
          return
        case 'linux':
          await elevate(linuxInstallScript(installOpts))
          return
        case 'win32':
          await elevate(winInstallScript(installOpts))
          return
        default:
          return unsupported()
      }
    },
    async uninstall() {
      switch (platform) {
        case 'darwin':
          await elevate(darwinUninstallScript())
          return
        case 'linux':
          await elevate(linuxUninstallScript())
          return
        case 'win32':
          await elevate(winUninstallScript())
          return
        default:
          return unsupported()
      }
    },
    async isInstalled() {
      switch (platform) {
        case 'darwin':
          return darwinIsInstalled()
        case 'linux':
          return linuxIsInstalled()
        case 'win32':
          return winIsInstalled()
        default:
          return unsupported()
      }
    },
    async installedVersion() {
      if (!getVersion) return undefined
      return getVersion()
    },
  }
}
