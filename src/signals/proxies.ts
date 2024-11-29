import {
  closeSingleConnectionAPI,
  fetchProxiesAPI,
  fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI,
  proxyLatencyTestAPI,
  proxyProviderHealthCheckAPI,
  selectProxyInGroupAPI,
  updateProxyProviderAPI,
} from '~/apis'
import { useStringBooleanMap } from '~/helpers'
import {
  autoCloseConns,
  latencyQualityMap,
  latencyTestTimeoutDuration,
  latestConnectionMsg,
  restructRawMsgToConnection,
  urlForLatencyTest,
} from '~/signals'
import type { Proxy, ProxyNode, ProxyProvider } from '~/types'

type ProxyInfo = {
  name: string
  udp: boolean
  tfo: boolean
  latencyTestHistory: Record<string, Proxy['history'] | undefined>
  latency: string
  xudp: boolean
  type: string
  provider: string
}

export type ProxyWithProvider = Proxy & { provider?: string }
export type ProxyNodeWithProvider = ProxyNode & { provider?: string }

const {
  map: proxyLatencyTestingMap,
  setWithCallback: setProxyLatencyTestingMap,
} = useStringBooleanMap()
const {
  map: proxyGroupLatencyTestingMap,
  setWithCallback: setProxyGroupLatencyTestingMap,
} = useStringBooleanMap()
const {
  map: proxyProviderLatencyTestingMap,
  setWithCallback: setProxyProviderLatencyTestingMap,
} = useStringBooleanMap()
const { map: updatingMap, setWithCallback: setUpdatingMap } =
  useStringBooleanMap()
const [isAllProviderUpdating, setIsAllProviderUpdating] = createSignal(false)

// these signals should be global state
const [proxies, setProxies] = createSignal<ProxyWithProvider[]>([])
const [proxyProviders, setProxyProviders] = createSignal<
  (ProxyProvider & { proxies: ProxyNodeWithProvider[] })[]
>([])

// DO NOT use latency from latency map directly use getLatencyByName instead
const [latencyMap, setLatencyMap] = createSignal<
  Record<string, Record<string, number> | undefined>
>({})

const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

type AllTestUrlLatencyInfo = {
  allTestUrlLatency: Record<string, number>
  allTestUrlLatencyHistory: Record<string, Proxy['history'] | undefined>
}

const getLatencyFromProxy = (
  proxy: Pick<Proxy, 'extra' | 'history' | 'testUrl'>,
  fallbackDefault = true,
): AllTestUrlLatencyInfo => {
  const extra = (proxy.extra || {}) as Record<
    string,
    {
      history?: Proxy['history']
    }
  >

  const { allTestUrlLatency, allTestUrlLatencyHistory } = Object.keys(
    extra,
  ).reduce(
    (acc, testUrl) => {
      const data = extra[testUrl]
      const delay =
        data?.history?.at(-1)?.delay ?? latencyQualityMap().NOT_CONNECTED

      acc.allTestUrlLatency[testUrl] = delay
      acc.allTestUrlLatencyHistory[testUrl] = data.history

      return acc
    },
    {
      allTestUrlLatency: {},
      allTestUrlLatencyHistory: {},
    } as AllTestUrlLatencyInfo,
  )

  if (fallbackDefault) {
    // Since the proxy here could be a proxy group, prioritize using the group's own testUrl
    const defaultTestUrl = proxy.testUrl || urlForLatencyTest()
    const isDefaultTestUrlLatencyExists = defaultTestUrl in allTestUrlLatency

    // If the defaultTtestUrlLatency is not exist, use the fault latency history
    // If the current proxy is a proxy group with its own testUrl, then this history refers to the current proxy group's history
    if (!isDefaultTestUrlLatencyExists) {
      const delay =
        proxy.history?.at(-1)?.delay ?? latencyQualityMap().NOT_CONNECTED
      allTestUrlLatency[defaultTestUrl] = delay
      allTestUrlLatencyHistory[defaultTestUrl] = proxy.history
    }
  }

  return { allTestUrlLatency, allTestUrlLatencyHistory }
}

