import { PROXIES_ORDERING_TYPE } from '~/constants'
import { latencyQualityMap } from '~/signals'

export const formatProxyType = (type = '') => {
  const t = type.toLowerCase()

  if (t.includes('shadowsocks')) {
    return t.replace('shadowsocks', 'ss') // for both ss and ssr
  }

  if (t === 'hysteria') {
    return 'hy'
  }

  if (t === 'wireguard') {
    return 'wg'
  }

  return t
}

export const filterSpecialProxyType = (type = '') => {
  const t = type.toLowerCase()
  const conditions = [
    'selector',
    'direct',
    'reject',
    'urltest',
    'loadbalance',
    'fallback',
    'relay',
  ]

  return !conditions.includes(t)
}

export const sortProxiesByOrderingType = (
  proxyNames: string[],
  proxyLatencyMap: Record<string, number>,
  orderingType: PROXIES_ORDERING_TYPE,
) => {
  if (orderingType === PROXIES_ORDERING_TYPE.NATURAL) {
    return proxyNames
  }

  return proxyNames.sort((a, b) => {
    const prevLatency = proxyLatencyMap[a]
    const nextLatency = proxyLatencyMap[b]

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
  proxyLatencyMap: Record<string, number>,
  enabled?: boolean,
) =>
  enabled
    ? proxyNames.filter(
        (name) => proxyLatencyMap[name] !== latencyQualityMap().NOT_CONNECTED,
      )
    : proxyNames
