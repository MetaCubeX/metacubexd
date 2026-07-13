import type { themes } from '~/constants'
import type {
  ConnectionsTableColumnOrder,
  ConnectionsTableColumnVisibility,
} from '~/types'
import type { IPProvider } from '~/types/network'
import { defineStore } from 'pinia'
import {
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  DEFAULT_LOGS_TABLE_MAX_ROWS,
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
  LOG_LEVEL,
  PROXIES_CARD_SIZE,
  PROXIES_DISPLAY_MODE,
  PROXIES_ORDERING_TYPE,
  PROXIES_PREVIEW_TYPE,
  RULES_ORDERING_TYPE,
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
  const proxiesPreviewAutoThreshold = useLocalStorage<number>(
    'proxiesPreviewAutoThreshold',
    10,
  )
  const proxiesOrderingType = useLocalStorage<PROXIES_ORDERING_TYPE>(
    'proxiesOrderingType',
    PROXIES_ORDERING_TYPE.QUALITY_DESC,
  )
  const proxiesDisplayMode = useLocalStorage<PROXIES_DISPLAY_MODE>(
    'proxiesDisplayMode',
    PROXIES_DISPLAY_MODE.CARD,
  )
  const renderProxiesInTwoColumns = useLocalStorage(
    'renderProxiesInTwoColumns',
    true,
  )
  // Node-card density: controls how many cards fit per row (see PROXIES_CARD_SIZE_MIN_WIDTH)
  const proxiesCardSize = useLocalStorage<PROXIES_CARD_SIZE>(
    'proxiesCardSize',
    PROXIES_CARD_SIZE.COMFORTABLE,
  )
  const hideUnAvailableProxies = useLocalStorage(
    'hideUnAvailableProxies',
    false,
  )
  const urlForLatencyTest = useLocalStorage(
    'urlForLatencyTest',
    'https://www.gstatic.com/generate_204',
  )
  // Which URL a latency test probes against (#2082):
  //   'core'      — the kernel's per-group/per-provider `testUrl` wins, falling
  //                 back to the dashboard url when a group defines none. Lets two
  //                 groups over the same nodes test against different urls.
  //   'dashboard' — the single dashboard url always wins, overriding any
  //                 per-group url (a uniform probe across every group).
  const latencyTestUrlSource = useLocalStorage<'core' | 'dashboard'>(
    'latencyTestUrlSource',
    'core',
  )
  const autoCloseConns = useLocalStorage('autoCloseConns', true)
  const latencyTestTimeoutDuration = useLocalStorage(
    'latencyTestTimeoutDuration',
    5000,
  )
  // Latency color thresholds. 0 = auto (use protocol-based defaults).
  const latencyMediumThreshold = useLocalStorage('latencyMediumThreshold', 0)
  const latencyHighThreshold = useLocalStorage('latencyHighThreshold', 0)
  const iconHeight = useLocalStorage('iconHeight', 24)
  const iconMarginRight = useLocalStorage('iconMarginRight', 8)

  // Auto switch endpoint
  const autoSwitchEndpoint = useLocalStorage('autoSwitchEndpoint', false)

  // Twemoji support
  const enableTwemoji = useLocalStorage('enableTwemoji', false)

  // Sidebar expanded state (PC only)
  const sidebarExpanded = useLocalStorage('sidebarExpanded', false)

  // Mobile navigation type (bottom nav vs side drawer)
  const useMobileBottomNav = useLocalStorage('useMobileBottomNav', true)

  // Default start page
  const defaultPage = useLocalStorage('defaultPage', 'overview')

  // First-run onboarding (desktop/server agent mode only). Set true once the
  // user completes OR skips the welcome wizard so it never reappears. The
  // persistent empty-state banners deliberately ignore this flag — they keep
  // nudging until a base profile actually exists.
  const onboardingDismissed = useLocalStorage('onboardingDismissed', false)

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
  // One-time migration from useMobileConnectionsTable boolean
  // Must be done before useLocalStorage reads the key so the factory isn't
  // called multiple times (VueUse calls the factory twice internally).
  const _connectionsDisplayModeDefault = (() => {
    if (localStorage.getItem('connectionsDisplayMode') !== null) {
      return 'auto' as const // new key already present; default is irrelevant
    }
    const legacyRaw = localStorage.getItem('useMobileConnectionsTable')
    if (legacyRaw !== null) {
      localStorage.removeItem('useMobileConnectionsTable')
      try {
        return (JSON.parse(legacyRaw) === true ? 'table' : 'auto') as
          'auto' | 'table' | 'card'
      } catch {
        return 'auto' as const
      }
    }
    return 'auto' as const
  })()
  const connectionsDisplayMode = useLocalStorage<'auto' | 'table' | 'card'>(
    'connectionsDisplayMode',
    _connectionsDisplayModeDefault,
  )

  // Logs settings
  const logsTableSize = useLocalStorage<TAILWINDCSS_SIZE>(
    'logsTableSize',
    TAILWINDCSS_SIZE.XS,
  )
  const logLevel = useLocalStorage<LOG_LEVEL>('logLevel', LOG_LEVEL.Info)
  const logMaxRows = useLocalStorage('logMaxRows', DEFAULT_LOGS_TABLE_MAX_ROWS)

  // Literal quick-filter terms for connections. Keep the legacy storage key so
  // existing pipe-separated defaults and user preferences migrate in place.
  const quickFilterText = useLocalStorage(
    'quickFilterRegex',
    'DIRECT|direct|dns-out',
  )

  // Client source IP tags
  const clientSourceIPTags = useLocalStorage<
    { tagName: string; sourceIP: string }[]
  >('clientSourceIPTags', [])

  // Overview settings
  const showNetworkTopology = useLocalStorage('showNetworkTopology', false)

  // Data usage tracking. When enabled, every connections WebSocket message is
  // diffed per-connection and buffered into IndexedDB so the Data Usage page
  // can show historical stats. This is a metacubexd-only feature that runs on
  // EVERY page (the connections socket is global); turning it off removes the
  // largest piece of per-second background work for users who don't need it.
  const enableDataUsageTracking = useLocalStorage(
    'enableDataUsageTracking',
    true,
  )

  // Proxies: in-group node name filter (case-insensitive substring on node name)
  const proxiesGroupNameFilter = useLocalStorage('proxiesGroupNameFilter', '')
  // Proxies: show an A-Z quick-jump index rail for long node lists
  const enableProxiesAlphabetIndex = useLocalStorage(
    'enableProxiesAlphabetIndex',
    false,
  )

  // Rules: sort order + quick-filter selections (persisted across reloads).
  // Sort is a standalone preference; the filters reset together via
  // resetRulesFilters. Empty type/policy arrays + 'all' status = no constraint.
  const rulesOrderingType = useLocalStorage<RULES_ORDERING_TYPE>(
    'rulesOrderingType',
    RULES_ORDERING_TYPE.NATURAL,
  )
  const rulesTypeFilter = useLocalStorage<string[]>('rulesTypeFilter', [])
  const rulesPolicyFilter = useLocalStorage<string[]>('rulesPolicyFilter', [])
  const rulesStatusFilter = useLocalStorage<'all' | 'enabled' | 'disabled'>(
    'rulesStatusFilter',
    'all',
  )

  const resetRulesFilters = () => {
    rulesTypeFilter.value = []
    rulesPolicyFilter.value = []
    rulesStatusFilter.value = 'all'
  }

  // Connections: per-connection GeoIP enrichment (country flag / city / ASN).
  // Off by default because it issues outbound requests to a 3rd-party IP API.
  const showConnectionGeoIP = useLocalStorage('showConnectionGeoIP', false)
  const connectionGeoIPProvider = useLocalStorage<IPProvider>(
    'connectionGeoIPProvider',
    'ipwho.is',
  )

  // Resolve IPs to hostnames via reverse DNS (PTR) through mihomo's dns/query
  // endpoint. Off by default; needs mihomo's DNS configured for reverse zones.
  const resolveClientHostname = useLocalStorage('resolveClientHostname', false)

  // Appearance: custom background. 'custom' = user-uploaded image (IndexedDB),
  // 'url' = remote image URL (e.g. a Bing daily-wallpaper endpoint).
  const backgroundImageType = useLocalStorage<'none' | 'custom' | 'url'>(
    'backgroundImageType',
    'none',
  )
  // Remote image URL used when backgroundImageType === 'url'
  const backgroundImageUrl = useLocalStorage('backgroundImageUrl', '')
  // Backdrop blur radius (px) applied over the background image
  const backgroundBlur = useLocalStorage('backgroundBlur', 0)
  // Opacity (%) of the base surface laid over the background image, so cards/text
  // stay legible. 100 = fully opaque (background hidden), 0 = fully transparent.
  const backgroundOverlayOpacity = useLocalStorage(
    'backgroundOverlayOpacity',
    70,
  )
  // Appearance: custom DaisyUI theme color overrides (CSS custom properties).
  const enableCustomThemeColors = useLocalStorage(
    'enableCustomThemeColors',
    false,
  )
  // Map of DaisyUI color token -> CSS color value, e.g. { primary: '#...' }.
  const customThemeColors = useLocalStorage<Record<string, string>>(
    'customThemeColors',
    {},
  )
  // Appearance: UI font family ('' = default bundled stack)
  const fontFamily = useLocalStorage('fontFamily', '')
  // Appearance: advanced custom CSS injected into <head> ('' = none). Lets power
  // users restyle the dashboard arbitrarily; see useCustomCss for application.
  const customCss = useLocalStorage('customCss', '')

  // Resolve the effective latency-test URL for a group/provider/node given its
  // kernel-configured `testUrl`, honoring latencyTestUrlSource (#2082). In
  // 'core' mode this is the historical `groupTestUrl || urlForLatencyTest`; in
  // 'dashboard' mode the dashboard url always overrides.
  const resolveLatencyTestUrl = (groupTestUrl?: string | null) =>
    latencyTestUrlSource.value === 'dashboard'
      ? urlForLatencyTest.value
      : groupTestUrl || urlForLatencyTest.value

  // Computed
  const isLatencyTestByHttps = computed(() =>
    urlForLatencyTest.value.startsWith('https'),
  )

  const latencyQualityMap = computed(() => {
    const defaults = isLatencyTestByHttps.value
      ? LATENCY_QUALITY_MAP_HTTPS
      : LATENCY_QUALITY_MAP_HTTP
    const medium =
      latencyMediumThreshold.value > 0
        ? latencyMediumThreshold.value
        : defaults.MEDIUM
    const high =
      latencyHighThreshold.value > 0
        ? latencyHighThreshold.value
        : defaults.HIGH
    return {
      NOT_CONNECTED: defaults.NOT_CONNECTED,
      MEDIUM: medium,
      HIGH: high,
    }
  })

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
    proxiesOrderingType.value = PROXIES_ORDERING_TYPE.QUALITY_DESC
    proxiesDisplayMode.value = PROXIES_DISPLAY_MODE.CARD
    renderProxiesInTwoColumns.value = true
    proxiesCardSize.value = PROXIES_CARD_SIZE.COMFORTABLE
    hideUnAvailableProxies.value = false
    urlForLatencyTest.value = 'https://www.gstatic.com/generate_204'
    latencyTestUrlSource.value = 'core'
    autoCloseConns.value = true
    latencyTestTimeoutDuration.value = 5000
    latencyMediumThreshold.value = 0
    latencyHighThreshold.value = 0
    iconHeight.value = 24
    iconMarginRight.value = 8
    proxiesGroupNameFilter.value = ''
    enableProxiesAlphabetIndex.value = false
  }

  const resetXdConfig = () => {
    autoSwitchTheme.value = false
    autoSwitchEndpoint.value = false
    enableTwemoji.value = false
    useMobileBottomNav.value = true
    favDayTheme.value = 'nord'
    favNightTheme.value = 'sunset'
    curTheme.value = 'sunset'
    defaultPage.value = 'overview'
    onboardingDismissed.value = false
    enableDataUsageTracking.value = true
    backgroundImageType.value = 'none'
    backgroundImageUrl.value = ''
    backgroundBlur.value = 0
    backgroundOverlayOpacity.value = 70
    enableCustomThemeColors.value = false
    customThemeColors.value = {}
    fontFamily.value = ''
    customCss.value = ''
  }

  return {
    // Theme
    curTheme,
    autoSwitchTheme,
    favDayTheme,
    favNightTheme,
    // Proxies
    proxiesPreviewType,
    proxiesPreviewAutoThreshold,
    proxiesOrderingType,
    proxiesDisplayMode,
    renderProxiesInTwoColumns,
    proxiesCardSize,
    hideUnAvailableProxies,
    urlForLatencyTest,
    latencyTestUrlSource,
    resolveLatencyTestUrl,
    autoCloseConns,
    latencyTestTimeoutDuration,
    latencyMediumThreshold,
    latencyHighThreshold,
    iconHeight,
    iconMarginRight,
    // Endpoint
    autoSwitchEndpoint,
    // Twemoji
    enableTwemoji,
    // Sidebar
    sidebarExpanded,
    // Mobile navigation
    useMobileBottomNav,
    // Default page
    defaultPage,
    // First-run onboarding
    onboardingDismissed,
    // Connections
    connectionsTableSize,
    connectionsTableColumnVisibility,
    connectionsTableColumnOrder,
    connectionsDisplayMode,
    quickFilterText,
    // Logs
    logsTableSize,
    logLevel,
    logMaxRows,
    // Client tags
    clientSourceIPTags,
    // Overview
    showNetworkTopology,
    // Data usage
    enableDataUsageTracking,
    // Proxies in-group filter & alphabet index
    proxiesGroupNameFilter,
    enableProxiesAlphabetIndex,
    // Rules
    rulesOrderingType,
    rulesTypeFilter,
    rulesPolicyFilter,
    rulesStatusFilter,
    resetRulesFilters,
    // Connections GeoIP
    showConnectionGeoIP,
    connectionGeoIPProvider,
    // Reverse-DNS hostname resolution
    resolveClientHostname,
    // Appearance
    backgroundImageType,
    backgroundImageUrl,
    backgroundBlur,
    backgroundOverlayOpacity,
    enableCustomThemeColors,
    customThemeColors,
    fontFamily,
    customCss,
    // Computed
    isLatencyTestByHttps,
    latencyQualityMap,
    // Functions
    tableSizeClassName,
    resetProxiesSettings,
    resetXdConfig,
  }
})
