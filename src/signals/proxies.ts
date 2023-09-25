import { batch, createSignal, untrack } from 'solid-js'
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
  now: string
  xudp: boolean
  type: string
  provider: string
}

export type ProxyWithProvider = Proxy & { provider?: string }
export type ProxyNodeWithProvider = ProxyNode & { provider?: string }

const { map: collapsedMap, set: setCollapsedMap } = useStringBooleanMap()
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

const [latencyMap, setLatencyMap] = createSignal<Record<string, number>>({})
const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

const setProxiesInfo = (
  proxies: (ProxyWithProvider | ProxyNodeWithProvider)[],
) => {
  const newProxyNodeMap = { ...proxyNodeMap() }
  const newLatencyMap = { ...latencyMap() }

  proxies.forEach((proxy) => {
    const { udp, xudp, type, now, name, provider = '' } = proxy

    const latency =
      proxy.history.at(-1)?.delay || latencyQualityMap().NOT_CONNECTED

    newProxyNodeMap[proxy.name] = { udp, xudp, type, now, name, provider }
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

  const proxyLatencyTest = (proxyName: string, provider: string) =>
    setProxyLatencyTestingMap(proxyName, async () => {
      const { delay } = await proxyLatencyTestAPI(
        proxyName,
        provider,
        urlForLatencyTest(),
        latencyTestTimeoutDuration(),
      )

      setLatencyMap((latencyMap) => ({
        ...latencyMap,
        [proxyName]: delay,
      }))
    })

  const proxyGroupLatencyTest = (proxyGroupName: string) =>
    setProxyGroupLatencyTestingMap(proxyGroupName, async () => {
      const newLatencyMap = await proxyGroupLatencyTestAPI(
        proxyGroupName,
        urlForLatencyTest(),
        latencyTestTimeoutDuration(),
      )

      setLatencyMap((latencyMap) => ({
        ...latencyMap,
        ...newLatencyMap,
      }))

      await fetchProxies()
    })

  const updateProviderByProviderName = (providerName: string) =>
    setUpdatingMap(providerName, async () => {
      try {
        await updateProxyProviderAPI(providerName)
      } catch {}
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

  return {
    collapsedMap,
    setCollapsedMap,
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
  }
}
