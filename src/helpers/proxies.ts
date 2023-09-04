import dayjs from 'dayjs'
import { PROXIES_ORDERING_TYPE } from '~/constants'

export const formatTimeFromNow = (time: number | string) => {
  return dayjs(time).fromNow()
}

export const handlerBtnClickWithAnimate = async (
  event: MouseEvent,
  cb: () => void,
  className = 'animate-spin',
) => {
  let el = event.target as HTMLElement
  event.stopPropagation()

  while (el && !el.classList.contains('btn')) {
    el = el.parentElement!
  }

  el.classList.add(className)
  try {
    await cb()
  } catch {}
  el.classList.remove(className)
}

export const formatProxyType = (type = '') => {
  const t = type.toLowerCase()

  if (t.includes('shadowsocks')) {
    return t.replace('shadowsocks', 'ss')
  }

  return t
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
        if (prevLatency === -1) return 1

        if (nextLatency === -1) return -1

        return prevLatency - nextLatency

      case PROXIES_ORDERING_TYPE.LATENCY_DESC:
        if (prevLatency === -1) return 1

        if (nextLatency === -1) return -1

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
