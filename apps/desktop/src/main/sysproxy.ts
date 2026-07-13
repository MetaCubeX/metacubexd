import type { SystemProxyController } from '@metacubexd/agent/types'
import { exec as nodeExec } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * Injected command runner. Mirrors `promisify(child_process.exec)` so tests can
 * substitute a recorder and assert the exact command strings issued — no test
 * ever shells out to the real OS. The default runs the real exec.
 */
export type ExecFn = (
  cmd: string,
) => Promise<{ stdout: string; stderr: string }>

const defaultExec: ExecFn = promisify(nodeExec)

function splitWhitespace(value: string): string[] {
  const fields: string[] = []
  let start = -1
  for (let i = 0; i <= value.length; i++) {
    const whitespace = i === value.length || value[i]!.trim() === ''
    if (!whitespace && start === -1) start = i
    if (whitespace && start !== -1) {
      fields.push(value.slice(start, i))
      start = -1
    }
  }
  return fields
}

export interface SystemProxyControllerOptions {
  host: string
  port: number
  /** Defaults to process.platform. */
  platform?: NodeJS.Platform
  /** Injected runner; defaults to promisify(child_process.exec). */
  exec?: ExecFn
}

/**
 * Build a per-OS SystemProxyController that points the system proxy at
 * `host:port`. OS specifics (networksetup / reg / gsettings) live here; the
 * shared UI reaches this through the agent's capability-gated /api/control
 * routes. All side effects go through the injected `exec`.
 *
 * NOTE: a system proxy left pointing at a stopped loopback port kills internet
 * for the whole machine — callers MUST disable() on quit.
 */
