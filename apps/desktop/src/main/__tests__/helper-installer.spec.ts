import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHelperInstaller } from '../helper/installer'

interface ExecResult {
  stdout: string
  stderr: string
}

/**
 * A scripted mock for the injected `exec` (un-elevated queries) and `elevate`
 * (the ONE privileged script per install/uninstall). Both record every command
 * string issued and default to empty stdout, so NO test ever shells out to the
 * real OS, installs a service, or triggers an elevation prompt.
 */
function makeRunners(responses: string[] = []) {
  const execCalls: string[] = []
  const elevateCalls: string[] = []
  const queue = [...responses]
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    execCalls.push(cmd)
    return { stdout: queue.shift() ?? '', stderr: '' }
  })
  const elevate = vi.fn(async (script: string): Promise<ExecResult> => {
    elevateCalls.push(script)
    return { stdout: queue.shift() ?? '', stderr: '' }
  })
  return { exec, elevate, execCalls, elevateCalls }
}

const PATHS = {
  label: 'io.github.metacubexd.helper',
  serviceName: 'metacubexd-helper',
  secretPath: '/etc/metacubexd/helper.secret',
}

const INSTALL_OPTS = {
  electronBin: '/Applications/metacubexd.app/Contents/MacOS/metacubexd',
  helperEntry:
    '/Applications/metacubexd.app/Contents/Resources/helper/index.js',
  socketPath: '/var/run/metacubexd-helper.sock',
  secret: 'shared-install-secret',
}

