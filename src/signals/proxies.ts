import { makePersisted } from '@solid-primitives/storage'
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
  urlForIPv6SupportTest,
  urlForLatencyTest,
} from '~/signals'
import type { Proxy, ProxyNode, ProxyProvider } from '~/types'

type ProxyInfo = {
  name: string
  udp: boolean
  now: string
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
const [latencyMap, setLatencyMap] = createSignal<Record<string, number>>({})
const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

const [proxyIPv6SupportMap, setProxyIPv6SupportMap] = makePersisted(
  createSignal<Record<string, boolean>>({}),
  {
    name: 'proxyIPv6SupportMap',
    storage: localStorage,
  },
)

const getLatencyFromProxy = (
  proxy: Pick<Proxy, 'extra' | 'history'>,
  url: string,
  fallbackDefault = true,
) => {
  const extra = proxy.extra?.[url] as Proxy['history'] | undefined

  if (Array.isArray(extra)) {
    const delay = extra.at(-1)?.delay

    if (delay) {
      return delay
    }
  }

  if (!fallbackDefault) {
    return latencyQualityMap().NOT_CONNECTED
  }

  return proxy.history?.at(-1)?.delay ?? latencyQualityMap().NOT_CONNECTED
}

const setProxiesInfo = (
  proxies: (ProxyWithProvider | ProxyNodeWithProvider)[],
) => {
  const newProxyNodeMap = { ...proxyNodeMap() }
  const newLatencyMap = { ...latencyMap() }
  const newProxyIPv6SupportMap = { ...proxyIPv6SupportMap() }

  proxies.forEach((proxy) => {
    const { udp, xudp, type, now, name, provider = '' } = proxy

    newProxyNodeMap[proxy.name] = { udp, xudp, type, now, name, provider }
    newLatencyMap[proxy.name] = getLatencyFromProxy(proxy, urlForLatencyTest())

    // we don't set it when false because sing-box didn't have "extra" so it will always be false
    if (
      getLatencyFromProxy(proxy, urlForIPv6SupportTest(), false) >
      latencyQualityMap().NOT_CONNECTED
    ) {
      newProxyIPv6SupportMap[proxy.name] = true
    }
  })

  batch(() => {
    setProxyNodeMap(newProxyNodeMap)
    setLatencyMap(newLatencyMap)
    setProxyIPv6SupportMap(newProxyIPv6SupportMap)
  })
}

export const useProxies = () => {
  const fetchProxies = async () => {
    const [{ providers }, { proxies }] = await Promise.all([
      fetchProxyProvidersAPI(),
      fetchProxiesAPI(),
    ])

    const sortIndex = [...(proxies['GLOBAL'].all ?? []), 'GLOBAL']
    const sortedProxies = Object.values(proxies)
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
      ...Object.values(proxies),
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

  const proxyLatencyTest = async (proxyName: string, provider: string) => {
    const nodeName = getNowProxyNodeName(proxyName)

    setProxyLatencyTestingMap(nodeName, async () => {
      await proxyIPv6SupportTest(nodeName, provider)
      try {
        const { delay } = await proxyLatencyTestAPI(
          nodeName,
          provider,
          urlForLatencyTest(),
          latencyTestTimeoutDuration(),
        )

        setLatencyMap((latencyMap) => ({
          ...latencyMap,
          [nodeName]: delay,
        }))
      } catch {
        setLatencyMap((latencyMap) => ({
          ...latencyMap,
          [nodeName]: latencyQualityMap().NOT_CONNECTED,
        }))
      }
    })
  }

  const proxyGroupLatencyTest = async (proxyGroupName: string) => {
    setProxyGroupLatencyTestingMap(proxyGroupName, async () => {
      await proxyGroupIPv6SupportTest(proxyGroupName)
      await proxyGroupLatencyTestAPI(
        proxyGroupName,
        urlForLatencyTest(),
        latencyTestTimeoutDuration(),
      )
      await fetchProxies()
    })
  }

  const proxyIPv6SupportTest = async (proxyName: string, provider: string) => {
    const urlForTest = urlForIPv6SupportTest()

    if (!urlForTest || urlForTest.length === 0) {
      setProxyIPv6SupportMap({})

      return
    }

    let support = false
    try {
      const { delay } = await proxyLatencyTestAPI(
        proxyName,
        provider,
        urlForTest,
        latencyTestTimeoutDuration(),
      )
      support = delay > latencyQualityMap().NOT_CONNECTED
    } catch {
      support = false
    }
    setProxyIPv6SupportMap((supportMap) => ({
      ...supportMap,
      [proxyName]: support,
    }))
  }

  const proxyGroupIPv6SupportTest = async (proxyGroupName: string) => {
    const urlForTest = urlForIPv6SupportTest()

    if (!urlForTest || urlForTest.length === 0) {
      setProxyIPv6SupportMap({})

      return
    }

    try {
      const newLatencyMap = await proxyGroupLatencyTestAPI(
        proxyGroupName,
        urlForTest,
        latencyTestTimeoutDuration(),
      )

      const newSupportMap = Object.fromEntries(
        Object.entries(newLatencyMap).map(([nodeName, latency]) => [
          getNowProxyNodeName(nodeName),
          latency > latencyQualityMap().NOT_CONNECTED,
        ]),
      )
      setProxyIPv6SupportMap((supportMap) => ({
        ...supportMap,
        ...newSupportMap,
      }))
    } catch {
      const allNodes = proxies().find((p) => p.name === proxyGroupName)?.all

      if (!allNodes) {
        return
      }

      setProxyIPv6SupportMap((proxyIPv6SupportMap) => ({
        ...proxyIPv6SupportMap,
        ...Object.fromEntries(
          allNodes.map((name) => [getNowProxyNodeName(name), false]),
        ),
      }))
    }
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

    while (node.now && node.now !== node.name) {
      const nextNode = proxyNodeMap()[node.now]

      if (!nextNode) {
        return node.name
      }

      node = nextNode
    }

    return node.name
  }

  const getLatencyByName = (name: string) => {
    return latencyMap()[getNowProxyNodeName(name)]
  }

  const isProxyGroup = (name: string) => {
    const proxyNode = proxyNodeMap()[name]

    if (!proxyNode) {
      return false
    }

    return (
      ['direct', 'reject', 'loadbalance'].includes(
        proxyNode.type.toLowerCase(),
      ) || !!proxyNode.now
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
    isProxyGroup,
    proxyIPv6SupportMap,
  }
}