export function createSystemProxyController(
  opts: SystemProxyControllerOptions,
): SystemProxyController {
  const { host, port } = opts
  const platform = opts.platform ?? process.platform
  const exec = opts.exec ?? defaultExec

  // Last applied bypass list, surfaced via describe().
  let lastBypass: string[] = []

  const describe = () => ({ port, bypass: lastBypass })

  // ---- macOS (networksetup) ----

  // List enabled network services, skipping the informational header line and
  // any '*'-prefixed (disabled) service.
  async function darwinEnabledServices(): Promise<string[]> {
    const { stdout } = await exec('networksetup -listallnetworkservices')
    return stdout
      .split('\n')
      .slice(1) // drop the "An asterisk (*) denotes..." header
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('*'))
  }

  async function darwinEnable(bypass: string[]): Promise<void> {
    const services = await darwinEnabledServices()
    for (const svc of services) {
      await exec(`networksetup -setwebproxy "${svc}" ${host} ${port}`)
      await exec(`networksetup -setsecurewebproxy "${svc}" ${host} ${port}`)
      await exec(`networksetup -setsocksfirewallproxy "${svc}" ${host} ${port}`)
      await exec(`networksetup -setwebproxystate "${svc}" on`)
      await exec(`networksetup -setsecurewebproxystate "${svc}" on`)
      await exec(`networksetup -setsocksfirewallproxystate "${svc}" on`)
      if (bypass.length > 0) {
        await exec(
          `networksetup -setproxybypassdomains "${svc}" ${bypass.join(' ')}`,
        )
      }
    }
  }

  async function darwinDisable(): Promise<void> {
    const services = await darwinEnabledServices()
    for (const svc of services) {
      await exec(`networksetup -setwebproxystate "${svc}" off`)
      await exec(`networksetup -setsecurewebproxystate "${svc}" off`)
      await exec(`networksetup -setsocksfirewallproxystate "${svc}" off`)
      // Anti-lockout: also clear any PAC/auto-config so quit/disable can never
      // leave the machine pointing at a dead loopback PAC URL.
      await exec(`networksetup -setautoproxystate "${svc}" off`)
    }
  }

  async function darwinSetAutoProxy(url: string): Promise<void> {
    const services = await darwinEnabledServices()
    for (const svc of services) {
      await exec(`networksetup -setautoproxyurl "${svc}" ${url}`)
      await exec(`networksetup -setautoproxystate "${svc}" on`)
    }
  }

  async function darwinDisableAutoProxy(): Promise<void> {
    const services = await darwinEnabledServices()
    for (const svc of services) {
      await exec(`networksetup -setautoproxystate "${svc}" off`)
    }
  }

  async function darwinIsEnabled(): Promise<boolean> {
    const services = await darwinEnabledServices()
    const first = services[0]
    if (!first) return false
    const { stdout } = await exec(`networksetup -getwebproxy "${first}"`)
    return stdout.split('\n').some((line) => {
      const separator = line.indexOf(':')
      if (separator === -1) return false
      return (
        line.slice(0, separator).trim().toLowerCase() === 'enabled' &&
        line
          .slice(separator + 1)
          .trim()
          .toLowerCase() === 'yes'
      )
    })
  }

  // ---- Windows (reg) ----

  const WIN_KEY =
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

  // Quote REG_SZ /d payloads for cmd.exe + reg.exe. Without quotes, CIDR
  // suffixes (`/8`) look like extra reg switches and `<local>` is treated as
  // input redirection — both make enable() throw a 500 on Windows (#2116).
  // Embedded quotes use cmd's `""` escape (not bash-style `\"`).
  function winRegSz(value: string): string {
    return `"${value.replaceAll('"', '""')}"`
  }

  async function winEnable(bypass: string[]): Promise<void> {
    await exec(
      `reg add "${WIN_KEY}" /v ProxyServer /t REG_SZ /d ${winRegSz(`${host}:${port}`)} /f`,
    )
    await exec(`reg add "${WIN_KEY}" /v ProxyEnable /t REG_DWORD /d 1 /f`)
    if (bypass.length > 0) {
      const override = [...bypass, '<local>'].join(';')
      await exec(
        `reg add "${WIN_KEY}" /v ProxyOverride /t REG_SZ /d ${winRegSz(override)} /f`,
      )
    }
  }

  async function winDisable(): Promise<void> {
    await exec(`reg add "${WIN_KEY}" /v ProxyEnable /t REG_DWORD /d 0 /f`)
    // Anti-lockout: also clear any PAC/auto-config URL.
    await winDisableAutoProxy()
  }

  async function winSetAutoProxy(url: string): Promise<void> {
    // PAC and the fixed proxy are mutually exclusive in intent — point
    // AutoConfigURL at the PAC file and turn the manual proxy off.
    await exec(
      `reg add "${WIN_KEY}" /v AutoConfigURL /t REG_SZ /d ${winRegSz(url)} /f`,
    )
    await exec(`reg add "${WIN_KEY}" /v ProxyEnable /t REG_DWORD /d 0 /f`)
  }

  async function winDisableAutoProxy(): Promise<void> {
    try {
      await exec(`reg delete "${WIN_KEY}" /v AutoConfigURL /f`)
    } catch (err) {
      // Fresh installs often have no AutoConfigURL — treat missing as already
      // cleared so disable()/quit never 500 on a clean machine.
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.toLowerCase().includes('unable to find')) throw err
    }
  }

  async function winIsEnabled(): Promise<boolean> {
    try {
      const { stdout } = await exec(`reg query "${WIN_KEY}" /v ProxyEnable`)
      return stdout.split('\n').some((line) => {
        const [name, type, value] = splitWhitespace(line)
        return (
          name?.toLowerCase() === 'proxyenable' &&
          type?.toLowerCase() === 'reg_dword' &&
          Number.parseInt(value ?? '', 16) === 1
        )
      })
    } catch {
      return false
    }
  }

  // ---- Linux (GNOME / gsettings only) ----
  // Covers the GNOME desktop via gsettings; other desktop environments
  // (KDE, etc.) are NOT handled here.

  async function linuxEnable(bypass: string[]): Promise<void> {
    await exec("gsettings set org.gnome.system.proxy mode 'manual'")
    for (const scheme of ['http', 'https', 'socks'] as const) {
      await exec(
        `gsettings set org.gnome.system.proxy.${scheme} host '${host}'`,
      )
      await exec(`gsettings set org.gnome.system.proxy.${scheme} port ${port}`)
    }
    if (bypass.length > 0) {
      const literal = `[${bypass.map((h) => `'${h}'`).join(', ')}]`
      await exec(
        `gsettings set org.gnome.system.proxy ignore-hosts "${literal}"`,
      )
    }
  }

  async function linuxDisable(): Promise<void> {
    // mode 'none' clears both manual and auto (PAC) proxy — anti-lockout safe.
    await exec("gsettings set org.gnome.system.proxy mode 'none'")
  }

  async function linuxSetAutoProxy(url: string): Promise<void> {
    await exec("gsettings set org.gnome.system.proxy mode 'auto'")
    await exec(`gsettings set org.gnome.system.proxy autoconfig-url '${url}'`)
  }

  async function linuxDisableAutoProxy(): Promise<void> {
    await exec("gsettings set org.gnome.system.proxy mode 'none'")
  }

  async function linuxIsEnabled(): Promise<boolean> {
    const { stdout } = await exec('gsettings get org.gnome.system.proxy mode')
    return stdout.trim() === "'manual'"
  }

  function unsupported(): never {
    throw new Error(`unsupported platform for system proxy: ${platform}`)
  }

  return {
    describe,
    async enable(bypass = []) {
      lastBypass = bypass
      switch (platform) {
        case 'darwin':
          return darwinEnable(bypass)
        case 'win32':
          return winEnable(bypass)
        case 'linux':
          return linuxEnable(bypass)
        default:
          return unsupported()
      }
    },
    async disable() {
      switch (platform) {
        case 'darwin':
          return darwinDisable()
        case 'win32':
          return winDisable()
        case 'linux':
          return linuxDisable()
        default:
          return unsupported()
      }
    },
    async setAutoProxy(url) {
      switch (platform) {
        case 'darwin':
          return darwinSetAutoProxy(url)
        case 'win32':
          return winSetAutoProxy(url)
        case 'linux':
          return linuxSetAutoProxy(url)
        default:
          return unsupported()
      }
    },
    async disableAutoProxy() {
      switch (platform) {
        case 'darwin':
          return darwinDisableAutoProxy()
        case 'win32':
          return winDisableAutoProxy()
        case 'linux':
          return linuxDisableAutoProxy()
        default:
          return unsupported()
      }
    },
    async isEnabled() {
      switch (platform) {
        case 'darwin':
          return darwinIsEnabled()
        case 'win32':
          return winIsEnabled()
        case 'linux':
          return linuxIsEnabled()
        default:
          return unsupported()
      }
    },
  }
}
