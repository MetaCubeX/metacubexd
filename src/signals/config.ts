import { makePersisted } from '@solid-primitives/storage'
import {
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  DEFAULT_LOGS_TABLE_MAX_ROWS,
  LATENCY_QUALITY_MAP_HTTP,
  LATENCY_QUALITY_MAP_HTTPS,
  LOG_LEVEL,
  PROXIES_ORDERING_TYPE,
  PROXIES_PREVIEW_TYPE,
  TAILWINDCSS_SIZE,
  themes,
} from '~/constants'
import {
  ConnectionsTableColumnOrder,
  ConnectionsTableColumnVisibility,
} from '~/types'

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(PROXIES_PREVIEW_TYPE.Auto),
  { name: 'proxiesPreviewType', storage: localStorage },
)
export const [proxiesOrderingType, setProxiesOrderingType] = makePersisted(
  createSignal(PROXIES_ORDERING_TYPE.NATURAL),
  { name: 'proxiesOrderingType', storage: localStorage },
)

export const [hideUnAvailableProxies, setHideUnAvailableProxies] =
  makePersisted(createSignal(false), {
    name: 'hideUnAvailableProxies',
    storage: localStorage,
  })

export const [renderProxiesInTwoColumns, setRenderProxiesInTwoColumns] =
  makePersisted(createSignal(true), {
    name: 'renderProxiesInTwoColumns',
    storage: localStorage,
  })

export const [urlForLatencyTest, setUrlForLatencyTest] = makePersisted(
  createSignal('https://www.gstatic.com/generate_204'),
  { name: 'urlForLatencyTest', storage: localStorage },
)

export const [urlForIPv6SupportTest, setUrlIPv6SupportTest] = makePersisted(
  createSignal('https://ipv6.google.com'),
  { name: 'urlForIPv6SupportTest', storage: localStorage },
)

export const [autoCloseConns, setAutoCloseConns] = makePersisted(
  createSignal(false),
  { name: 'autoCloseConns', storage: localStorage },
)
export const [useTwemoji, setUseTwemoji] = makePersisted(createSignal(true), {
  name: 'useTwemoji',
  storage: localStorage,
})
export const [autoSwitchTheme, setAutoSwitchTheme] = makePersisted(
  createSignal(false),
  { name: 'autoSwitchTheme', storage: localStorage },
)
export const [favDayTheme, setFavDayTheme] = makePersisted(
  createSignal<(typeof themes)[number]>('nord'),
  { name: 'favDayTheme', storage: localStorage },
)
export const [favNightTheme, setFavNightTheme] = makePersisted(
  createSignal<(typeof themes)[number]>('sunset'),
  { name: 'favNightTheme', storage: localStorage },
)
export const [connectionsTableSize, setConnectionsTableSize] = makePersisted(
  createSignal<TAILWINDCSS_SIZE>(TAILWINDCSS_SIZE.XS),
  { name: 'connectionsTableSize', storage: localStorage },
)
export const [
  connectionsTableColumnVisibility,
  setConnectionsTableColumnVisibility,
] = makePersisted(
  createSignal<ConnectionsTableColumnVisibility>(
    CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  ),
  {
    name: 'connectionsTableColumnVisibility',
    storage: localStorage,
  },
)
export const [connectionsTableColumnOrder, setConnectionsTableColumnOrder] =
  makePersisted(
    createSignal<ConnectionsTableColumnOrder>(
      CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
    ),
    {
      name: 'connectionsTableColumnOrder',
      storage: localStorage,
    },
  )
export const [clientSourceIPTags, setClientSourceIPTags] = makePersisted(
  createSignal<{ tagName: string; sourceIP: string }[]>([]),
  {
    name: 'clientSourceIPTags',
    storage: localStorage,
  },
)
export const [logsTableSize, setLogsTableSize] = makePersisted(
  createSignal<TAILWINDCSS_SIZE>(TAILWINDCSS_SIZE.XS),
  { name: 'logsTableSize', storage: localStorage },
)
export const [logLevel, setLogLevel] = makePersisted(
  createSignal<LOG_LEVEL>(LOG_LEVEL.Info),
  { name: 'logLevel', storage: localStorage },
)
export const [logMaxRows, setLogMaxRows] = makePersisted(
  createSignal(DEFAULT_LOGS_TABLE_MAX_ROWS),
  {
    name: 'logMaxRows',
    storage: localStorage,
  },
)

export const tableSizeClassName = (size: TAILWINDCSS_SIZE) => {
  let className = 'table-xs'

  switch (size) {
    case TAILWINDCSS_SIZE.XS:
      className = 'table-xs'
      break
    case TAILWINDCSS_SIZE.SM:
      className = 'table-sm'
      break
    case TAILWINDCSS_SIZE.MD:
      className = 'table-md'
      break
    case TAILWINDCSS_SIZE.LG:
      className = 'table-lg'
      break
  }

  return className
}

export const [latencyTestTimeoutDuration, setLatencyTestTimeoutDuration] =
  makePersisted(createSignal(5000), {
    name: 'latencyTestTimeoutDuration',
    storage: localStorage,
  })

export const isLatencyTestByHttps = () =>
  urlForLatencyTest().startsWith('https')

export const latencyQualityMap = () =>
  isLatencyTestByHttps() ? LATENCY_QUALITY_MAP_HTTPS : LATENCY_QUALITY_MAP_HTTP
