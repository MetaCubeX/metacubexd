import { LATENCY_QUALITY_MAP_HTTP, PROXIES_ORDERING_TYPE } from '~/constants'
import { useI18n } from '~/i18n'
import { latencyQualityMap, urlForLatencyTest, useProxies } from '~/signals'

export const formatProxyType = (type = '') => {
  const [t] = useI18n()
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
  } else {
    return lt
  }
}

export const getLatencyClassName = (latency: LATENCY_QUALITY_MAP_HTTP) => {
  if (latency > latencyQualityMap().HIGH) {
    return 'text-red-500'
  } else if (latency > latencyQualityMap().MEDIUM) {
    return 'text-yellow-500'
  } else if (latency === LATENCY_QUALITY_MAP_HTTP.NOT_CONNECTED) {
    return 'text-gray'
  } else {
    return 'text-green-600'
  }
}

export const filterSpecialProxyType = (type = '') => {
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

export const sortProxiesByOrderingType = ({
  proxyNames,
  orderingType,
  testUrl,
}: {
  proxyNames: string[]
  orderingType: PROXIES_ORDERING_TYPE
  testUrl: string | null
}) => {
  const { getLatencyByName } = useProxies()

  if (orderingType === PROXIES_ORDERING_TYPE.NATURAL) {
    return proxyNames
  }

  const finalTestUrl = testUrl || urlForLatencyTest()

  return proxyNames.sort((a, b) => {
    const prevLatency = getLatencyByName(a, finalTestUrl)
    const nextLatency = getLatencyByName(b, finalTestUrl)

    switch (orderingType) {
      case PROXIES_ORDERING_TYPE.LATENCY_ASC:
        if (prevLatency === latencyQualityMap().NOT_CONNECTED) return 1

        if (nextLatency === latencyQualityMap().NOT_CONNECTED) return -1

        return prevLatency - nextLatency

      case PROXIES_ORDERING_TYPE.LATENCY_DESC:
        if (prevLatency === latencyQualityMap().NOT_CONNECTED) return 1

        if (nextLatency === latencyQualityMap().NOT_CONNECTED) return -1

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

export const filterProxiesByAvailability = ({
  proxyNames,
  enabled,
  testUrl,
}: {
  proxyNames: string[]
  enabled?: boolean
  testUrl: string | null
}) => {
  const { getLatencyByName, isProxyGroup } = useProxies()

  const finalTestUrl = testUrl || urlForLatencyTest()

  return enabled
    ? proxyNames.filter(
        // we need proxy node with connected or the node is a group it self
        (name) => {
          return (
            isProxyGroup(name) ||
            getLatencyByName(name, finalTestUrl) !==
              latencyQualityMap().NOT_CONNECTED
          )
        },
      )
    : proxyNames
}
