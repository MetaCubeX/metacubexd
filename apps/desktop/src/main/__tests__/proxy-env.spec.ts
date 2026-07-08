import { describe, expect, it } from 'vitest'
import { buildProxyEnvCommand } from '../proxy-env'

describe('buildProxyEnvCommand', () => {
  it('builds one POSIX export with http/https/all_proxy on macOS', () => {
    expect(buildProxyEnvCommand('darwin', '127.0.0.1', 7890)).toBe(
      'export http_proxy=http://127.0.0.1:7890 ' +
        'https_proxy=http://127.0.0.1:7890 ' +
        'all_proxy=socks5://127.0.0.1:7890',
    )
  })

  it('uses the same POSIX form on linux', () => {
    const cmd = buildProxyEnvCommand('linux', '127.0.0.1', 21002)
    expect(cmd.startsWith('export ')).toBe(true)
    expect(cmd).toContain('http_proxy=http://127.0.0.1:21002')
    expect(cmd).toContain('all_proxy=socks5://127.0.0.1:21002')
  })

  it('builds PowerShell $env assignments on Windows', () => {
    expect(buildProxyEnvCommand('win32', '127.0.0.1', 7890)).toBe(
      '$env:HTTP_PROXY="http://127.0.0.1:7890"; ' +
        '$env:HTTPS_PROXY="http://127.0.0.1:7890"; ' +
        '$env:ALL_PROXY="socks5://127.0.0.1:7890"',
    )
  })
})
