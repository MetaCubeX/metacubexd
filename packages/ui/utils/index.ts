import type { NodePerformanceData } from '~/stores/nodeRecommendation'
import type { Rule } from '~/types'
import byteSize from 'byte-size'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import { PROXIES_ORDERING_TYPE, RULES_ORDERING_TYPE } from '~/constants'
import { calculateNodeScore } from './nodeScoring'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/ru'

interface LatencyQualityMap {
  NOT_CONNECTED: number
  MEDIUM: number
  HIGH: number
}

dayjs.extend(relativeTime)
dayjs.extend(duration)

function isAsciiDigits(value: string): boolean {
  if (!value) return false
  for (const char of value) {
    if (char < '0' || char > '9') return false
  }
  return true
}

function isAsciiLetter(char: string | undefined): boolean {
  if (!char) return false
  const lower = char.toLowerCase()
  return lower >= 'a' && lower <= 'z'
}

// Compare two SemVer pre-release strings (the part after the first `-`) per the
// SemVer precedence rules: identifiers are dot-separated and compared left to
// right; purely numeric identifiers compare numerically, numeric identifiers
// rank below non-numeric ones, and a longer set of identifiers wins when all
// preceding ones are equal.
function comparePrerelease(a: string, b: string): number {
  const aIds = a.split('.')
  const bIds = b.split('.')
  const len = Math.max(aIds.length, bIds.length)

  for (let i = 0; i < len; i++) {
    const aId = aIds[i]
    const bId = bIds[i]
    if (aId === undefined) return -1
    if (bId === undefined) return 1

    const aIsNum = isAsciiDigits(aId)
    const bIsNum = isAsciiDigits(bId)

    if (aIsNum && bIsNum) {
      const diff = Number(aId) - Number(bId)
      if (diff !== 0) return diff > 0 ? 1 : -1
    } else if (aIsNum !== bIsNum) {
      // Numeric identifiers always have lower precedence than non-numeric.
      return aIsNum ? -1 : 1
    } else {
      const cmp = aId.localeCompare(bId)
      if (cmp !== 0) return cmp > 0 ? 1 : -1
    }
  }

  return 0
}

export function compareVersions(v1: string, v2: string): number {
  const parse = (v: string) => {
    const withoutPrefix = v.startsWith('v') ? v.slice(1) : v
    const buildIndex = withoutPrefix.indexOf('+')
    const cleaned =
      buildIndex === -1 ? withoutPrefix : withoutPrefix.slice(0, buildIndex)
    // Split on the FIRST `-` only — the whole remainder is the pre-release
    // string, which may itself contain `-` (e.g. `1.0.0-beta-1`).
    const dashIndex = cleaned.indexOf('-')
    const main = dashIndex === -1 ? cleaned : cleaned.slice(0, dashIndex)
    const prerelease = dashIndex === -1 ? null : cleaned.slice(dashIndex + 1)
    return {
      parts: main.split('.').map((n) => Number.parseInt(n, 10) || 0),
      prerelease,
    }
  }

  const v1Parsed = parse(v1)
  const v2Parsed = parse(v2)
  const len = Math.max(v1Parsed.parts.length, v2Parsed.parts.length)

  for (let i = 0; i < len; i++) {
    const p1 = v1Parsed.parts[i] || 0
    const p2 = v2Parsed.parts[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }

  // If main version parts are equal, compare prerelease.
  // No prerelease > any prerelease (stable is newer).
  if (!v1Parsed.prerelease && v2Parsed.prerelease) return 1
  if (v1Parsed.prerelease && !v2Parsed.prerelease) return -1
  if (v1Parsed.prerelease && v2Parsed.prerelease) {
    return comparePrerelease(v1Parsed.prerelease, v2Parsed.prerelease)
  }

  return 0
}

// sing-box also serves the clash API, but reports its version as a string
// containing "sing-box". Its releases live in a different repo with a
// different cadence, so the dashboard cannot diff it against the mihomo
// release feed — callers use this to skip the mihomo-based update check and
// to hide mihomo-only settings (#1870).
export function isSingBoxVersion(version: string | undefined | null): boolean {
  return !!version && version.toLowerCase().includes('sing-box')
}

export function formatBytes(bytes: number) {
  return byteSize(bytes).toString()
}

// URL helpers
export function transformEndpointURL(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}//${url}`
}

