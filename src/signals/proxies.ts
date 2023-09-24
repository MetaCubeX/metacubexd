import { batch, createSignal, untrack } from 'solid-js'
import {
  closeSingleConnectionAPI,
  fetchProxiesAPI,
  fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI,
  proxyProviderHealthCheck,
  selectProxyInGroupAPI,
  updateProxyProviderAPI,
} from '~/apis'
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
  now: string
  xudp: boolean
  type: string
}

// these signals should be global state
const [proxies, setProxies] = createSignal<Proxy[]>([])
const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

const [latencyMap, setLatencyMap] = createSignal<Record<string, number>>({})
const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

const setProxiesInfo = (proxies: (Proxy | ProxyNode)[]) => {
  const newProxyNodeMap = { ...proxyNodeMap() }
  const newLatencyMap = { ...latencyMap() }

  proxies.forEach((proxy) => {
    const latency =
      proxy.history.at(-1)?.delay || latencyQualityMap().NOT_CONNECTED

    newProxyNodeMap[proxy.name] = {
      udp: proxy.udp,
      xudp: proxy.xudp,
      type: proxy.type,
      now: proxy.now,
      name: proxy.name,
    }
    newLatencyMap[proxy.name] = latency
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
    const allProxies: (Proxy | ProxyNode)[] = [
      ...Object.values(proxies),
      ...sortedProviders.flatMap((provider) => provider.proxies),
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

  const latencyTestByProxyGroupName = async (proxyGroupName: string) => {
    const data = await proxyGroupLatencyTestAPI(
      proxyGroupName,
      urlForLatencyTest(),
      latencyTestTimeoutDuration(),
    )

    setLatencyMap({
      ...latencyMap(),
      ...data,
    })

    await fetchProxies()
  }

  const updateProviderByProviderName = async (providerName: string) => {
    try {
      await updateProxyProviderAPI(providerName)
    } catch {}
    await fetchProxies()
  }

  const updateAllProvider = async () => {
    await Promise.allSettled(
      proxyProviders().map((provider) => updateProxyProviderAPI(provider.name)),
    )
    await fetchProxies()
  }

  const healthCheckByProviderName = async (providerName: string) => {
    await proxyProviderHealthCheck(providerName)
    await fetchProxies()
  }

  return {
    proxies,
    proxyProviders,
    latencyTestByProxyGroupName,
    latencyMap,
    proxyNodeMap,
    fetchProxies,
    selectProxyInGroup,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
  }
}
