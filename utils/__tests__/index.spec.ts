import { describe, expect, it } from 'vitest'
import {
  encodeSvg,
  filterSpecialProxyType,
  formatDuration,
  formatIPv6,
  formatProxyType,
  fuzzyFilter,
  getLatencyClassName,
  transformEndpointURL,
} from '../index'

describe('utils/index', () => {
  describe('transformEndpointURL', () => {
    it('returns URL as-is if it starts with http://', () => {
      expect(transformEndpointURL('http://localhost:9090')).toBe(
        'http://localhost:9090',
      )
    })

    it('returns URL as-is if it starts with https://', () => {
      expect(transformEndpointURL('https://example.com')).toBe(
        'https://example.com',
      )
    })

    it('prepends protocol for bare hostnames', () => {
      // In test environment, window.location.protocol may not be defined
      const result = transformEndpointURL('localhost:9090')
      expect(result).toMatch(/^https?:\/\/localhost:9090$/)
    })
  })

  describe('formatIPv6', () => {
    it('wraps IPv6 addresses in brackets', () => {
      expect(formatIPv6('::1')).toBe('[::1]')
      expect(formatIPv6('2001:db8::1')).toBe('[2001:db8::1]')
    })

    it('returns IPv4 addresses unchanged', () => {
      expect(formatIPv6('192.168.1.1')).toBe('192.168.1.1')
    })

    it('returns hostnames unchanged', () => {
      expect(formatIPv6('localhost')).toBe('localhost')
    })
  })

  describe('formatDuration', () => {
    it('formats seconds correctly', () => {
      const start = 0
      const end = 30000 // 30 seconds
      expect(formatDuration(start, end)).toBe('30s')
    })

    it('formats minutes correctly', () => {
      const start = 0
      const end = 120000 // 2 minutes
      expect(formatDuration(start, end)).toBe('2m')
    })

    it('formats hours correctly', () => {
      const start = 0
      const end = 7200000 // 2 hours
      expect(formatDuration(start, end)).toBe('2h')
    })

    it('formats days correctly', () => {
      const start = 0
      const end = 172800000 // 2 days
      expect(formatDuration(start, end)).toBe('2d')
    })

    it('formats combined duration', () => {
      const start = 0
      const end = 3661000 // 1h 1m 1s
      expect(formatDuration(start, end)).toBe('1h 1m 1s')
    })

    it('returns 0s for zero duration', () => {
      expect(formatDuration(0, 0)).toBe('0s')
    })
  })

  describe('formatProxyType', () => {
    const mockT = (key: string) => key.toUpperCase()

    it('formats shadowsocks as SS', () => {
      expect(formatProxyType('shadowsocks', mockT)).toBe('SS')
    })

    it('formats hysteria2 as HY2', () => {
      expect(formatProxyType('hysteria2', mockT)).toBe('HY2')
    })

    it('formats wireguard as WG', () => {
      expect(formatProxyType('wireguard', mockT)).toBe('WG')
    })

    it('uses translation function for selector', () => {
      expect(formatProxyType('selector', mockT)).toBe('SELECTOR')
    })

    it('returns lowercase for unknown types', () => {
      expect(formatProxyType('VMESS', mockT)).toBe('vmess')
    })

    it('handles empty string', () => {
      expect(formatProxyType('', mockT)).toBe('')
    })
  })

  describe('getLatencyClassName', () => {
    const latencyQualityMap = {
      NOT_CONNECTED: 0,
      MEDIUM: 200,
      HIGH: 500,
    }

    it('returns green for low latency', () => {
      expect(getLatencyClassName(100, latencyQualityMap)).toBe('text-green-600')
    })

    it('returns yellow for medium latency', () => {
      expect(getLatencyClassName(300, latencyQualityMap)).toBe(
        'text-yellow-500',
      )
    })

    it('returns red for high latency', () => {
      expect(getLatencyClassName(600, latencyQualityMap)).toBe('text-red-500')
    })

    it('returns gray for not connected', () => {
      expect(getLatencyClassName(0, latencyQualityMap)).toBe('text-gray')
    })
  })

  describe('filterSpecialProxyType', () => {
    it('returns false for selector', () => {
      expect(filterSpecialProxyType('selector')).toBe(false)
    })

    it('returns false for direct', () => {
      expect(filterSpecialProxyType('direct')).toBe(false)
    })

    it('returns false for urltest', () => {
      expect(filterSpecialProxyType('urltest')).toBe(false)
    })

    it('returns true for vmess', () => {
      expect(filterSpecialProxyType('vmess')).toBe(true)
    })

    it('returns true for trojan', () => {
      expect(filterSpecialProxyType('trojan')).toBe(true)
    })

    it('handles empty string', () => {
      expect(filterSpecialProxyType('')).toBe(true)
    })
  })

  describe('fuzzyFilter', () => {
    it('returns true for matching value', () => {
      const row = { getValue: () => 'Hello World' }
      expect(fuzzyFilter(row, 'col', 'hello')).toBe(true)
    })

    it('returns false for non-matching value', () => {
      const row = { getValue: () => 'Hello World' }
      expect(fuzzyFilter(row, 'col', 'xyz')).toBe(false)
    })

    it('is case insensitive', () => {
      const row = { getValue: () => 'Hello World' }
      expect(fuzzyFilter(row, 'col', 'HELLO')).toBe(true)
    })

    it('returns false for null value', () => {
      const row = { getValue: () => null }
      expect(fuzzyFilter(row, 'col', 'test')).toBe(false)
    })
  })

  describe('encodeSvg', () => {
    it('encodes special characters', () => {
      const svg = '<svg><path d="M0 0"/></svg>'
      const encoded = encodeSvg(svg)
      expect(encoded).toContain('%3C')
      expect(encoded).toContain('%3E')
    })

    it('adds xmlns if missing', () => {
      const svg = '<svg></svg>'
      const encoded = encodeSvg(svg)
      expect(encoded).toContain('xmlns')
    })

    it('preserves existing xmlns', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
      const encoded = encodeSvg(svg)
      // Should not have duplicate xmlns
      expect(encoded.match(/xmlns/g)?.length).toBe(1)
    })
  })
})