const setProxiesInfo = (
  proxies: (ProxyWithProvider | ProxyNodeWithProvider)[],
) => {
  const newProxyNodeMap = { ...proxyNodeMap() }
  const newLatencyMap = { ...latencyMap() }

  proxies.forEach((proxy) => {
    const { allTestUrlLatency, allTestUrlLatencyHistory } =
      getLatencyFromProxy(proxy)

    const { udp, xudp, type, now, name, tfo, provider = '' } = proxy

    newProxyNodeMap[proxy.name] = {
      udp,
      xudp,
      type,
      latency: now,
      latencyTestHistory: allTestUrlLatencyHistory,
      name,
      tfo,
      provider,
    }

    newLatencyMap[proxy.name] = allTestUrlLatency
  })

  batch(() => {
    setProxyNodeMap(newProxyNodeMap)
    setLatencyMap(newLatencyMap)
  })
}

export const useProxies = () => {
  const fetchProxies = async () => {
    const [{ providers }, { proxies }] = await Promise.all([
      fetchProxyProvidersAPI(),
      fetchProxiesAPI(),
    ])

    const proxiesWithTestUrl = Object.values(proxies).map((proxy) => {
      if (proxy.all?.length && !proxy.testUrl) {
        const { testUrl, timeout } = providers?.[proxy.name] || {}

        return { ...proxy, testUrl, timeout }
      } else {
        return proxy
      }
    })

    const sortIndex = [...(proxies['GLOBAL'].all ?? []), 'GLOBAL']
    const sortedProxies = Object.values(proxiesWithTestUrl)
      .filter((proxy) => proxy.all?.length)
      .sort(
        (prev, next) =>
          sortIndex.indexOf(prev.name) - sortIndex.indexOf(next.name),
      )
    const sortedProviders = Object.values(providers).filter(
      (provider) =>
        provider.name !== 'default' && provider.vehicleType !== 'Compatible',
    )

    const allProxies = [
      ...proxiesWithTestUrl,
      ...sortedProviders.flatMap((provider) =>
        provider.proxies
          .filter((proxy) => !(proxy.name in proxies))
          .map((proxy) => ({
            ...proxy,
            provider: provider.name,
          })),
      ),
    ]

    batch(() => {
      setProxies(sortedProxies)
      setProxyProviders(sortedProviders)
      setProxiesInfo(allProxies)
    })
  }

  const selectProxyInGroup = async (proxy: Proxy, proxyName: string) => {
    await selectProxyInGroupAPI(proxy.name, proxyName)
    await fetchProxies()

    if (autoCloseConns()) {
      // we don't use activeConns from useConnection here for better performance,
      // and we use empty array to restruct msg because they are closed, they won't have speed anyway
      untrack(() => {
        const activeConns = restructRawMsgToConnection(
          latestConnectionMsg()?.connections ?? [],
          [],
        )

        if (activeConns.length > 0) {
          activeConns.forEach(({ id, chains }) => {
            if (chains.includes(proxy.name)) {
              closeSingleConnectionAPI(id)
            }
          })
        }
      })
    }
  }

  const proxyLatencyTest = async (
    proxyName: string,
    provider: string,
    testUrl: string | null,
    timmeout: number | null,
  ) => {
    const nodeName = getNowProxyNodeName(proxyName)

    setProxyLatencyTestingMap(nodeName, async () => {
      const finalTestUrl = testUrl || urlForLatencyTest()
      const currentNodeLatency = latencyMap()?.[nodeName] || {}
      try {
        const { delay } = await proxyLatencyTestAPI(
          nodeName,
          provider,
          finalTestUrl,
          timmeout ?? latencyTestTimeoutDuration(),
        )

        currentNodeLatency[finalTestUrl] = delay

        setLatencyMap((latencyMap) => {
          return {
            ...latencyMap,
            [nodeName]: currentNodeLatency,
          }
        })
      } catch {
        currentNodeLatency[finalTestUrl] = latencyQualityMap().NOT_CONNECTED
        setLatencyMap((latencyMap) => ({
          ...latencyMap,
          [nodeName]: currentNodeLatency,
        }))
      }
    })
  }

  const proxyGroupLatencyTest = async (proxyGroupName: string) => {
    const currentProxyGroups = proxies()
    setProxyGroupLatencyTestingMap(proxyGroupName, async () => {
      const currentProxyGroup = currentProxyGroups.find(
        (item) => item.name === proxyGroupName,
      )
      await proxyGroupLatencyTestAPI(
        proxyGroupName,
        currentProxyGroup?.testUrl || urlForLatencyTest(),
        currentProxyGroup?.timeout ?? latencyTestTimeoutDuration(),
      )
      await fetchProxies()
    })
  }

  const updateProviderByProviderName = (providerName: string) =>
    setUpdatingMap(providerName, async () => {
      try {
        await updateProxyProviderAPI(providerName)
      } catch {
        /* empty */
      }
      await fetchProxies()
    })

  const updateAllProvider = async () => {
    setIsAllProviderUpdating(true)
    try {
      await Promise.allSettled(
        proxyProviders().map((provider) =>
          updateProxyProviderAPI(provider.name),
        ),
      )
      await fetchProxies()
    } finally {
      setIsAllProviderUpdating(false)
    }
  }

  const proxyProviderLatencyTest = (providerName: string) =>
    setProxyProviderLatencyTestingMap(providerName, async () => {
      await proxyProviderHealthCheckAPI(providerName)
      await fetchProxies()
    })

  const getNowProxyNodeName = (name: string) => {
    let node = proxyNodeMap()[name]

    if (!name || !node) {
      return name
    }

    while (node.latency && node.latency !== node.name) {
      const nextNode = proxyNodeMap()[node.latency]

      if (!nextNode) {
        return node.name
      }

      node = nextNode
    }

    return node.name
  }

  const getLatencyByName = (name: string, testUrl: string | null) => {
    const finalTestUrl = testUrl || urlForLatencyTest()
    const latencyMapValue = latencyMap()

    // First recursively search for proxy node latency by name for the current testUrl.
    // If not found, the current name may be a proxy group - in that case, use that proxy group's latency
    return (
      latencyMapValue[getNowProxyNodeName(name)]?.[finalTestUrl] ||
      latencyMapValue[name]?.[finalTestUrl] ||
      latencyQualityMap().NOT_CONNECTED
    )
  }

  const getLatencyHistoryByName = (name: string, testUrl: string | null) => {
    const proxyNode = proxyNodeMap()[name]

    const nowProxyNodeName = getNowProxyNodeName(name)
    const nowProxyNode = proxyNodeMap()[nowProxyNodeName]

    const finalTestUrl = testUrl || urlForLatencyTest()

    return (
      nowProxyNode.latencyTestHistory[finalTestUrl] ||
      proxyNode.latencyTestHistory[finalTestUrl] ||
      []
    )
  }

  const isProxyGroup = (name: string) => {
    const proxyNode = proxyNodeMap()[name]

    if (!proxyNode) {
      return false
    }

    return (
      ['direct', 'reject', 'loadbalance'].includes(
        proxyNode.type.toLowerCase(),
      ) || !!proxyNode.latency
    )
  }

  return {
    proxyLatencyTestingMap,
    proxyGroupLatencyTestingMap,
    proxyProviderLatencyTestingMap,
    updatingMap,
    isAllProviderUpdating,
    proxies,
    proxyProviders,
    proxyLatencyTest,
    proxyGroupLatencyTest,
    latencyMap,
    proxyNodeMap,
    fetchProxies,
    selectProxyInGroup,
    updateProviderByProviderName,
    updateAllProvider,
    proxyProviderLatencyTest,
    getNowProxyNodeName,
    getLatencyByName,
    getLatencyHistoryByName,
    isProxyGroup,
  }
}