// crypto.randomUUID() is restricted to secure contexts (HTTPS/localhost), so it
// throws over plain-HTTP LAN access (e.g. http://IP:port). getRandomValues()
// works there, so fall back to building a v4 UUID from it.
export function randomUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0F) | 0x40 // version 4
  bytes[8] = (bytes[8]! & 0x3F) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function formatIPv6(ip: string) {
  if (ip.indexOf(':') !== ip.lastIndexOf(':') && !ip.includes('.')) {
    return `[${ip}]`
  }
  return ip
}

// Time helpers
export function formatTimeFromNow(
  time: number | string,
  locale: string = 'en',
) {
  // Map i18n locale codes to dayjs locale codes
  const dayjsLocale = locale === 'zh' ? 'zh-cn' : locale === 'ru' ? 'ru' : 'en'
  return dayjs(time).locale(dayjsLocale).fromNow()
}

export function formatDuration(startTime: number, endTime: number) {
  const diff = endTime - startTime
  const dur = dayjs.duration(diff)

  const days = Math.floor(dur.asDays())
  const hours = dur.hours()
  const minutes = dur.minutes()
  const seconds = dur.seconds()

  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 && days === 0) parts.push(`${seconds}s`)

  return parts.length > 0 ? parts.join(' ') : '0s'
}

export function formatDateRange(
  startTime: number,
  endTime: number,
  locale: string = 'en',
) {
  // Map i18n locale codes to dayjs locale codes
  const dayjsLocale = locale === 'zh' ? 'zh-cn' : locale === 'ru' ? 'ru' : 'en'
  const start = dayjs(startTime)
  const end = dayjs(endTime)

  if (start.isSame(end, 'day')) {
    return `${start.locale(dayjsLocale).format('MMM D, YYYY HH:mm')} - ${end.locale(dayjsLocale).format('HH:mm')}`
  }

  return `${start.locale(dayjsLocale).format('MMM D, HH:mm')} - ${end.locale(dayjsLocale).format('MMM D, HH:mm')}`
}

// Proxy helpers
export function formatProxyType(
  type: string = '',
  t: (key: string) => string,
): string {
  const lt = type.toLowerCase()
  const formatMap = new Map<string, string>([
    ['shadowsocks', 'SS'],
    ['shadowsocksr', 'SSR'],
    ['hysteria', 'HY'],
    ['hysteria2', 'HY2'],
    ['wireguard', 'WG'],
    ['selector', t('selector')],
    ['urltest', t('urltest')],
    ['smart', t('smart')],
    ['fallback', t('fallback')],
    ['loadbalance', t('loadbalance')],
    ['direct', t('direct')],
    ['reject', t('reject')],
    ['rejectdrop', t('rejectdrop')],
    ['relay', t('relay')],
    ['pass', t('pass')],
  ])

  if (formatMap.has(lt)) {
    return formatMap.get(lt)!
  }
  return lt
}

// The canonical Running Mode order shared by the tray and every UI surface
// (rule -> global -> direct), matching the conventional severity ladder the
// tray already uses. The kernel's `mode-list` arrives in arbitrary order, so
// every UI control normalizes through this to stay consistent with the tray
// (#2148).
const CANONICAL_MODE_ORDER = ['rule', 'global', 'direct'] as const

export function orderProxyModes(modes: string[] | undefined): string[] {
  const input = modes ?? []
  const ordered = CANONICAL_MODE_ORDER.filter((m) => input.includes(m))
  const extras = input.filter((m) => !CANONICAL_MODE_ORDER.includes(m as never))
  return [...ordered, ...extras]
}

export type LatencyBand = 'good' | 'medium' | 'slow' | 'not-connected'

// The single Latency Band ladder. getLatencyClassName, ProxyPreviewBar and
// ProxyPreviewDots all classify against THIS — no forked thresholds.
export function classifyLatency(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
): LatencyBand {
  if (latency > latencyQualityMap.HIGH) return 'slow'
  if (latency > latencyQualityMap.MEDIUM) return 'medium'
  if (latency === latencyQualityMap.NOT_CONNECTED) return 'not-connected'
  return 'good'
}

