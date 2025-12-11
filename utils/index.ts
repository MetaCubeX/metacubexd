import type {
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
} from '~/constants'
import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'
import relativeTime from 'dayjs/plugin/relativeTime'
import { PROXIES_ORDERING_TYPE } from '~/constants'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/ru'

// Type for latency quality map (can be either HTTP or HTTPS)
type LatencyQualityMap =
  | typeof LATENCY_QUALITY_MAP_HTTP
  | typeof LATENCY_QUALITY_MAP_HTTPS

dayjs.extend(relativeTime)
dayjs.extend(duration)

// URL helpers
export function transformEndpointURL(url: string) {
  return /^https?:\/\//.test(url) ? url : `${window.location.protocol}//${url}`
}

export function formatIPv6(ip: string) {
  const regexr = /:{1,2}/
  if (regexr.test(ip)) {
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
export function formatProxyType(type: string = '', t: (key: string) => string) {
  const lt = type.toLowerCase()
  const formatMap = new Map([
    ['shadowsocks', 'SS'],
    ['shadowsocksr', 'SSR'],
    ['hysteria', 'HY'],
    ['hysteria2', 'HY2'],
    ['wireguard', 'WG'],
    ['selector', t('selector')],
    ['urltest', t('urltest')],
    ['fallback', t('fallback')],
    ['loadbalance', t('loadbalance')],
    ['direct', t('direct')],
    ['reject', t('reject')],
    ['rejectdrop', t('rejectdrop')],
    ['relay', t('relay')],
    ['pass', t('pass')],
  ])

  if (formatMap.has(lt)) {
    return formatMap.get(lt)
  }
  return lt
}

export function getLatencyClassName(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
) {
  if (latency > latencyQualityMap.HIGH) {
    return 'text-red-500'
  } else if (latency > latencyQualityMap.MEDIUM) {
    return 'text-yellow-500'
  } else if (latency === latencyQualityMap.NOT_CONNECTED) {
    return 'text-gray'
  }
  return 'text-green-600'
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
  latencyQualityMap,
  urlForLatencyTest,
}: {
  proxyNames: string[]
  orderingType: PROXIES_ORDERING_TYPE
  testUrl: string | null
  getLatencyByName: (name: string, testUrl: string | null) => number
  latencyQualityMap: LatencyQualityMap
  urlForLatencyTest: string
}) {
  if (orderingType === PROXIES_ORDERING_TYPE.NATURAL) {
    return proxyNames
  }

  const finalTestUrl = testUrl || urlForLatencyTest

  return [...proxyNames].sort((a, b) => {
    const prevLatency = getLatencyByName(a, finalTestUrl)
    const nextLatency = getLatencyByName(b, finalTestUrl)

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

// SVG encoder for proxy icons
export function encodeSvg(svg: string) {
  return svg
    .replace(
      '<svg',
      ~svg.indexOf('xmlns')
        ? '<svg'
        : '<svg xmlns="http://www.w3.org/2000/svg"',
    )
    .replace(/"/g, "'")
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/\{/g, '%7B')
    .replace(/\}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
}
