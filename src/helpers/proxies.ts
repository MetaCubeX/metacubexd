import { LATENCY_QUALITY_MAP_HTTP, PROXIES_ORDERING_TYPE } from '~/constants'
import { latencyQualityMap, useProxies } from '~/signals'

export const formatProxyType = (type = '') => {
  const t = type.toLowerCase()

  if (t.includes('shadowsocksr')) {
    return t.replace('shadowsocksr', 'SSR') // for ssr
  }

  if (t.includes('shadowsocks')) {
    return t.replace('shadowsocks', 'SS') // for ss
  }

  if (t.includes('hysteria')) {
    return t.replace('hysteria', 'HY')
  }

  if (t === 'wireguard') {
    return 'WG'
  }

  return t
}

export const getLatencyClassName = (latency: LATENCY_QUALITY_MAP_HTTP) => {
  if (latency > latencyQualityMap().HIGH) {
    return 'text-error'
  } else if (latency > latencyQualityMap().MEDIUM) {
    return 'text-warning'
  } else if (latency === LATENCY_QUALITY_MAP_HTTP.NOT_CONNECTED) {
    return 'text-gray'
  } else {
    return 'text-success'
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

export const sortProxiesByOrderingType = (
  proxyNames: string[],
  orderingType: PROXIES_ORDERING_TYPE,
) => {
  const { getLatencyByName } = useProxies()

  if (orderingType === PROXIES_ORDERING_TYPE.NATURAL) {
    return proxyNames
  }

  return proxyNames.sort((a, b) => {
    const prevLatency = getLatencyByName(a)
    const nextLatency = getLatencyByName(b)

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

export const filterProxiesByAvailability = (
  proxyNames: string[],
  enabled?: boolean,
) => {
  const { getLatencyByName, isProxyGroup } = useProxies()

  return enabled
    ? proxyNames.filter(
        // we need proxy node with connected or the node is a group it self
        (name) => {
          return (
            isProxyGroup(name) ||
            getLatencyByName(name) !== latencyQualityMap().NOT_CONNECTED
          )
        },
      )
    : proxyNames
}