const LATENCY_BAND_TEXT_CLASS: Record<LatencyBand, string> = {
  slow: 'text-red-500',
  medium: 'text-yellow-500',
  'not-connected': 'text-gray',
  good: 'text-green-600',
}

export function getLatencyClassName(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
) {
  return LATENCY_BAND_TEXT_CLASS[classifyLatency(latency, latencyQualityMap)]
}

export function filterSpecialProxyType(type: string = '') {
  const conditions = [
    'selector',
    'direct',
    'reject',
    'urltest',
    'loadbalance',
    'fallback',
    'relay',
  ]
  return !conditions.includes(type.toLowerCase())
}

export function sortProxiesByOrderingType({
  proxyNames,
  orderingType,
  testUrl,
  getLatencyByName,
  isProxyGroup,
  latencyQualityMap,
  urlForLatencyTest,
  performanceData,
}: {
  proxyNames: string[]
  orderingType: PROXIES_ORDERING_TYPE
  testUrl: string | null
  getLatencyByName: (name: string, testUrl: string | null) => number
  isProxyGroup?: (name: string) => boolean
  latencyQualityMap: LatencyQualityMap
  urlForLatencyTest: string
  performanceData?: Map<string, NodePerformanceData>
}) {
  if (orderingType === PROXIES_ORDERING_TYPE.NATURAL) {
    return proxyNames
  }

  const finalTestUrl = testUrl || urlForLatencyTest

  return [...proxyNames].sort((a, b) => {
    const prevLatency = getLatencyByName(a, finalTestUrl)
    const nextLatency = getLatencyByName(b, finalTestUrl)

    const prevIsProxyGroup = isProxyGroup?.(a) ?? false
    const nextIsProxyGroup = isProxyGroup?.(b) ?? false
    const proxyGroupPriority =
      Number(nextIsProxyGroup) - Number(prevIsProxyGroup)

    if (proxyGroupPriority !== 0) {
      return proxyGroupPriority
    }

    switch (orderingType) {
      case PROXIES_ORDERING_TYPE.LATENCY_ASC:
        if (prevLatency === latencyQualityMap.NOT_CONNECTED) return 1
        if (nextLatency === latencyQualityMap.NOT_CONNECTED) return -1
        return prevLatency - nextLatency

      case PROXIES_ORDERING_TYPE.LATENCY_DESC:
        if (prevLatency === latencyQualityMap.NOT_CONNECTED) return 1
        if (nextLatency === latencyQualityMap.NOT_CONNECTED) return -1
        return nextLatency - prevLatency

      case PROXIES_ORDERING_TYPE.NAME_ASC:
        return a.localeCompare(b)

      case PROXIES_ORDERING_TYPE.NAME_DESC:
        return b.localeCompare(a)

      case PROXIES_ORDERING_TYPE.QUALITY_ASC: {
        // A node that is unreachable right now must sink to the bottom no matter
        // how good its historical quality score is — a stale good run shouldn't
        // outrank a node that actually connects.
        if (prevLatency === latencyQualityMap.NOT_CONNECTED) return 1
        if (nextLatency === latencyQualityMap.NOT_CONNECTED) return -1

        const prevData = performanceData?.get(a)
        const nextData = performanceData?.get(b)
        const prevScore = prevData ? calculateNodeScore(prevData) : 0
        const nextScore = nextData ? calculateNodeScore(nextData) : 0

        if (prevScore === 0 && nextScore > 0) return 1
        if (nextScore === 0 && prevScore > 0) return -1
        return prevScore - nextScore
      }

      case PROXIES_ORDERING_TYPE.QUALITY_DESC: {
        // A node that is unreachable right now must sink to the bottom no matter
        // how good its historical quality score is — a stale good run shouldn't
        // outrank a node that actually connects.
        if (prevLatency === latencyQualityMap.NOT_CONNECTED) return 1
        if (nextLatency === latencyQualityMap.NOT_CONNECTED) return -1

        const prevData = performanceData?.get(a)
        const nextData = performanceData?.get(b)
        const prevScore = prevData ? calculateNodeScore(prevData) : 0
        const nextScore = nextData ? calculateNodeScore(nextData) : 0

        if (prevScore === 0 && nextScore > 0) return 1
        if (nextScore === 0 && prevScore > 0) return -1
        return nextScore - prevScore
      }

      default:
        return 0
    }
  })
}

