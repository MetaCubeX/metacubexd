import { describe, expect, it } from 'vitest'
import { isResolvableIP, reverseName } from '../useReverseDns'

describe('isResolvableIP', () => {
  it('accepts private LAN IPv4 ranges', () => {
    expect(isResolvableIP('10.0.0.1')).toBe(true)
    expect(isResolvableIP('172.16.0.1')).toBe(true)
    expect(isResolvableIP('172.31.255.254')).toBe(true)
    expect(isResolvableIP('192.168.50.62')).toBe(true)
  })

  it('accepts public IPv4, including the 172.16/12 boundaries', () => {
    expect(isResolvableIP('8.8.8.8')).toBe(true)
    expect(isResolvableIP('1.1.1.1')).toBe(true)
    expect(isResolvableIP('172.15.255.255')).toBe(true)
    expect(isResolvableIP('172.32.0.0')).toBe(true)
  })

  it('rejects loopback, unspecified and link-local IPv4', () => {
    expect(isResolvableIP('127.0.0.1')).toBe(false)
    expect(isResolvableIP('0.0.0.0')).toBe(false)
    expect(isResolvableIP('169.254.1.1')).toBe(false)
  })

  it('rejects empty and malformed IPv4', () => {
    expect(isResolvableIP(undefined)).toBe(false)
    expect(isResolvableIP('')).toBe(false)
    expect(isResolvableIP('192.168.1')).toBe(false)
    expect(isResolvableIP('192.168.1.999')).toBe(false)
    expect(isResolvableIP('not-an-ip')).toBe(false)
  })

  it('accepts unique-local and global IPv6', () => {
    expect(isResolvableIP('fd00::1234')).toBe(true)
    expect(isResolvableIP('2001:db8::1')).toBe(true)
  })

  it('rejects loopback, unspecified and link-local IPv6 (incl. fe80::/10 and zone ids)', () => {
    expect(isResolvableIP('::1')).toBe(false)
    expect(isResolvableIP('::')).toBe(false)
    expect(isResolvableIP('fe80::1')).toBe(false)
    expect(isResolvableIP('feb0::1')).toBe(false)
    expect(isResolvableIP('fe80::1%eth0')).toBe(false)
  })
})

describe('reverseName', () => {
  it('builds the in-addr.arpa name for IPv4', () => {
    expect(reverseName('192.168.50.62')).toBe('62.50.168.192.in-addr.arpa')
    expect(reverseName('8.8.8.8')).toBe('8.8.8.8.in-addr.arpa')
  })

  it('returns null for malformed IPv4', () => {
    expect(reverseName('192.168.1')).toBeNull()
    expect(reverseName('1.2.3.4.5')).toBeNull()
    expect(reverseName('192.168.1.999')).toBeNull()
    expect(reverseName('not-an-ip')).toBeNull()
  })

  it('builds the nibble-reversed ip6.arpa name for IPv6', () => {
    expect(reverseName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    )
    expect(reverseName('fd00::1234')).toBe(
      '4.3.2.1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.d.f.ip6.arpa',
    )
  })

  it('handles a fully-expanded IPv6 address (no "::")', () => {
    expect(reverseName('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    )
    expect(reverseName('2001:db8::1')).toBe(
      reverseName('2001:0db8:0000:0000:0000:0000:0000:0001'),
    )
  })

  it('normalises upper-case hex and strips an IPv6 zone id', () => {
    expect(reverseName('2001:DB8::1')).toBe(reverseName('2001:db8::1'))
    expect(reverseName('fe80::1%eth0')).toBe(reverseName('fe80::1'))
  })

  it('returns null for invalid IPv6 (multiple "::" or too many groups)', () => {
    expect(reverseName('2001::db8::1')).toBeNull()
    expect(reverseName('1:2:3:4:5:6:7::8:9')).toBeNull()
  })
})
