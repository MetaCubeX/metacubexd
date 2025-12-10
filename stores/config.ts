import type { themes } from '~/constants'
import type {
  ConnectionsTableColumnOrder,
  ConnectionsTableColumnVisibility,
} from '~/types'
import { defineStore } from 'pinia'
import {
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  DEFAULT_LOGS_TABLE_MAX_ROWS,
  LANG,
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
  LOG_LEVEL,
  PROXIES_DISPLAY_MODE,
  PROXIES_ORDERING_TYPE,
  PROXIES_PREVIEW_TYPE,
  TAILWINDCSS_SIZE,
} from '~/constants'

export const useConfigStore = defineStore('config', () => {
  // Theme
  const curTheme = useLocalStorage<(typeof themes)[number]>('theme', 'sunset')
  const autoSwitchTheme = useLocalStorage('autoSwitchTheme', false)
  const favDayTheme = useLocalStorage<(typeof themes)[number]>(
    'favDayTheme',
    'nord',
  )
  const favNightTheme = useLocalStorage<(typeof themes)[number]>(
    'favNightTheme',
    'sunset',
  )

  // Proxies settings
  const proxiesPreviewType = useLocalStorage<PROXIES_PREVIEW_TYPE>(
    'proxiesPreviewType',
    PROXIES_PREVIEW_TYPE.Auto,
  )
  const proxiesOrderingType = useLocalStorage<PROXIES_ORDERING_TYPE>(
    'proxiesOrderingType',
    PROXIES_ORDERING_TYPE.NATURAL,
  )
  const proxiesDisplayMode = useLocalStorage<PROXIES_DISPLAY_MODE>(
    'proxiesDisplayMode',
    PROXIES_DISPLAY_MODE.CARD,
  )
  const renderProxiesInTwoColumns = useLocalStorage(
    'renderProxiesInTwoColumns',
    true,
  )
  const hideUnAvailableProxies = useLocalStorage(
    'hideUnAvailableProxies',
    false,
  )
  const urlForLatencyTest = useLocalStorage(
    'urlForLatencyTest',
    'https://www.gstatic.com/generate_204',
  )
  const autoCloseConns = useLocalStorage('autoCloseConns', true)
  const latencyTestTimeoutDuration = useLocalStorage(
    'latencyTestTimeoutDuration',
    5000,
  )
  const iconHeight = useLocalStorage('iconHeight', 24)
  const iconMarginRight = useLocalStorage('iconMarginRight', 8)

  // Auto switch endpoint
  const autoSwitchEndpoint = useLocalStorage('autoSwitchEndpoint', false)

  // Twemoji support
  const enableTwemoji = useLocalStorage('enableTwemoji', false)

  // Locale
  const locale = useLocalStorage<LANG>(
    'lang',
    typeof navigator !== 'undefined' && navigator.language in LANG
      ? (navigator.language as LANG)
      : LANG.EN,
  )

  // Connections table settings
  const connectionsTableSize = useLocalStorage<TAILWINDCSS_SIZE>(
    'connectionsTableSize',
    TAILWINDCSS_SIZE.XS,
  )
  const connectionsTableColumnVisibility =
    useLocalStorage<ConnectionsTableColumnVisibility>(
      'connectionsTableColumnVisibility',
      CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
    )
  const connectionsTableColumnOrder =
    useLocalStorage<ConnectionsTableColumnOrder>(
      'connectionsTableColumnOrder',
      CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
    )

  // Logs settings
  const logsTableSize = useLocalStorage<TAILWINDCSS_SIZE>(
    'logsTableSize',
    TAILWINDCSS_SIZE.XS,
  )
  const logLevel = useLocalStorage<LOG_LEVEL>('logLevel', LOG_LEVEL.Info)
  const logMaxRows = useLocalStorage('logMaxRows', DEFAULT_LOGS_TABLE_MAX_ROWS)

  // Quick filter regex for connections
  const quickFilterRegex = useLocalStorage(
    'quickFilterRegex',
    'DIRECT|direct|dns-out',
  )

  // Client source IP tags
  const clientSourceIPTags = useLocalStorage<
    { tagName: string; sourceIP: string }[]
  >('clientSourceIPTags', [])

  // Computed
  const isLatencyTestByHttps = computed(() =>
    urlForLatencyTest.value.startsWith('https'),
  )

  const latencyQualityMap = computed(() =>
    isLatencyTestByHttps.value
      ? LATENCY_QUALITY_MAP_HTTPS
      : LATENCY_QUALITY_MAP_HTTP,
  )

  const tableSizeClassName = (size: TAILWINDCSS_SIZE) => {
    const classMap: Record<TAILWINDCSS_SIZE, string> = {
      [TAILWINDCSS_SIZE.XS]: 'table-xs',
      [TAILWINDCSS_SIZE.SM]: 'table-sm',
      [TAILWINDCSS_SIZE.MD]: 'table-md',
      [TAILWINDCSS_SIZE.LG]: 'table-lg',
    }
    return classMap[size] || 'table-xs'
  }

  // Reset functions
  const resetProxiesSettings = () => {
    proxiesPreviewType.value = PROXIES_PREVIEW_TYPE.Auto
    proxiesOrderingType.value = PROXIES_ORDERING_TYPE.NATURAL
    proxiesDisplayMode.value = PROXIES_DISPLAY_MODE.CARD
    renderProxiesInTwoColumns.value = true
    hideUnAvailableProxies.value = false
    urlForLatencyTest.value = 'https://www.gstatic.com/generate_204'
    autoCloseConns.value = true
    latencyTestTimeoutDuration.value = 5000
    iconHeight.value = 24
    iconMarginRight.value = 8
  }

  const resetXdConfig = () => {
    autoSwitchTheme.value = false
    autoSwitchEndpoint.value = false
    enableTwemoji.value = false
    favDayTheme.value = 'nord'
    favNightTheme.value = 'sunset'
    curTheme.value = 'sunset'
  }

  return {
    // Theme
    curTheme,
    autoSwitchTheme,
    favDayTheme,
    favNightTheme,
    // Proxies
    proxiesPreviewType,
    proxiesOrderingType,
    proxiesDisplayMode,
    renderProxiesInTwoColumns,
    hideUnAvailableProxies,
    urlForLatencyTest,
    autoCloseConns,
    latencyTestTimeoutDuration,
    iconHeight,
    iconMarginRight,
    // Endpoint
    autoSwitchEndpoint,
    // Twemoji
    enableTwemoji,
    // Locale
    locale,
    // Connections
    connectionsTableSize,
    connectionsTableColumnVisibility,
    connectionsTableColumnOrder,
    quickFilterRegex,
    // Logs
    logsTableSize,
    logLevel,
    logMaxRows,
    // Client tags
    clientSourceIPTags,
    // Computed
    isLatencyTestByHttps,
    latencyQualityMap,
    // Functions
    tableSizeClassName,
    resetProxiesSettings,
    resetXdConfig,
  }
})
