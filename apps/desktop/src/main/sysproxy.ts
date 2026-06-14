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
    }
  }

  async function darwinIsEnabled(): Promise<boolean> {
    const services = await darwinEnabledServices()
    const first = services[0]
    if (!first) return false
    const { stdout } = await exec(`networksetup -getwebproxy "${first}"`)
    return /Enabled:\s*Yes/i.test(stdout)
  }

  // ---- Windows (reg) ----

  const WIN_KEY =
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

  async function winEnable(bypass: string[]): Promise<void> {
    await exec(
      `reg add "${WIN_KEY}" /v ProxyServer /t REG_SZ /d ${host}:${port} /f`,
    )
    await exec(`reg add "${WIN_KEY}" /v ProxyEnable /t REG_DWORD /d 1 /f`)
    if (bypass.length > 0) {
      const override = [...bypass, '<local>'].join(';')
      await exec(
        `reg add "${WIN_KEY}" /v ProxyOverride /t REG_SZ /d ${override} /f`,
      )
    }
  }

  async function winDisable(): Promise<void> {
    await exec(`reg add "${WIN_KEY}" /v ProxyEnable /t REG_DWORD /d 0 /f`)
  }

  async function winIsEnabled(): Promise<boolean> {
    const { stdout } = await exec(`reg query "${WIN_KEY}" /v ProxyEnable`)
    return /ProxyEnable\s+REG_DWORD\s+0x1/i.test(stdout)
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
