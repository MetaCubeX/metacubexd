import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSystemProxyController } from '../sysproxy'

interface ExecResult {
  stdout: string
  stderr: string
}

/**
 * A scripted mock exec: queue up canned stdout responses (matched in order) and
 * record every command string issued. Defaults to empty stdout when the queue
 * runs dry so command-only assertions don't need to script returns.
 */
function makeExec(responses: string[] = []) {
  const calls: string[] = []
  const queue = [...responses]
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    calls.push(cmd)
    return { stdout: queue.shift() ?? '', stderr: '' }
  })
  return { exec, calls }
}

const DARWIN_SERVICES = [
  'An asterisk (*) denotes that a network service is disabled.',
  'Wi-Fi',
  '*Bluetooth PAN',
  'Thunderbolt Bridge',
].join('\n')

describe('createSystemProxyController', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('macOS (darwin)', () => {
    it('enable() sets web/secureweb/socks proxy + state on every enabled service', async () => {
      const { exec, calls } = makeExec([DARWIN_SERVICES])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })

      await ctrl.enable()

      // First call lists the services.
      expect(calls[0]).toBe('networksetup -listallnetworkservices')
      // Disabled (*-prefixed) services and the header line are skipped — only
      // Wi-Fi and Thunderbolt Bridge get configured.
      const enabledServices = ['Wi-Fi', 'Thunderbolt Bridge']
      for (const svc of enabledServices) {
        expect(calls).toContain(
          `networksetup -setwebproxy "${svc}" 127.0.0.1 7890`,
        )
        expect(calls).toContain(
          `networksetup -setsecurewebproxy "${svc}" 127.0.0.1 7890`,
        )
        expect(calls).toContain(
          `networksetup -setsocksfirewallproxy "${svc}" 127.0.0.1 7890`,
        )
        expect(calls).toContain(`networksetup -setwebproxystate "${svc}" on`)
        expect(calls).toContain(
          `networksetup -setsecurewebproxystate "${svc}" on`,
        )
        expect(calls).toContain(
          `networksetup -setsocksfirewallproxystate "${svc}" on`,
        )
      }
      // The disabled service must never be touched.
      expect(calls.some((c) => c.includes('Bluetooth PAN'))).toBe(false)
    })

    it('enable(bypass) sets the proxy bypass domains per service', async () => {
      const { exec, calls } = makeExec([DARWIN_SERVICES])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })

      await ctrl.enable(['localhost', '127.0.0.1', '*.local'])

      expect(calls).toContain(
        'networksetup -setproxybypassdomains "Wi-Fi" localhost 127.0.0.1 *.local',
      )
      expect(calls).toContain(
        'networksetup -setproxybypassdomains "Thunderbolt Bridge" localhost 127.0.0.1 *.local',
      )
    })

    it('disable() turns the three proxy states off for every enabled service', async () => {
      const { exec, calls } = makeExec([DARWIN_SERVICES])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })

      await ctrl.disable()

      expect(calls[0]).toBe('networksetup -listallnetworkservices')
      for (const svc of ['Wi-Fi', 'Thunderbolt Bridge']) {
        expect(calls).toContain(`networksetup -setwebproxystate "${svc}" off`)
        expect(calls).toContain(
          `networksetup -setsecurewebproxystate "${svc}" off`,
        )
        expect(calls).toContain(
          `networksetup -setsocksfirewallproxystate "${svc}" off`,
        )
      }
    })

    it('isEnabled() parses the first service web proxy state', async () => {
      const { exec, calls } = makeExec([
        DARWIN_SERVICES,
        'Enabled: Yes\nServer: 127.0.0.1\nPort: 7890\nAuthenticated Proxy Enabled: 0',
      ])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(true)
      expect(calls).toContain('networksetup -getwebproxy "Wi-Fi"')
    })

    it('isEnabled() returns false when the first service web proxy is off', async () => {
      const { exec } = makeExec([
        DARWIN_SERVICES,
        'Enabled: No\nServer: \nPort: 0',
      ])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(false)
    })
  })

  describe('windows (win32)', () => {
    const KEY =
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

    it('enable() writes ProxyServer + ProxyEnable=1', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'win32',
        exec,
      })

      await ctrl.enable()

      expect(calls).toContain(
        `reg add "${KEY}" /v ProxyServer /t REG_SZ /d 127.0.0.1:7890 /f`,
      )
      expect(calls).toContain(
        `reg add "${KEY}" /v ProxyEnable /t REG_DWORD /d 1 /f`,
      )
    })

    it('enable(bypass) writes ProxyOverride joined by ; including <local>', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'win32',
        exec,
      })

      await ctrl.enable(['localhost', '127.0.0.1'])

      expect(calls).toContain(
        `reg add "${KEY}" /v ProxyOverride /t REG_SZ /d localhost;127.0.0.1;<local> /f`,
      )
    })

    it('disable() writes ProxyEnable=0', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'win32',
        exec,
      })

      await ctrl.disable()

      expect(calls).toContain(
        `reg add "${KEY}" /v ProxyEnable /t REG_DWORD /d 0 /f`,
      )
    })

    it('isEnabled() queries ProxyEnable and parses 0x1', async () => {
      const { exec, calls } = makeExec([
        '\r\nHKEY_CURRENT_USER\\...\\Internet Settings\r\n    ProxyEnable    REG_DWORD    0x1\r\n',
      ])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'win32',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(true)
      expect(calls).toContain(`reg query "${KEY}" /v ProxyEnable`)
    })

    it('isEnabled() returns false for 0x0', async () => {
      const { exec } = makeExec(['\r\n    ProxyEnable    REG_DWORD    0x0\r\n'])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'win32',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(false)
    })
  })

  describe('linux (GNOME/gsettings)', () => {
    it('enable() sets manual mode + http/https/socks host+port', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'linux',
        exec,
      })

      await ctrl.enable()

      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy mode 'manual'",
      )
      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy.http host '127.0.0.1'",
      )
      expect(calls).toContain(
        'gsettings set org.gnome.system.proxy.http port 7890',
      )
      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy.https host '127.0.0.1'",
      )
      expect(calls).toContain(
        'gsettings set org.gnome.system.proxy.https port 7890',
      )
      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy.socks host '127.0.0.1'",
      )
      expect(calls).toContain(
        'gsettings set org.gnome.system.proxy.socks port 7890',
      )
    })

    it('enable(bypass) sets ignore-hosts as a gsettings array literal', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'linux',
        exec,
      })

      await ctrl.enable(['localhost', '127.0.0.1'])

      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy ignore-hosts \"['localhost', '127.0.0.1']\"",
      )
    })

    it('disable() sets mode none', async () => {
      const { exec, calls } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'linux',
        exec,
      })

      await ctrl.disable()

      expect(calls).toContain(
        "gsettings set org.gnome.system.proxy mode 'none'",
      )
    })

    it('isEnabled() returns true when mode is manual', async () => {
      const { exec, calls } = makeExec(["'manual'\n"])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'linux',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(true)
      expect(calls).toContain('gsettings get org.gnome.system.proxy mode')
    })

    it('isEnabled() returns false when mode is none', async () => {
      const { exec } = makeExec(["'none'\n"])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'linux',
        exec,
      })

      await expect(ctrl.isEnabled()).resolves.toBe(false)
    })
  })

  describe('pAC / auto-config (setAutoProxy / disableAutoProxy)', () => {
    const PAC_URL = 'http://127.0.0.1:7890/proxy.pac'

    describe('macOS (darwin)', () => {
      it('setAutoProxy() points autoproxyurl + turns autoproxystate on per enabled service', async () => {
        const { exec, calls } = makeExec([DARWIN_SERVICES])
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'darwin',
          exec,
        })

        await ctrl.setAutoProxy(PAC_URL)

        expect(calls[0]).toBe('networksetup -listallnetworkservices')
        for (const svc of ['Wi-Fi', 'Thunderbolt Bridge']) {
          expect(calls).toContain(
            `networksetup -setautoproxyurl "${svc}" ${PAC_URL}`,
          )
          expect(calls).toContain(`networksetup -setautoproxystate "${svc}" on`)
        }
        // Disabled service is never touched.
        expect(calls.some((c) => c.includes('Bluetooth PAN'))).toBe(false)
      })

      it('disableAutoProxy() turns autoproxystate off per enabled service', async () => {
        const { exec, calls } = makeExec([DARWIN_SERVICES])
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'darwin',
          exec,
        })

        await ctrl.disableAutoProxy()

        for (const svc of ['Wi-Fi', 'Thunderbolt Bridge']) {
          expect(calls).toContain(
            `networksetup -setautoproxystate "${svc}" off`,
          )
        }
      })

      it('disable() also clears PAC (anti-lockout) per enabled service', async () => {
        const { exec, calls } = makeExec([DARWIN_SERVICES])
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'darwin',
          exec,
        })

        await ctrl.disable()

        for (const svc of ['Wi-Fi', 'Thunderbolt Bridge']) {
          expect(calls).toContain(
            `networksetup -setautoproxystate "${svc}" off`,
          )
        }
      })
    })

    describe('windows (win32)', () => {
      const KEY =
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'

      it('setAutoProxy() writes AutoConfigURL (REG_SZ) and clears ProxyEnable', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'win32',
          exec,
        })

        await ctrl.setAutoProxy(PAC_URL)

        expect(calls).toContain(
          `reg add "${KEY}" /v AutoConfigURL /t REG_SZ /d ${PAC_URL} /f`,
        )
        expect(calls).toContain(
          `reg add "${KEY}" /v ProxyEnable /t REG_DWORD /d 0 /f`,
        )
      })

      it('disableAutoProxy() deletes AutoConfigURL', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'win32',
          exec,
        })

        await ctrl.disableAutoProxy()

        expect(calls).toContain(`reg delete "${KEY}" /v AutoConfigURL /f`)
      })

      it('disable() also deletes AutoConfigURL (anti-lockout)', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'win32',
          exec,
        })

        await ctrl.disable()

        expect(calls).toContain(`reg delete "${KEY}" /v AutoConfigURL /f`)
      })
    })

    describe('linux (GNOME/gsettings)', () => {
      it('setAutoProxy() sets auto mode + autoconfig-url', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'linux',
          exec,
        })

        await ctrl.setAutoProxy(PAC_URL)

        expect(calls).toContain(
          "gsettings set org.gnome.system.proxy mode 'auto'",
        )
        expect(calls).toContain(
          `gsettings set org.gnome.system.proxy autoconfig-url '${PAC_URL}'`,
        )
      })

      it('disableAutoProxy() sets mode none', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'linux',
          exec,
        })

        await ctrl.disableAutoProxy()

        expect(calls).toContain(
          "gsettings set org.gnome.system.proxy mode 'none'",
        )
      })

      it('disable() clears PAC by setting mode none (anti-lockout)', async () => {
        const { exec, calls } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'linux',
          exec,
        })

        await ctrl.disable()

        // mode none clears both manual and auto proxy.
        expect(calls).toContain(
          "gsettings set org.gnome.system.proxy mode 'none'",
        )
      })
    })

    describe('unknown platform', () => {
      it('throws on setAutoProxy / disableAutoProxy', async () => {
        const { exec } = makeExec()
        const ctrl = createSystemProxyController({
          host: '127.0.0.1',
          port: 7890,
          platform: 'aix' as NodeJS.Platform,
          exec,
        })
        await expect(ctrl.setAutoProxy(PAC_URL)).rejects.toThrow(
          /unsupported platform/i,
        )
        await expect(ctrl.disableAutoProxy()).rejects.toThrow(
          /unsupported platform/i,
        )
      })
    })
  })

  describe('describe()', () => {
    it('reports the configured port and empty bypass before any enable', () => {
      const { exec } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })
      expect(ctrl.describe()).toEqual({ port: 7890, bypass: [] })
    })

    it('reports the last applied bypass after enable(bypass)', async () => {
      const { exec } = makeExec([DARWIN_SERVICES])
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        exec,
      })
      await ctrl.enable(['localhost', '*.local'])
      expect(ctrl.describe()).toEqual({
        port: 7890,
        bypass: ['localhost', '*.local'],
      })
    })
  })

  describe('unknown platform', () => {
    it('throws a clear error on construction-driven operations', async () => {
      const { exec } = makeExec()
      const ctrl = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'aix' as NodeJS.Platform,
        exec,
      })
      await expect(ctrl.enable()).rejects.toThrow(/unsupported platform/i)
      await expect(ctrl.disable()).rejects.toThrow(/unsupported platform/i)
      await expect(ctrl.isEnabled()).rejects.toThrow(/unsupported platform/i)
    })
  })
})
