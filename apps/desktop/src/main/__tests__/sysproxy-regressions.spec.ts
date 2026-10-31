import { spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { createSystemProxyController } from '../sysproxy'
import { DEFAULT_SYSPROXY_BYPASS } from '../sysproxy-config'

describe('macOS system proxy command boundaries', () => {
  it.skipIf(process.platform === 'win32')(
    'passes the default bypass list as literal arguments',
    async () => {
      const calls: string[][] = []
      const services = 'Network services\nWi-Fi\n'
      const controller = createSystemProxyController({
        host: '127.0.0.1',
        port: 7890,
        platform: 'darwin',
        // Check legacy commands without executing networksetup. This reproduces
        // the default <local> redirection failure on the previous implementation.
        exec: async (command) => {
          const parsed = spawnSync('/bin/sh', ['-n'], { input: command })
          if (parsed.status !== 0) throw new Error(parsed.stderr.toString())
          return { stdout: services, stderr: '' }
        },
        execFile: async (file, args) => {
          calls.push([file, ...args])
          return { stdout: services, stderr: '' }
        },
      })

      await expect(
        controller.enable([...DEFAULT_SYSPROXY_BYPASS]),
      ).resolves.toBeUndefined()
      expect(calls).toContainEqual([
        'networksetup',
        '-setproxybypassdomains',
        'Wi-Fi',
        ...DEFAULT_SYSPROXY_BYPASS,
      ])
    },
  )

  it('rolls back every touched service if configuring a later service fails', async () => {
    const calls: string[][] = []
    const services = 'Network services\nWi-Fi\nThunderbolt Bridge\n'
    const run = async (args: string[]) => {
      calls.push(args)
      if (
        args[0] === '-setsecurewebproxystate' &&
        args[1] === 'Thunderbolt Bridge' &&
        args[2] === 'on'
      ) {
        throw new Error('networksetup failed')
      }
      return { stdout: services, stderr: '' }
    }
    const controller = createSystemProxyController({
      host: '127.0.0.1',
      port: 7890,
      platform: 'darwin',
      exec: async (command) => {
        if (command.includes('-setsecurewebproxystate "Thunderbolt Bridge" on'))
          throw new Error('networksetup failed')
        return { stdout: services, stderr: '' }
      },
      execFile: async (_file, args) => run(args),
    })

    await expect(controller.enable(['localhost'])).rejects.toThrow(
      'networksetup failed',
    )
    for (const service of ['Wi-Fi', 'Thunderbolt Bridge']) {
      for (const kind of ['web', 'secureweb', 'socksfirewall']) {
        expect(calls).toContainEqual([`-set${kind}proxystate`, service, 'off'])
      }
    }
    expect(controller.describe().bypass).toEqual([])
  })

  it('does not interpret shell metacharacters in service names, bypass entries or PAC URLs', async () => {
    const service = 'Wi-Fi " $(touch should-not-exist)'
    const bypass = '*.example.test; echo unexpected'
    const url = 'https://example.test/proxy.pac?x=1&y=$(echo unexpected)'
    const execFile = vi.fn(async () => ({
      stdout: `Network services\n${service}\n`,
      stderr: '',
    }))
    const controller = createSystemProxyController({
      host: '127.0.0.1',
      port: 7890,
      platform: 'darwin',
      exec: async () => ({ stdout: '', stderr: '' }),
      execFile,
    })
    await controller.enable([bypass])
    await controller.setAutoProxy(url)
    expect(execFile).toHaveBeenCalledWith('networksetup', [
      '-setproxybypassdomains',
      service,
      bypass,
    ])
    expect(execFile).toHaveBeenCalledWith('networksetup', [
      '-setautoproxyurl',
      service,
      url,
    ])
  })
})