export function filterProxiesByAvailability({
  proxyNames,
  enabled,
  testUrl,
  getLatencyByName,
  isProxyGroup,
  latencyQualityMap,
  urlForLatencyTest,
}: {
  proxyNames: string[]
  enabled?: boolean
  testUrl: string | null
  getLatencyByName: (name: string, testUrl: string | null) => number
  isProxyGroup: (name: string) => boolean
  latencyQualityMap: LatencyQualityMap
  urlForLatencyTest: string
}) {
  const finalTestUrl = testUrl || urlForLatencyTest

  return enabled
    ? proxyNames.filter((name) => {
        return (
          isProxyGroup(name) ||
          getLatencyByName(name, finalTestUrl) !==
            latencyQualityMap.NOT_CONNECTED
        )
      })
    : proxyNames
}

// Case-insensitive substring match on node name. An empty/whitespace-only
// keyword keeps the list untouched so the common (unfiltered) path is free.
export function filterProxiesByName(proxyNames: string[], keyword: string) {
  const trimmed = keyword.trim().toLowerCase()
  if (!trimmed) return proxyNames
  return proxyNames.filter((name) => name.toLowerCase().includes(trimmed))
}

// ponytail: heuristic region detection — a leading flag emoji or a leading
// ISO-3166 alpha-2 code token. Names with neither fall to REGION_OTHER.
// Upgrade path: extend ISO_CODES / add a provider-prefix map if real configs
// use non-standard region tokens.
export const REGION_OTHER = '__other__'

const FLAG_OFFSET = 0x1F1E6 // regional indicator 'A'
const A_CHARCODE = 0x41 // 'A'

// Common proxy-region ISO codes accepted as a *leading text token* (e.g.
// "JP-Narita…"). Gating the text path to a known set avoids matching random
// two-letter prefixes ("AI-…"). Flag emoji are decoded unconditionally.
const ISO_CODES = new Set([
  'US',
  'JP',
  'SG',
  'HK',
  'TW',
  'KR',
  'DE',
  'GB',
  'FR',
  'NL',
  'CA',
  'AU',
  'RU',
  'IN',
  'BR',
  'IT',
  'ES',
  'CH',
  'SE',
  'TR',
  'VN',
  'TH',
  'MY',
  'PH',
  'ID',
  'AR',
  'MX',
  'ZA',
  'AE',
  'IE',
  'PL',
  'FI',
  'NO',
  'DK',
  'AT',
])

// Two leading regional-indicator code points → alpha-2 code, else null.
function leadingFlagToCode(name: string): string | null {
  const cps = [...name]
  const first = cps[0]?.codePointAt(0) ?? 0
  const second = cps[1]?.codePointAt(0) ?? 0
  const inRange = (c: number) => c >= FLAG_OFFSET && c <= FLAG_OFFSET + 25
  if (inRange(first) && inRange(second)) {
    return (
      String.fromCharCode(A_CHARCODE + (first - FLAG_OFFSET)) +
      String.fromCharCode(A_CHARCODE + (second - FLAG_OFFSET))
    )
  }
  return null
}

// alpha-2 code → flag emoji (always renderable in a chip).
export function codeToFlag(code: string): string {
  if (code.length !== 2) return ''
  return [...code.toUpperCase()]
    .map((c) =>
      String.fromCodePoint(FLAG_OFFSET + (c.charCodeAt(0) - A_CHARCODE)),
    )
    .join('')
}

// Region of a node name (alpha-2 code), or null when unrecognized.
export function parseNodeRegion(name: string): string | null {
  const flagCode = leadingFlagToCode(name)
  if (flagCode) return flagCode

  const separator = name[2]
  const hasSeparator =
    separator === '_' || separator === '-' || separator?.trim() === ''
  const code =
    isAsciiLetter(name[0]) && isAsciiLetter(name[1]) && hasSeparator
      ? name.slice(0, 2).toUpperCase()
      : undefined
  if (code && ISO_CODES.has(code)) return code
  return null
}

