import { describe, expect, it, vi } from 'vitest'
import { PROXIES_ORDERING_TYPE } from '~/constants'
import {
  compareVersions,
  encodeSvg,
  filterSpecialProxyType,
  formatDuration,
  formatIPv6,
  formatProxyType,
  fuzzyFilter,
  getLatencyClassName,
  sortProxiesByOrderingType,
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

  describe('compareVersions', () => {
    it('returns positive when v1 is newer', () => {
      expect(compareVersions('v1.243.0', 'v1.242.0')).toBeGreaterThan(0)
      expect(compareVersions('1.243.0', '1.242.0')).toBeGreaterThan(0)
      expect(compareVersions('v2.0.0', 'v1.999.999')).toBeGreaterThan(0)
    })

    it('returns negative when v1 is older', () => {
      expect(compareVersions('v1.241.3', 'v1.242.0')).toBeLessThan(0)
      expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0)
    })

    it('returns zero for equal versions', () => {
      expect(compareVersions('v1.242.0', 'v1.242.0')).toBe(0)
      expect(compareVersions('1.242.0', 'v1.242.0')).toBe(0)
    })

    it('handles pre-release suffixes correctly per semver', () => {
      // Pre-release versions are lower than stable versions
      expect(compareVersions('1.243.0-beta.1', '1.243.0')).toBeLessThan(0)
      expect(compareVersions('1.243.0', '1.243.0-beta.1')).toBeGreaterThan(0)
      expect(compareVersions('1.244.0-rc.1', '1.243.0')).toBeGreaterThan(0)
    })

    it('compares numeric pre-release identifiers numerically, not lexically', () => {
      // beta.2 is OLDER than beta.11 (2 < 11), even though "2" > "1" lexically.
      expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.11')).toBeLessThan(0)
      expect(compareVersions('1.0.0-beta.11', '1.0.0-beta.2')).toBeGreaterThan(
        0,
      )
      expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.2')).toBe(0)
    })

    it('orders pre-release identifiers per semver precedence rules', () => {
      // Alphabetic identifiers compare in ASCII order.
      expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0)
      // A larger set of fields wins when the preceding ones are equal.
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBeGreaterThan(0)
      // Numeric identifiers rank below non-numeric ones.
      expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0)
    })

    it('keeps the full pre-release string when it contains dashes', () => {
      // `1.0.0-beta-1` vs `1.0.0-beta-2`: the trailing segment must not be
      // dropped (both previously parsed to just "beta" and compared equal).
      expect(compareVersions('1.0.0-beta-1', '1.0.0-beta-2')).toBeLessThan(0)
    })

    it('strips build metadata before comparing', () => {
      expect(compareVersions('1.243.0+build123', '1.243.0')).toBe(0)
    })

    it('handles different segment counts', () => {
      expect(compareVersions('1.243', '1.243.0')).toBe(0)
      expect(compareVersions('1.243.1', '1.243')).toBeGreaterThan(0)
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

  describe('sortProxiesByOrderingType - quality', () => {
    const buildHistory = (latencies: number[], success = true) =>
      latencies.map((l) => ({ latency: l, success, timestamp: Date.now() }))

    const buildPerformanceData = () => {
      const map = new Map()
      map.set('high', { history: buildHistory([50, 60]) })
      map.set('mid', { history: buildHistory([200, 250]) })
      map.set('low', { history: buildHistory([1000, 1200]) })
      return map
    }

    const noopGetLatency = vi.fn(() => 0)
    const noopIsProxyGroup = vi.fn(() => false)
    const latencyQualityMap = { NOT_CONNECTED: -1, MEDIUM: 300, HIGH: 800 }

    it('qUALITY_DESC: sorts by score descending, missing data sinks to the end', () => {
      const result = sortProxiesByOrderingType({
        proxyNames: ['mid', 'unknown', 'high', 'low'],
        orderingType: PROXIES_ORDERING_TYPE.QUALITY_DESC,
        testUrl: null,
        getLatencyByName: noopGetLatency,
        isProxyGroup: noopIsProxyGroup,
        latencyQualityMap,
        urlForLatencyTest: 'http://test',
        performanceData: buildPerformanceData(),
      })

      expect(result).toEqual(['high', 'mid', 'low', 'unknown'])
    })

    it('qUALITY_ASC: sorts by score ascending, missing data sinks to the end', () => {
      const result = sortProxiesByOrderingType({
        proxyNames: ['high', 'unknown', 'low', 'mid'],
        orderingType: PROXIES_ORDERING_TYPE.QUALITY_ASC,
        testUrl: null,
        getLatencyByName: noopGetLatency,
        isProxyGroup: noopIsProxyGroup,
        latencyQualityMap,
        urlForLatencyTest: 'http://test',
        performanceData: buildPerformanceData(),
      })

      expect(result).toEqual(['low', 'mid', 'high', 'unknown'])
    })

    it('qUALITY_DESC: tolerates undefined performanceData', () => {
      const result = sortProxiesByOrderingType({
        proxyNames: ['a', 'b'],
        orderingType: PROXIES_ORDERING_TYPE.QUALITY_DESC,
        testUrl: null,
        getLatencyByName: noopGetLatency,
        isProxyGroup: noopIsProxyGroup,
        latencyQualityMap,
        urlForLatencyTest: 'http://test',
      })

      // Both nodes have no performance data, so order is stable/arbitrary,
      // but the function must not throw.
      expect(result).toHaveLength(2)
    })

    it('qUALITY_DESC: a currently-disconnected node sinks below connected ones despite good history', () => {
      // 'high' has a great historical score but is unreachable right now;
      // 'alive' is connected but was never quality-tested (score 0). The live
      // failure must outweigh the stale good history.
      const getLatencyByName = vi.fn((name: string) =>
        name === 'high' ? latencyQualityMap.NOT_CONNECTED : 100,
      )

      const result = sortProxiesByOrderingType({
        proxyNames: ['high', 'alive'],
        orderingType: PROXIES_ORDERING_TYPE.QUALITY_DESC,
        testUrl: null,
        getLatencyByName,
        isProxyGroup: noopIsProxyGroup,
        latencyQualityMap,
        urlForLatencyTest: 'http://test',
        performanceData: buildPerformanceData(),
      })

      expect(result).toEqual(['alive', 'high'])
    })

    it('qUALITY_ASC: a currently-disconnected node sinks below connected ones despite good history', () => {
      const getLatencyByName = vi.fn((name: string) =>
        name === 'high' ? latencyQualityMap.NOT_CONNECTED : 100,
      )

      const result = sortProxiesByOrderingType({
        proxyNames: ['high', 'alive'],
        orderingType: PROXIES_ORDERING_TYPE.QUALITY_ASC,
        testUrl: null,
        getLatencyByName,
        isProxyGroup: noopIsProxyGroup,
        latencyQualityMap,
        urlForLatencyTest: 'http://test',
        performanceData: buildPerformanceData(),
      })

      expect(result).toEqual(['alive', 'high'])
    })
  })
})
