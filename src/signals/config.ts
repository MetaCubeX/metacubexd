import { makePersisted } from '@solid-primitives/storage'
import {
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
  DEFAULT_LOGS_TABLE_MAX_ROWS,
  FONT_FAMILY,
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

export const proxiesPreviewTypeDefault = PROXIES_PREVIEW_TYPE.Auto

export const [proxiesPreviewType, setProxiesPreviewType] = makePersisted(
  createSignal(proxiesPreviewTypeDefault),
  { name: 'proxiesPreviewType', storage: localStorage },
)

export const proxiesOrderingTypeDefault = PROXIES_ORDERING_TYPE.NATURAL

export const [proxiesOrderingType, setProxiesOrderingType] = makePersisted(
  createSignal(proxiesOrderingTypeDefault),
  { name: 'proxiesOrderingType', storage: localStorage },
)

export const renderProxiesInTwoColumnsDefault = true

export const [renderProxiesInTwoColumns, setRenderProxiesInTwoColumns] =
  makePersisted(createSignal(renderProxiesInTwoColumnsDefault), {
    name: 'renderProxiesInTwoColumns',
    storage: localStorage,
  })

export const hideUnAvailableProxiesDefault = false

export const [hideUnAvailableProxies, setHideUnAvailableProxies] =
  makePersisted(createSignal(hideUnAvailableProxiesDefault), {
    name: 'hideUnAvailableProxies',
    storage: localStorage,
  })

export const urlForLatencyTestDefault = 'https://www.gstatic.com/generate_204'

export const [urlForLatencyTest, setUrlForLatencyTest] = makePersisted(
  createSignal(urlForLatencyTestDefault),
  { name: 'urlForLatencyTest', storage: localStorage },
)

export const autoCloseConnsDefault = true

export const [autoCloseConns, setAutoCloseConns] = makePersisted(
  createSignal(autoCloseConnsDefault),
  { name: 'autoCloseConns', storage: localStorage },
)

export const fontFamilyDefault = FONT_FAMILY.SystemUI

export const [fontFamily, setFontFamily] = makePersisted(
  createSignal(fontFamilyDefault),
  { name: 'fontFamily', storage: localStorage },
)

export const autoSwitchThemeDefault = false

export const [autoSwitchTheme, setAutoSwitchTheme] = makePersisted(
  createSignal(autoSwitchThemeDefault),
  { name: 'autoSwitchTheme', storage: localStorage },
)

export const favDayThemeDefault: (typeof themes)[number] = 'nord'

export const [favDayTheme, setFavDayTheme] = makePersisted(
  createSignal<(typeof themes)[number]>(favDayThemeDefault),
  { name: 'favDayTheme', storage: localStorage },
)

export const favNightThemeDefault: (typeof themes)[number] = 'sunset'

export const [favNightTheme, setFavNightTheme] = makePersisted(
  createSignal<(typeof themes)[number]>(favNightThemeDefault),
  { name: 'favNightTheme', storage: localStorage },
)

export const connectionsTableSizeDefault = TAILWINDCSS_SIZE.XS

export const [connectionsTableSize, setConnectionsTableSize] = makePersisted(
  createSignal(connectionsTableSizeDefault),
  { name: 'connectionsTableSize', storage: localStorage },
)

export const connectionsTableColumnVisibilityDefault =
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY

export const [
  connectionsTableColumnVisibility,
  setConnectionsTableColumnVisibility,
] = makePersisted(
  createSignal<ConnectionsTableColumnVisibility>(
    connectionsTableColumnVisibilityDefault,
  ),
  {
    name: 'connectionsTableColumnVisibility',
    storage: localStorage,
  },
)

export const connectionsTableColumnOrderDefault =
  CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER

export const [connectionsTableColumnOrder, setConnectionsTableColumnOrder] =
  makePersisted(
    createSignal<ConnectionsTableColumnOrder>(
      connectionsTableColumnOrderDefault,
    ),
    {
      name: 'connectionsTableColumnOrder',
      storage: localStorage,
    },
  )

export const clientSourceIPTagsDefault: {
  tagName: string
  sourceIP: string
}[] = []

export const [clientSourceIPTags, setClientSourceIPTags] = makePersisted(
  createSignal(clientSourceIPTagsDefault),
  {
    name: 'clientSourceIPTags',
    storage: localStorage,
  },
)

export const logsTableSizeDefault = TAILWINDCSS_SIZE.XS

export const [logsTableSize, setLogsTableSize] = makePersisted(
  createSignal(logsTableSizeDefault),
  { name: 'logsTableSize', storage: localStorage },
)

export const logLevelDefault = LOG_LEVEL.Info

export const [logLevel, setLogLevel] = makePersisted(
  createSignal(logLevelDefault),
  { name: 'logLevel', storage: localStorage },
)

export const logMaxRowsDefault = DEFAULT_LOGS_TABLE_MAX_ROWS

export const [logMaxRows, setLogMaxRows] = makePersisted(
  createSignal(logMaxRowsDefault),
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

export const latencyTestTimeoutDurationDefault = 5000

export const [latencyTestTimeoutDuration, setLatencyTestTimeoutDuration] =
  makePersisted(createSignal(latencyTestTimeoutDurationDefault), {
    name: 'latencyTestTimeoutDuration',
    storage: localStorage,
  })

export const isLatencyTestByHttps = () =>
  urlForLatencyTest().startsWith('https')

export const latencyQualityMap = () =>
  isLatencyTestByHttps() ? LATENCY_QUALITY_MAP_HTTPS : LATENCY_QUALITY_MAP_HTTP

export const iconHeightDefault = 24

export const [iconHeight, setIconHeight] = makePersisted(
  createSignal(iconHeightDefault),
  {
    name: 'iconHeight',
    storage: localStorage,
  },
)

export const iconMarginRightDefault = 8

export const [iconMarginRight, setIconMarginRight] = makePersisted(
  createSignal(iconMarginRightDefault),
  { name: 'iconMarginRight', storage: localStorage },
)
