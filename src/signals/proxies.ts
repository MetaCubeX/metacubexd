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
const [proxyGroupNames, setProxyGroupNames] = createSignal<Set<string>>(
  new Set(),
)
const [proxyProviders, setProxyProviders] = createSignal<
  (ProxyProvider & { proxies: ProxyNodeWithProvider[] })[]
>([])

const [latencyMap, setLatencyMap] = createSignal<Record<string, number>>({})
const [proxyIPv6SupportMap, setProxyIPv6SupportMap] = createSignal<
  Record<string, boolean>
>({})
const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

const setProxiesInfo = (
  proxies: (ProxyWithProvider | ProxyNodeWithProvider)[],
) => {
  const newProxyNodeMap = { ...proxyNodeMap() }
  const newLatencyMap = { ...latencyMap() }
  const newProxyIPv6SupportMap = { ...proxyIPv6SupportMap() }

  const lastDelay = (
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
      return undefined
    }

    return proxy.history?.at(-1)?.delay
  }

  const dependedLatencyProxies = {} as Record<string, Set<string>>

  proxies.forEach((proxy) => {
    const { udp, xudp, type, now, name, provider = '' } = proxy
    newProxyNodeMap[proxy.name] = { udp, xudp, type, now, name, provider }

    // to solve the problem of the ProxyGroup cannot obtain the latency of the currently used proxy node
    // it seems that only clash.core and clash.preminu have issues
    if (!now) {
      newLatencyMap[proxy.name] =
        lastDelay(proxy, urlForLatencyTest()) ||
        latencyQualityMap().NOT_CONNECTED
    } else if (newLatencyMap[now] !== undefined) {
      newLatencyMap[proxy.name] = newLatencyMap[now]
    } else {
      const dependencies = dependedLatencyProxies[now] ?? new Set()
      dependencies.add(proxy.name)
      dependedLatencyProxies[now] = dependencies
    }

    const proxyIPv6Support =
      (lastDelay(proxy, urlForIPv6SupportTest(), false) ?? 0) > 0
    newProxyIPv6SupportMap[proxy.name] = proxyIPv6Support
  })

  const independencies = Object.keys(dependedLatencyProxies).filter(
    (now) => newLatencyMap[now] !== undefined,
  )

  // maybe we should use Union-Find to implement this
  while (independencies.length > 0) {
    const now = independencies.shift()!
    const delay = newLatencyMap[now]!

    for (const name of dependedLatencyProxies[now]?.values() ?? []) {
      newLatencyMap[name] = delay
      independencies.push(name)
    }
  }

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
      setProxyGroupNames(
        new Set(['DIRECT', 'REJECT', ...sortedProxies.map((p) => p.name)]),
      )
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
      support = delay > 0
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

    const newLatencyMap = await proxyGroupLatencyTestAPI(
      proxyGroupName,
      urlForTest,
      latencyTestTimeoutDuration(),
    )
    const newSupportMap = Object.fromEntries(
      Object.entries(newLatencyMap).map(([k, v]) => [k, v > 0]),
    )
    setProxyIPv6SupportMap((supportMap) => ({
      ...supportMap,
      ...newSupportMap,
    }))
  }

  const proxyLatencyTest = async (proxyName: string, provider: string) => {
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
    await proxyIPv6SupportTest(proxyName, provider)
  }

  const proxyGroupLatencyTest = async (proxyGroupName: string) => {
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
    await proxyGroupIPv6SupportTest(proxyGroupName)
  }

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
    proxyIPv6SupportMap,
    proxyLatencyTestingMap,
    proxyGroupLatencyTestingMap,
    proxyProviderLatencyTestingMap,
    updatingMap,
    isAllProviderUpdating,
    proxies,
    proxyGroupNames,
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