describe('createHelperInstaller', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('unknown platform', () => {
    it('throws on install/uninstall/isInstalled for an unsupported platform', async () => {
      const { exec, elevate } = makeRunners()
      const installer = createHelperInstaller({
        // 'aix' is a valid NodeJS.Platform but has no helper-install support.
        platform: 'aix',
        exec,
        elevate,
        paths: PATHS,
      })

      await expect(installer.install(INSTALL_OPTS)).rejects.toThrow(
        /unsupported platform/i,
      )
      await expect(installer.uninstall()).rejects.toThrow(
        /unsupported platform/i,
      )
      await expect(installer.isInstalled()).rejects.toThrow(
        /unsupported platform/i,
      )
    })
  })

  describe('macOS (darwin)', () => {
    function darwinInstaller(responses: string[] = []) {
      const runners = makeRunners(responses)
      const installer = createHelperInstaller({
        platform: 'darwin',
        exec: runners.exec,
        elevate: runners.elevate,
        paths: PATHS,
      })
      return { installer, ...runners }
    }

    it('install() runs the whole write+register through ONE elevate call', async () => {
      const { installer, elevateCalls, execCalls } = darwinInstaller()
      await installer.install(INSTALL_OPTS)

      // Everything privileged goes through exactly one elevation prompt.
      expect(elevateCalls).toHaveLength(1)
      // No un-elevated side effects during install.
      expect(execCalls).toHaveLength(0)
    })

    it('install() embeds a LaunchDaemon plist at the canonical path with the env + run command', async () => {
      const { installer, elevateCalls } = darwinInstaller()
      await installer.install(INSTALL_OPTS)

      const script = elevateCalls[0] ?? ''
      // Written to the canonical LaunchDaemons location, keyed by the label.
      expect(script).toContain(
        '/Library/LaunchDaemons/io.github.metacubexd.helper.plist',
      )
      // The plist body: label + the electron-as-node ProgramArguments.
      expect(script).toContain('<key>Label</key>')
      expect(script).toContain('<string>io.github.metacubexd.helper</string>')
      expect(script).toContain('<key>ProgramArguments</key>')
      expect(script).toContain(`<string>${INSTALL_OPTS.electronBin}</string>`)
      expect(script).toContain(`<string>${INSTALL_OPTS.helperEntry}</string>`)
      // Env: run electron as node + pass the socket + the secret-FILE PATH to
      // the helper. The plist must NOT embed the raw secret value (it would be
      // readable by other local users); only the path to the 0600 file.
      expect(script).toContain('<key>ELECTRON_RUN_AS_NODE</key>')
      expect(script).toContain('<key>MCXD_HELPER_SOCKET</key>')
      expect(script).toContain(`<string>${INSTALL_OPTS.socketPath}</string>`)
      expect(script).toContain('<key>MCXD_HELPER_SECRET_FILE</key>')
      expect(script).toContain(`<string>${PATHS.secretPath}</string>`)
      expect(script).not.toContain('<key>MCXD_HELPER_SECRET</key>')
      // Keep it alive as root.
      expect(script).toContain('<key>KeepAlive</key>')
      expect(script).toContain('<key>RunAtLoad</key>')
    })

    it('install() writes a root-owned 0600 (root-only) secret file then bootstraps the daemon', async () => {
      const { installer, elevateCalls } = darwinInstaller()
      await installer.install(INSTALL_OPTS)

      const script = elevateCalls[0] ?? ''
      // Secret written to the configured root-owned path with the secret value.
      expect(script).toContain(PATHS.secretPath)
      expect(script).toContain(INSTALL_OPTS.secret)
      // Written under umask 077 so it is 0600 from the first byte (never briefly
      // world-readable between the write and the chmod).
      expect(script).toMatch(/umask\s+0?77;[^\n]*printf[^\n]*helper\.secret/)
      // root-owned + 0600 (root-only): no other local user can read the secret.
      expect(script).toMatch(/chown\s+root[: ]/)
      expect(script).toMatch(
        /chmod\s+0?600\s+\/etc\/metacubexd\/helper\.secret/,
      )
      // Register the daemon with launchctl bootstrap system.
      expect(script).toContain(
        'launchctl bootstrap system /Library/LaunchDaemons/io.github.metacubexd.helper.plist',
      )
    })

    it('uninstall() bootouts the daemon then removes the plist + secret, through ONE elevate', async () => {
      const { installer, elevateCalls, execCalls } = darwinInstaller()
      await installer.uninstall()

      expect(elevateCalls).toHaveLength(1)
      expect(execCalls).toHaveLength(0)
      const script = elevateCalls[0] ?? ''
      expect(script).toContain(
        'launchctl bootout system /Library/LaunchDaemons/io.github.metacubexd.helper.plist',
      )
      expect(script).toContain(
        'rm -f /Library/LaunchDaemons/io.github.metacubexd.helper.plist',
      )
      expect(script).toContain(`rm -f ${PATHS.secretPath}`)
    })

    it('isInstalled() reports true when the LaunchDaemon plist exists (un-elevated check)', async () => {
      // launchctl print of the system domain lists the label when loaded.
      const { installer, execCalls, elevateCalls } = darwinInstaller([
        'io.github.metacubexd.helper => ...',
      ])
      const installed = await installer.isInstalled()
      expect(installed).toBe(true)
      // The probe is un-elevated and never prompts.
      expect(elevateCalls).toHaveLength(0)
      expect(execCalls).toHaveLength(1)
    })

    it('isInstalled() reports false when the daemon is absent', async () => {
      const { installer } = darwinInstaller([''])
      expect(await installer.isInstalled()).toBe(false)
    })
  })

  describe('linux (systemd)', () => {
    function linuxInstaller(responses: string[] = []) {
      const runners = makeRunners(responses)
      const installer = createHelperInstaller({
        platform: 'linux',
        exec: runners.exec,
        elevate: runners.elevate,
        paths: PATHS,
      })
      return { installer, ...runners }
    }

    it('install() runs the whole write+register through ONE elevate (pkexec) call', async () => {
      const { installer, elevateCalls, execCalls } = linuxInstaller()
      await installer.install(INSTALL_OPTS)
      expect(elevateCalls).toHaveLength(1)
      expect(execCalls).toHaveLength(0)
    })

    it('install() embeds a systemd unit at the canonical path with ExecStart + env', async () => {
      const { installer, elevateCalls } = linuxInstaller()
      await installer.install(INSTALL_OPTS)

      const script = elevateCalls[0] ?? ''
      expect(script).toContain('/etc/systemd/system/metacubexd-helper.service')
      expect(script).toContain('[Unit]')
      expect(script).toContain('[Service]')
      expect(script).toContain('[Install]')
      // ExecStart runs electron-as-node against the helper entry.
      expect(script).toContain(
        `ExecStart=${INSTALL_OPTS.electronBin} ${INSTALL_OPTS.helperEntry}`,
      )
      // Env passed via systemd Environment= directives — the secret-FILE PATH,
      // never the raw secret (the unit file is world-readable).
      expect(script).toContain('Environment=ELECTRON_RUN_AS_NODE=1')
      expect(script).toContain(
        `Environment=MCXD_HELPER_SOCKET=${INSTALL_OPTS.socketPath}`,
      )
      expect(script).toContain(
        `Environment=MCXD_HELPER_SECRET_FILE=${PATHS.secretPath}`,
      )
      expect(script).not.toContain(
        `Environment=MCXD_HELPER_SECRET=${INSTALL_OPTS.secret}`,
      )
      // Runs as root.
      expect(script).toContain('User=root')
    })

    it('install() writes the secret root-owned + app-readable then reloads/enables the unit', async () => {
      const { installer, elevateCalls } = linuxInstaller()
      await installer.install(INSTALL_OPTS)

      const script = elevateCalls[0] ?? ''
      expect(script).toContain(PATHS.secretPath)
      expect(script).toContain(INSTALL_OPTS.secret)
      // umask 077 so the secret file is 0600 from the first byte (no brief
      // world-readable window before the chmod).
      expect(script).toMatch(/umask\s+0?77;[^\n]*printf[^\n]*helper\.secret/)
      expect(script).toMatch(/chown\s+root[: ]/)
      expect(script).toMatch(
        /chmod\s+0?600\s+\/etc\/metacubexd\/helper\.secret/,
      )
      expect(script).toContain('systemctl daemon-reload')
      expect(script).toContain('systemctl enable --now metacubexd-helper')
    })

    it('uninstall() disables + removes the unit + secret through ONE elevate', async () => {
      const { installer, elevateCalls } = linuxInstaller()
      await installer.uninstall()

      const script = elevateCalls[0] ?? ''
      expect(script).toContain('systemctl disable --now metacubexd-helper')
      expect(script).toContain(
        'rm -f /etc/systemd/system/metacubexd-helper.service',
      )
      expect(script).toContain('systemctl daemon-reload')
      expect(script).toContain(`rm -f ${PATHS.secretPath}`)
    })

    it('isInstalled() reports true/false from systemctl is-enabled', async () => {
      const present = linuxInstaller(['enabled\n'])
      expect(await present.installer.isInstalled()).toBe(true)
      expect(present.elevateCalls).toHaveLength(0)
      expect(present.execCalls[0]).toContain(
        'systemctl is-enabled metacubexd-helper',
      )

      const absent = linuxInstaller([''])
      expect(await absent.installer.isInstalled()).toBe(false)
    })
  })

  describe('windows (win32)', () => {
    function winInstaller(responses: string[] = []) {
      const runners = makeRunners(responses)
      const installer = createHelperInstaller({
        platform: 'win32',
        exec: runners.exec,
        elevate: runners.elevate,
        paths: PATHS,
      })
      return { installer, ...runners }
    }

    it('install() creates an auto-start service via sc through ONE elevate (UAC) call', async () => {
      const { installer, elevateCalls, execCalls } = winInstaller()
      await installer.install(INSTALL_OPTS)

      expect(elevateCalls).toHaveLength(1)
      expect(execCalls).toHaveLength(0)

      const script = elevateCalls[0] ?? ''
      // sc create with the electron-as-node binPath + auto start.
      expect(script).toContain(
        `sc create metacubexd-helper binPath= "${INSTALL_OPTS.electronBin} ${INSTALL_OPTS.helperEntry}" start= auto`,
      )
      expect(script).toContain('sc start metacubexd-helper')
    })

    it('install() delivers env via the per-service registry key + writes an ACL-locked secret file', async () => {
      const { installer, elevateCalls } = winInstaller()
      await installer.install(INSTALL_OPTS)

      const script = elevateCalls[0] ?? ''
      // Per-service registry env (NOT machine-wide setx, which leaked to every
      // user and set the wrong var name). Carries the secret-FILE path, never
      // the secret value.
      expect(script).toContain(
        'reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\metacubexd-helper" /v Environment /t REG_MULTI_SZ',
      )
      expect(script).toContain('ELECTRON_RUN_AS_NODE=1')
      expect(script).toContain(`MCXD_HELPER_SOCKET=${INSTALL_OPTS.socketPath}`)
      expect(script).toContain(`MCXD_HELPER_SECRET_FILE=${PATHS.secretPath}`)
      // No machine-wide secret leak; the registry env never holds the value.
      expect(script).not.toContain('setx /M')
      expect(script).not.toContain(`MCXD_HELPER_SECRET=${INSTALL_OPTS.secret}`)
      // Secret written to the configured path, then locked to SYSTEM + admins.
      expect(script).toContain(PATHS.secretPath)
      expect(script).toContain(INSTALL_OPTS.secret)
      expect(script).toContain(`icacls "${PATHS.secretPath}" /inheritance:r`)
    })

    it('uninstall() stops + deletes the service through ONE elevate', async () => {
      const { installer, elevateCalls } = winInstaller()
      await installer.uninstall()

      const script = elevateCalls[0] ?? ''
      expect(script).toContain('sc stop metacubexd-helper')
      expect(script).toContain('sc delete metacubexd-helper')
    })

    it('isInstalled() reports true/false from sc query', async () => {
      const present = winInstaller([
        'SERVICE_NAME: metacubexd-helper\n  STATE : 4  RUNNING',
      ])
      expect(await present.installer.isInstalled()).toBe(true)
      expect(present.elevateCalls).toHaveLength(0)
      expect(present.execCalls[0]).toContain('sc query metacubexd-helper')

      const absent = winInstaller([
        '[SC] EnumQueryServicesStatus:OpenService FAILED 1060',
      ])
      expect(await absent.installer.isInstalled()).toBe(false)
    })
  })

  describe('installedVersion()', () => {
    it('returns the version reported by the injected helper version probe', async () => {
      const { exec, elevate } = makeRunners()
      const getVersion = vi.fn(async () => '1')
      const installer = createHelperInstaller({
        platform: 'darwin',
        exec,
        elevate,
        paths: PATHS,
        getVersion,
      })

      expect(await installer.installedVersion()).toBe('1')
      expect(getVersion).toHaveBeenCalledTimes(1)
    })

    it('returns undefined when no version probe is injected', async () => {
      const { exec, elevate } = makeRunners()
      const installer = createHelperInstaller({
        platform: 'linux',
        exec,
        elevate,
        paths: PATHS,
      })
      expect(await installer.installedVersion()).toBeUndefined()
    })
  })
})