export interface RegionFacet {
  code: string // alpha-2 code, or REGION_OTHER
  flag: string // emoji for real codes, '' for REGION_OTHER
  count: number
}

// Region facets for a node-name list, sorted by count desc then code asc.
// Unrecognized names collapse into a single REGION_OTHER facet, kept last.
export function getRegionFacets(names: string[]): RegionFacet[] {
  const counts = new Map<string, number>()
  for (const name of names) {
    const code = parseNodeRegion(name) ?? REGION_OTHER
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      flag: code === REGION_OTHER ? '' : codeToFlag(code),
      count,
    }))
    .sort((a, b) => {
      if (a.code === REGION_OTHER) return 1
      if (b.code === REGION_OTHER) return -1
      return b.count - a.count || a.code.localeCompare(b.code)
    })
}

// Keep only nodes whose region is in `selected` (alpha-2 codes and/or
// REGION_OTHER). Empty set imposes no constraint (returns the input ref).
export function filterNodesByRegion(
  names: string[],
  selected: Set<string>,
): string[] {
  if (selected.size === 0) return names
  return names.filter((n) => selected.has(parseNodeRegion(n) ?? REGION_OTHER))
}

// Region is parseable from the node name, but protocol type and UDP/XUDP
// support live on the node metadata — so these helpers take a lookup callback
// (the proxies store's getNode) to stay decoupled from the store.
interface NodeMeta {
  type: string
  udp: boolean
  xudp: boolean
}
type NodeMetaLookup = (name: string) => NodeMeta | undefined

export interface TypeFacet {
  type: string // raw proxy type, e.g. 'Shadowsocks' / 'Vmess'
  count: number
}

