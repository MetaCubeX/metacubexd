import { describe, expect, it } from 'vitest'
import { buildTunConfig } from './tun'

describe('buildTunConfig', () => {
  it('builds the mihomo tun block with the given stack and the safe defaults', () => {
    const tun = buildTunConfig({ stack: 'gvisor' })
    expect(tun).toEqual({
      enable: true,
      stack: 'gvisor',
      'auto-route': true,
      'auto-detect-interface': true,
      'dns-hijack': ['any:53'],
      'strict-route': true,
    })
  })

  it('passes the stack through verbatim (mixed/system/lwip)', () => {
    expect(buildTunConfig({ stack: 'mixed' }).stack).toBe('mixed')
    expect(buildTunConfig({ stack: 'system' }).stack).toBe('system')
    expect(buildTunConfig({ stack: 'lwip' }).stack).toBe('lwip')
  })

  it('includes device only when provided', () => {
    const withDevice = buildTunConfig({ stack: 'gvisor', device: 'utun123' })
    expect(withDevice.device).toBe('utun123')
    expect(withDevice).toMatchObject({
      enable: true,
      stack: 'gvisor',
      'auto-route': true,
      'auto-detect-interface': true,
      'dns-hijack': ['any:53'],
      'strict-route': true,
      device: 'utun123',
    })
  })

  it('omits the device key entirely when not provided', () => {
    const tun = buildTunConfig({ stack: 'gvisor' })
    expect('device' in tun).toBe(false)
  })

  it('is pure — repeated calls produce equal but independent objects', () => {
    const a = buildTunConfig({ stack: 'gvisor' })
    const b = buildTunConfig({ stack: 'gvisor' })
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
    expect(a['dns-hijack']).not.toBe(b['dns-hijack'])
  })
})
