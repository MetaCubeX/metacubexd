import type { Rule } from '~/types'
import { describe, expect, it, vi } from 'vitest'
import { PROXIES_ORDERING_TYPE, RULES_ORDERING_TYPE } from '~/constants'
import {
  classifyLatency,
  codeToFlag,
  compareVersions,
  encodeSvg,
  filterNodesByCapability,
  filterNodesByRegion,
  filterNodesByType,
  filterRules,
  filterSpecialProxyType,
  formatDuration,
  formatIPv6,
  formatProxyType,
  fuzzyFilter,
  gapLeadingFlag,
  getCapabilityFacets,
  getLatencyClassName,
  getRegionFacets,
  getRuleFacets,
  getTypeFacets,
  isSingBoxVersion,
  parseNodeRegion,
  randomUUID,
  REGION_OTHER,
  sortProxiesByOrderingType,
  sortRulesByOrderingType,
  splitLeadingFlag,
  transformEndpointURL,
} from '../index'

function mkRule(partial: Partial<Rule> = {}): Rule {
  return {
    index: 0,
    type: 'DOMAIN',
    payload: 'example.com',
    proxy: 'DIRECT',
    size: -1,
    ...partial,
  }
}

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

  describe('randomUUID', () => {
    const UUID_V4_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    it('uses native crypto.randomUUID when available', () => {
      expect(randomUUID()).toMatch(UUID_V4_RE)
    })

    it('falls back to getRandomValues in non-secure contexts', () => {
      // Simulate http://IP:port where crypto.randomUUID is unavailable.
      const original = crypto.randomUUID
      // @ts-expect-error force the typeof guard to fall through
      crypto.randomUUID = undefined

      try {
        expect(randomUUID()).toMatch(UUID_V4_RE)
      } finally {
        crypto.randomUUID = original
      }
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

  describe('classifyLatency', () => {
    const map = { NOT_CONNECTED: 0, MEDIUM: 200, HIGH: 500 }

    it('bands a fast reading as good', () => {
      expect(classifyLatency(100, map)).toBe('good')
    })
    it('bands a mid reading as medium', () => {
      expect(classifyLatency(300, map)).toBe('medium')
    })
    it('bands a slow reading as slow', () => {
      expect(classifyLatency(600, map)).toBe('slow')
    })
    it('bands the NOT_CONNECTED sentinel as not-connected', () => {
      expect(classifyLatency(0, map)).toBe('not-connected')
    })
    it('treats the MEDIUM boundary as good (not medium)', () => {
      expect(classifyLatency(200, map)).toBe('good')
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

  describe('isSingBoxVersion', () => {
    it('detects sing-box version strings (case-insensitive)', () => {
      expect(isSingBoxVersion('sing-box 1.10.0')).toBe(true)
      expect(isSingBoxVersion('SING-BOX-1.10.0')).toBe(true)
    })

    it('returns false for mihomo / clash version strings', () => {
      expect(isSingBoxVersion('alpha-g1234567')).toBe(false)
      expect(isSingBoxVersion('v1.19.9')).toBe(false)
      expect(isSingBoxVersion('meta')).toBe(false)
    })

    it('handles empty / nullish input', () => {
      expect(isSingBoxVersion('')).toBe(false)
      expect(isSingBoxVersion(undefined)).toBe(false)
      expect(isSingBoxVersion(null)).toBe(false)
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

  describe('getRuleFacets', () => {
    it('counts distinct values for the given key', () => {
      const rules = [
        mkRule({ type: 'DOMAIN' }),
        mkRule({ type: 'DOMAIN' }),
        mkRule({ type: 'IP-CIDR' }),
      ]

      expect(getRuleFacets(rules, 'type')).toEqual([
        { value: 'DOMAIN', count: 2 },
        { value: 'IP-CIDR', count: 1 },
      ])
    })

    it('counts the proxy (policy) field independently', () => {
      const rules = [
        mkRule({ proxy: 'DIRECT' }),
        mkRule({ proxy: 'REJECT' }),
        mkRule({ proxy: 'DIRECT' }),
      ]

      expect(getRuleFacets(rules, 'proxy')).toEqual([
        { value: 'DIRECT', count: 2 },
        { value: 'REJECT', count: 1 },
      ])
    })

    it('sorts by count desc then value asc on a tie', () => {
      const rules = [
        mkRule({ type: 'ZEBRA' }),
        mkRule({ type: 'ALPHA' }),
        mkRule({ type: 'MATCH' }),
        mkRule({ type: 'MATCH' }),
      ]

      expect(getRuleFacets(rules, 'type')).toEqual([
        { value: 'MATCH', count: 2 },
        { value: 'ALPHA', count: 1 },
        { value: 'ZEBRA', count: 1 },
      ])
    })

    it('returns an empty array for empty input', () => {
      expect(getRuleFacets([], 'type')).toEqual([])
    })
  })

  describe('filterRules', () => {
    const noFilter = {
      types: [] as string[],
      policies: [] as string[],
      status: 'all' as const,
    }

    it('returns the same reference when nothing is selected', () => {
      const rules = [mkRule()]

      expect(filterRules(rules, noFilter)).toBe(rules)
    })

    it('keeps only the selected type', () => {
      const rules = [mkRule({ type: 'DOMAIN' }), mkRule({ type: 'IP-CIDR' })]

      expect(filterRules(rules, { ...noFilter, types: ['DOMAIN'] })).toEqual([
        rules[0],
      ])
    })

    it('oRs multiple types within the type dimension', () => {
      const rules = [
        mkRule({ type: 'DOMAIN' }),
        mkRule({ type: 'IP-CIDR' }),
        mkRule({ type: 'MATCH' }),
      ]

      expect(
        filterRules(rules, { ...noFilter, types: ['DOMAIN', 'MATCH'] }),
      ).toEqual([rules[0], rules[2]])
    })

    it('matches the proxy (policy) value exactly', () => {
      const rules = [
        mkRule({ proxy: 'DIRECT' }),
        mkRule({ proxy: 'REJECT' }),
        mkRule({ proxy: 'My Group' }),
      ]

      expect(
        filterRules(rules, { ...noFilter, policies: ['My Group'] }),
      ).toEqual([rules[2]])
    })

    it('treats a rule with no extra as enabled', () => {
      const rules = [
        mkRule({ extra: undefined }),
        mkRule({ extra: { disabled: true } }),
      ]

      expect(filterRules(rules, { ...noFilter, status: 'enabled' })).toEqual([
        rules[0],
      ])
    })

    it('returns only disabled rules for status disabled', () => {
      const rules = [
        mkRule({ extra: undefined }),
        mkRule({ extra: { disabled: false } }),
        mkRule({ extra: { disabled: true } }),
      ]

      expect(filterRules(rules, { ...noFilter, status: 'disabled' })).toEqual([
        rules[2],
      ])
    })

    it('aNDs across type, policy and status dimensions', () => {
      const rules = [
        mkRule({ type: 'DOMAIN', proxy: 'DIRECT', extra: { disabled: true } }),
        mkRule({ type: 'DOMAIN', proxy: 'DIRECT' }),
        mkRule({ type: 'DOMAIN', proxy: 'REJECT', extra: { disabled: true } }),
      ]

      expect(
        filterRules(rules, {
          types: ['DOMAIN'],
          policies: ['DIRECT'],
          status: 'disabled',
        }),
      ).toEqual([rules[0]])
    })

    it('returns an empty array when the selection matches nothing', () => {
      const rules = [mkRule({ type: 'DOMAIN' })]

      expect(filterRules(rules, { ...noFilter, types: ['GEOSITE'] })).toEqual(
        [],
      )
    })

    it('returns an empty array for empty input', () => {
      expect(filterRules([], { ...noFilter, types: ['DOMAIN'] })).toEqual([])
    })
  })

  describe('sortRulesByOrderingType', () => {
    it('returns the input untouched for NATURAL order', () => {
      const rules = [mkRule({ index: 2 }), mkRule({ index: 1 })]
      const copy = [...rules]

      const result = sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.NATURAL)

      expect(result).toBe(rules)
      expect(rules).toEqual(copy) // not mutated
    })

    it('does not mutate the input array when sorting', () => {
      const rules = [
        mkRule({ index: 0, type: 'IP-CIDR' }),
        mkRule({ index: 1, type: 'DOMAIN' }),
      ]
      const copy = [...rules]

      sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.TYPE_ASC)

      expect(rules).toEqual(copy)
    })

    it('sorts by rule type ascending and descending', () => {
      const rules = [
        mkRule({ index: 0, type: 'IP-CIDR' }),
        mkRule({ index: 1, type: 'DOMAIN' }),
        mkRule({ index: 2, type: 'MATCH' }),
      ]

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.TYPE_ASC).map(
          (r) => r.type,
        ),
      ).toEqual(['DOMAIN', 'IP-CIDR', 'MATCH'])

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.TYPE_DESC).map(
          (r) => r.type,
        ),
      ).toEqual(['MATCH', 'IP-CIDR', 'DOMAIN'])
    })

    it('falls back to type as the name key when payload is empty', () => {
      const rules = [
        mkRule({ index: 0, payload: 'a.com', type: 'DOMAIN' }),
        mkRule({ index: 1, payload: '', type: 'MATCH' }),
        mkRule({ index: 2, payload: 'z.com', type: 'DOMAIN' }),
      ]

      // '' || type -> 'MATCH' sorts under M, not first.
      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.NAME_ASC).map(
          (r) => r.payload || r.type,
        ),
      ).toEqual(['a.com', 'MATCH', 'z.com'])
    })

    it('sorts by hit count, coercing missing extra to 0', () => {
      const rules = [
        mkRule({ index: 0, extra: { hitCount: 5 } }),
        mkRule({ index: 1, extra: undefined }),
        mkRule({ index: 2, extra: { hitCount: 10 } }),
        mkRule({ index: 3, extra: {} }),
      ]

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.HIT_COUNT_DESC).map(
          (r) => r.index,
        ),
      ).toEqual([2, 0, 1, 3])

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.HIT_COUNT_ASC).map(
          (r) => r.index,
        ),
      ).toEqual([1, 3, 0, 2])
    })

    it('sorts by recency, sinking never-matched rules to the bottom', () => {
      const rules = [
        mkRule({ index: 0, extra: { hitAt: '2024-01-01T00:00:00Z' } }),
        mkRule({ index: 1, extra: undefined }),
        mkRule({ index: 2, extra: { hitAt: '2024-06-01T00:00:00Z' } }),
        mkRule({ index: 3, extra: {} }),
      ]

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.HIT_AT_DESC).map(
          (r) => r.index,
        ),
      ).toEqual([2, 0, 1, 3])
    })

    it('keeps ascending index order on a tiebreak', () => {
      const rules = [
        mkRule({ index: 3, extra: { hitCount: 0 } }),
        mkRule({ index: 1, extra: { hitCount: 0 } }),
        mkRule({ index: 2, extra: { hitCount: 0 } }),
      ]

      expect(
        sortRulesByOrderingType(rules, RULES_ORDERING_TYPE.HIT_COUNT_DESC).map(
          (r) => r.index,
        ),
      ).toEqual([1, 2, 3])
    })

    it('handles empty and single-element input without throwing', () => {
      expect(
        sortRulesByOrderingType([], RULES_ORDERING_TYPE.HIT_AT_DESC),
      ).toEqual([])

      const one = [mkRule()]

      expect(
        sortRulesByOrderingType(one, RULES_ORDERING_TYPE.HIT_COUNT_DESC),
      ).toEqual(one)
    })

    it('falls back to input order for an unknown ordering type', () => {
      const rules = [mkRule({ index: 1 }), mkRule({ index: 0 })]

      expect(
        sortRulesByOrderingType(rules, 'bogus' as RULES_ORDERING_TYPE).map(
          (r) => r.index,
        ),
      ).toEqual([1, 0])
    })
  })

  describe('parseNodeRegion', () => {
    it('decodes a leading flag emoji', () => {
      expect(parseNodeRegion('🇸🇬SG_新加坡|🟡42|机房IP 4')).toBe('SG')
      expect(parseNodeRegion('🇯🇵 日本 05')).toBe('JP')
    })

    it('reads a leading ISO alpha-2 token', () => {
      expect(parseNodeRegion('JP-Narita-09bac5443211911c07-czyc')).toBe('JP')
      expect(parseNodeRegion('US_美国|🟢24|原生IP')).toBe('US')
      expect(parseNodeRegion('DE-Dreieich-09bac52a921b4b2b87-cvfw')).toBe('DE')
      expect(parseNodeRegion('HK-Lai Tak Tsuen-h-15211021-czzm')).toBe('HK')
    })

    it('returns null for unrecognized names', () => {
      expect(parseNodeRegion('sg01-reality')).toBeNull()
      expect(parseNodeRegion('claw1-reality')).toBeNull()
      expect(parseNodeRegion('日本 05')).toBeNull()
    })
  })

  describe('codeToFlag', () => {
    it('maps alpha-2 to flag emoji', () => {
      expect(codeToFlag('JP')).toBe('🇯🇵')
      expect(codeToFlag('SG')).toBe('🇸🇬')
    })
  })

  describe('getRegionFacets', () => {
    it('counts regions, sorts by count desc, Other last', () => {
      const facets = getRegionFacets([
        '🇸🇬SG a',
        '🇸🇬SG b',
        'JP-x',
        'sg01-reality',
      ])
      expect(facets.map((f) => [f.code, f.count])).toEqual([
        ['SG', 2],
        ['JP', 1],
        [REGION_OTHER, 1],
      ])
      expect(facets[0]?.flag).toBe('🇸🇬')
      expect(facets[2]?.flag).toBe('')
    })
  })

  describe('filterNodesByRegion', () => {
    const names = ['🇸🇬SG a', 'JP-x', 'sg01-reality']

    it('passes through on an empty set', () => {
      expect(filterNodesByRegion(names, new Set())).toBe(names)
    })

    it('keeps only selected regions', () => {
      expect(filterNodesByRegion(names, new Set(['JP']))).toEqual(['JP-x'])
      expect(filterNodesByRegion(names, new Set([REGION_OTHER]))).toEqual([
        'sg01-reality',
      ])
    })
  })

  describe('protocol type + capability facets', () => {
    const meta: Record<string, { type: string; udp: boolean; xudp: boolean }> =
      {
        a: { type: 'Shadowsocks', udp: true, xudp: true },
        b: { type: 'Shadowsocks', udp: true, xudp: false },
        c: { type: 'Vmess', udp: false, xudp: false },
        d: { type: 'Trojan', udp: true, xudp: false },
      }
    const metaOf = (name: string) => meta[name]
    const names = ['a', 'b', 'c', 'd', 'ghost']

    describe('getTypeFacets', () => {
      it('counts types (count desc, type asc) and skips unknown nodes', () => {
        expect(getTypeFacets(names, metaOf)).toEqual([
          { type: 'Shadowsocks', count: 2 },
          { type: 'Trojan', count: 1 },
          { type: 'Vmess', count: 1 },
        ])
      })
    })

    describe('filterNodesByType', () => {
      it('passes through on an empty set', () => {
        expect(filterNodesByType(names, new Set(), metaOf)).toBe(names)
      })

      it('keeps only selected types', () => {
        expect(
          filterNodesByType(names, new Set(['Shadowsocks']), metaOf),
        ).toEqual(['a', 'b'])
      })
    })

    describe('getCapabilityFacets', () => {
      it('counts UDP and XUDP support', () => {
        expect(getCapabilityFacets(names, metaOf)).toEqual({ udp: 3, xudp: 1 })
      })
    })

    describe('filterNodesByCapability', () => {
      it('passes through when no capability is required', () => {
        expect(
          filterNodesByCapability(names, { udp: false, xudp: false }, metaOf),
        ).toBe(names)
      })

      it('filters by UDP, dropping unknown nodes', () => {
        expect(
          filterNodesByCapability(names, { udp: true, xudp: false }, metaOf),
        ).toEqual(['a', 'b', 'd'])
      })

      it('requires both UDP and XUDP when both are on', () => {
        expect(
          filterNodesByCapability(names, { udp: true, xudp: true }, metaOf),
        ).toEqual(['a'])
      })
    })
  })

  describe('splitLeadingFlag', () => {
    it('splits a leading country-flag emoji off the name', () => {
      expect(splitLeadingFlag('🇭🇰HK_香港|🟡44')).toEqual({
        flag: '🇭🇰',
        rest: 'HK_香港|🟡44',
      })
    })

    it("strips the provider's own space after the flag", () => {
      expect(splitLeadingFlag('🇭🇰 香港 04')).toEqual({
        flag: '🇭🇰',
        rest: '香港 04',
      })
    })

    it('handles a lone (non-regional-indicator) flag emoji', () => {
      expect(splitLeadingFlag('🏳未知_未知|🟡44')).toEqual({
        flag: '🏳',
        rest: '未知_未知|🟡44',
      })
    })

    it('returns empty flag when none leads', () => {
      expect(splitLeadingFlag('SG-Singapore-09')).toEqual({
        flag: '',
        rest: 'SG-Singapore-09',
      })
      expect(splitLeadingFlag('日本 05')).toEqual({ flag: '', rest: '日本 05' })
    })
  })

  describe('gapLeadingFlag', () => {
    it('normalizes spacing to one space after a leading flag', () => {
      expect(gapLeadingFlag('🇺🇸US_美国')).toBe('🇺🇸 US_美国')
      expect(gapLeadingFlag('🇭🇰 香港 04')).toBe('🇭🇰 香港 04')
      expect(gapLeadingFlag('🏳未知')).toBe('🏳 未知')
    })

    it('leaves flagless names untouched', () => {
      expect(gapLeadingFlag('SG-Singapore-09')).toBe('SG-Singapore-09')
    })
  })
})