// Protocol-type facets for a node-name list, sorted by count desc then type asc.
// Nodes with no resolvable metadata/type are skipped.
export function getTypeFacets(
  names: string[],
  metaOf: NodeMetaLookup,
): TypeFacet[] {
  const counts = new Map<string, number>()
  for (const name of names) {
    const type = metaOf(name)?.type
    if (!type) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
}

// Keep only nodes whose type is in `selected`. Empty set imposes no constraint.
export function filterNodesByType(
  names: string[],
  selected: Set<string>,
  metaOf: NodeMetaLookup,
): string[] {
  if (selected.size === 0) return names
  return names.filter((n) => {
    const type = metaOf(n)?.type
    return type ? selected.has(type) : false
  })
}

export interface CapabilityFacet {
  udp: number
  xudp: number
}

// How many nodes in the list advertise UDP / XUDP support.
export function getCapabilityFacets(
  names: string[],
  metaOf: NodeMetaLookup,
): CapabilityFacet {
  let udp = 0
  let xudp = 0
  for (const name of names) {
    const meta = metaOf(name)
    if (meta?.udp) udp++
    if (meta?.xudp) xudp++
  }
  return { udp, xudp }
}

// Keep only nodes matching every enabled capability (AND). Both off imposes no
// constraint; nodes with no metadata are dropped once any capability is on.
export function filterNodesByCapability(
  names: string[],
  caps: { udp: boolean; xudp: boolean },
  metaOf: NodeMetaLookup,
): string[] {
  if (!caps.udp && !caps.xudp) return names
  return names.filter((n) => {
    const meta = metaOf(n)
    if (!meta) return false
    if (caps.udp && !meta.udp) return false
    if (caps.xudp && !meta.xudp) return false
    return true
  })
}

// Leading flag / emoji prefix: a regional-indicator pair (country flag) or a
// single pictographic emoji (variation selectors, skin-tone, tag and ZWJ
// sequences included — covers lone flags like 🏳 / 🏴 too), then any whitespace
// the provider already inserted after it.
const LEADING_FLAG_RE =
  /^(?:\p{Regional_Indicator}\p{Regional_Indicator}|\p{Extended_Pictographic}\uFE0F?)\s*/u

// Split a leading flag/emoji off a node name so the UI can render ONE consistent
// gap between flag and text. Strips the provider's own trailing space (so names
// that already include it don't end up double-gapped). `flag` is '' when the
// name doesn't start with a flag/emoji (then `rest` is the whole name).
export function splitLeadingFlag(name: string): { flag: string; rest: string } {
  const matched = name.match(LEADING_FLAG_RE)?.[0] ?? ''
  if (!matched) return { flag: '', rest: name }
  return {
    flag: matched.trimEnd(),
    rest: name.slice(matched.length),
  }
}

// String form of splitLeadingFlag for plain-text contexts (e.g. joined
// connection chains): normalizes the spacing to a single space after a leading
// flag/emoji. No-op when there's no leading flag.
export function gapLeadingFlag(name: string): string {
  const { flag, rest } = splitLeadingFlag(name)
  return flag ? `${flag} ${rest}` : name
}

export interface RuleFacet {
  value: string
  count: number
}

// Distinct values of a Rule field with occurrence counts, sorted by count desc
// then value asc. Build the type / policy chip lists from the UNFILTERED rules
// array so chip totals stay stable as the user toggles filters.
export function getRuleFacets(
  rules: Rule[],
  key: 'type' | 'proxy',
): RuleFacet[] {
  const counts = new Map<string, number>()
  for (const rule of rules) {
    const v = rule[key]
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

// Faceted filter for the rules page. Chips within one dimension OR together;
// across dimensions they AND. Empty type/policy arrays + status 'all' impose no
// constraint (fast-path returns the input reference untouched).
export function filterRules(
  rules: Rule[],
  {
    types,
    policies,
    status,
  }: {
    types: string[]
    policies: string[]
    status: 'all' | 'enabled' | 'disabled'
  },
): Rule[] {
  if (types.length === 0 && policies.length === 0 && status === 'all') {
    return rules
  }

  const typeSet = new Set(types)
  const policySet = new Set(policies)

  return rules.filter((rule) => {
    if (typeSet.size > 0 && !typeSet.has(rule.type)) return false
    if (policySet.size > 0 && !policySet.has(rule.proxy)) return false
    if (status !== 'all') {
      // Mihomo omits `disabled` for enabled rules, so missing extra = enabled.
      const isDisabled = rule.extra?.disabled === true
      if (status === 'enabled' && isDisabled) return false
      if (status === 'disabled' && !isDisabled) return false
    }

    return true
  })
}

// Non-mutating sort with a stable `index` tiebreak so equal keys keep config
// order. Missing extra/hitCount/hitAt are coerced safely; never-matched rules
// sink to the bottom for HIT_AT_DESC.
export function sortRulesByOrderingType(
  rules: Rule[],
  orderingType: RULES_ORDERING_TYPE,
): Rule[] {
  // API yields index order, which rules.vue already relies on — no copy needed.
  if (orderingType === RULES_ORDERING_TYPE.NATURAL) return rules

  const byIndex = (a: Rule, b: Rule) => a.index - b.index
  // Display falls back to `payload || type`; sort key must match what's shown.
  const nameKey = (r: Rule) => r.payload || r.type

  return [...rules].sort((a, b) => {
    switch (orderingType) {
      case RULES_ORDERING_TYPE.TYPE_ASC:
        return a.type.localeCompare(b.type) || byIndex(a, b)
      case RULES_ORDERING_TYPE.TYPE_DESC:
        return b.type.localeCompare(a.type) || byIndex(a, b)
      case RULES_ORDERING_TYPE.NAME_ASC:
        return nameKey(a).localeCompare(nameKey(b)) || byIndex(a, b)
      case RULES_ORDERING_TYPE.NAME_DESC:
        return nameKey(b).localeCompare(nameKey(a)) || byIndex(a, b)
      case RULES_ORDERING_TYPE.HIT_COUNT_DESC:
        return (
          (b.extra?.hitCount ?? 0) - (a.extra?.hitCount ?? 0) || byIndex(a, b)
        )
      case RULES_ORDERING_TYPE.HIT_COUNT_ASC:
        return (
          (a.extra?.hitCount ?? 0) - (b.extra?.hitCount ?? 0) || byIndex(a, b)
        )
      case RULES_ORDERING_TYPE.HIT_AT_DESC: {
        const at = a.extra?.hitAt
        const bt = b.extra?.hitAt
        if (!at && !bt) return byIndex(a, b)
        if (!at) return 1 // never-matched sinks to the bottom
        if (!bt) return -1

        return new Date(bt).getTime() - new Date(at).getTime() || byIndex(a, b)
      }
      default:
        return 0 // defensive: unknown stored value -> input order
    }
  })
}

// String boolean map helper
export function useStringBooleanMap() {
  const map = ref<Record<string, boolean>>({})

  const set = (name: string, value: boolean) => {
    map.value = { ...map.value, [name]: value }
  }

  const setWithCallback = async (
    name: string,
    callback: () => Promise<void>,
  ) => {
    set(name, true)
    try {
      await callback()
    } catch {
      /* empty */
    }
    set(name, false)
  }

  return { map, set, setWithCallback }
}

// Table filter helper
export function fuzzyFilter(
  row: { getValue: (columnId: string) => unknown },
  columnId: string,
  filterValue: string,
) {
  const value = row.getValue(columnId)
  if (value == null) return false
  return String(value).toLowerCase().includes(filterValue.toLowerCase())
}

// Theme helpers
// Get computed CSS variable value from :root
function getCSSVariable(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

// daisyUI theme color getters
export function getThemeColors() {
  return {
    // Base content color (text color)
    baseContent: getCSSVariable('--color-base-content') || 'oklch(0.746 0 0)',
    // Base 100/200/300 background colors
    base100: getCSSVariable('--color-base-100') || 'oklch(0.253 0 0)',
    base200: getCSSVariable('--color-base-200') || 'oklch(0.232 0 0)',
    base300: getCSSVariable('--color-base-300') || 'oklch(0.211 0 0)',
    // Primary color
    primary: getCSSVariable('--color-primary') || 'oklch(0.65 0.15 240)',
    primaryContent:
      getCSSVariable('--color-primary-content') || 'oklch(0.98 0 0)',
    // Secondary color
    secondary: getCSSVariable('--color-secondary') || 'oklch(0.65 0.15 300)',
    secondaryContent:
      getCSSVariable('--color-secondary-content') || 'oklch(0.98 0 0)',
    // Accent color
    accent: getCSSVariable('--color-accent') || 'oklch(0.65 0.15 180)',
    accentContent:
      getCSSVariable('--color-accent-content') || 'oklch(0.98 0 0)',
    // Neutral color
    neutral: getCSSVariable('--color-neutral') || 'oklch(0.3 0 0)',
    neutralContent:
      getCSSVariable('--color-neutral-content') || 'oklch(0.98 0 0)',
    // Info/Success/Warning/Error colors
    info: getCSSVariable('--color-info') || 'oklch(0.65 0.15 220)',
    success: getCSSVariable('--color-success') || 'oklch(0.65 0.15 140)',
    warning: getCSSVariable('--color-warning') || 'oklch(0.8 0.15 80)',
    error: getCSSVariable('--color-error') || 'oklch(0.65 0.2 25)',
  }
}

// Get chart-specific colors derived from theme
export function getChartThemeColors() {
  const theme = getThemeColors()

  return {
    // Text colors
    textColor: theme.baseContent,
    textColorHover: theme.primaryContent,
    // Grid and axis colors
    gridLineColor: theme.base300,
    lineColor: theme.base300,
    tickColor: theme.base300,
    // Series colors (using theme accent colors)
    seriesColors: [theme.info, theme.success, theme.warning, theme.error],
    // Background - use base200 to match card background
    backgroundColor: theme.base200,
  }
}

export function encodeSvg(svg: string) {
  return svg
    .replace(
      '<svg',
      svg.includes('xmlns')
        ? '<svg'
        : '<svg xmlns="http://www.w3.org/2000/svg"',
    )
    .replaceAll('"', "'")
    .replaceAll('%', '%25')
    .replaceAll('#', '%23')
    .replaceAll('{', '%7B')
    .replaceAll('}', '%7D')
    .replaceAll('<', '%3C')
    .replaceAll('>', '%3E')
}

// Resolve the active group for master-detail: keep `current` if it still exists,
// otherwise fall back to the first group (or null when there are none).
export function resolveActiveGroup(
  groupNames: string[],
  current: string | null,
): string | null {
  if (current && groupNames.includes(current)) return current
  return groupNames[0] ?? null
}
