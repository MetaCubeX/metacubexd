import type {
  Proxy,
  ProxyNodeWithProvider,
  ProxyProvider,
  ProxyWithProvider,
} from '~/types'
import { defineStore } from 'pinia'
import {
  closeSingleConnectionAPI,
  fetchProxiesAPI,
  fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI,
  proxyLatencyTestAPI,
  proxyProviderHealthCheckAPI,
  selectProxyInGroupAPI,
  updateProxyProviderAPI,
} from '~/composables/useApi'

interface ProxyInfo {
  name: string
  udp: boolean
  tfo: boolean
  latencyTestHistory: Record<string, Proxy['history'] | undefined>
  latency: string
  xudp: boolean
  type: string
  provider: string
}

export const useProxiesStore = defineStore('proxies', () => {
  const configStore = useConfigStore()
  const connectionsStore = useConnectionsStore()

  // State
  const proxies = ref<ProxyWithProvider[]>([])
  const proxyProviders = ref<
    (ProxyProvider & { proxies: ProxyNodeWithProvider[] })[]
  >([])
  const latencyMap = ref<Record<string, Record<string, number> | undefined>>({})
  const proxyNodeMap = ref<Record<string, ProxyInfo>>({})

  // Loading states
  const proxyLatencyTestingMap = ref<Record<string, boolean>>({})
  const proxyGroupLatencyTestingMap = ref<Record<string, boolean>>({})
  const proxyProviderLatencyTestingMap = ref<Record<string, boolean>>({})
  const updatingMap = ref<Record<string, boolean>>({})
  const isAllProviderUpdating = ref(false)

  // Collapsed map for UI state
  const collapsedMap = useLocalStorage<Record<string, boolean>>(
    'collapsedMap',
    {},
  )

  // Helper: Get latency from proxy
  const getLatencyFromProxy = (
    proxy: Pick<Proxy, 'extra' | 'history' | 'testUrl'>,
    fallbackDefault = true,
  ) => {
    const extra = (proxy.extra || {}) as Record<
      string,
      { history?: Proxy['history'] }
    >

    const result = Object.keys(extra).reduce(
      (acc, testUrl) => {
        const data = extra[testUrl]
        const delay =
          data?.history?.at(-1)?.delay ??
          configStore.latencyQualityMap.NOT_CONNECTED

        acc.allTestUrlLatency[testUrl] = delay
        acc.allTestUrlLatencyHistory[testUrl] = data?.history

        return acc
      },
      {
        allTestUrlLatency: {} as Record<string, number>,
        allTestUrlLatencyHistory: {} as Record<
          string,
          Proxy['history'] | undefined
        >,
      },
    )

    if (fallbackDefault) {
      const defaultTestUrl = proxy.testUrl || configStore.urlForLatencyTest
      const isDefaultTestUrlLatencyExists =
        defaultTestUrl in result.allTestUrlLatency

      if (!isDefaultTestUrlLatencyExists) {
        const delay =
          proxy.history?.at(-1)?.delay ??
          configStore.latencyQualityMap.NOT_CONNECTED
        result.allTestUrlLatency[defaultTestUrl] = delay
        result.allTestUrlLatencyHistory[defaultTestUrl] = proxy.history
      }
    }

    return result
  }

  // Set proxies info
  const setProxiesInfo = (
    proxyList: (ProxyWithProvider | ProxyNodeWithProvider)[],
  ) => {
    const newProxyNodeMap = { ...proxyNodeMap.value }
    const newLatencyMap = { ...latencyMap.value }

    proxyList.forEach((proxy) => {
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

      const hasNewLatency = Object.values(allTestUrlLatency).some(
        (v) => v !== configStore.latencyQualityMap.NOT_CONNECTED,
      )
      if (hasNewLatency || !newLatencyMap[proxy.name]) {
        newLatencyMap[proxy.name] = allTestUrlLatency
      }
    })

    proxyNodeMap.value = newProxyNodeMap
    latencyMap.value = newLatencyMap
  }

  // Fetch proxies
  const fetchProxies = async () => {
    const [{ providers }, { proxies: proxiesData }] = await Promise.all([
      fetchProxyProvidersAPI(),
      fetchProxiesAPI(),
    ])

    const proxiesWithTestUrl = Object.values(proxiesData).map((proxy) => {
      if (proxy.all?.length && !proxy.testUrl) {
        const { testUrl, timeout } = providers?.[proxy.name] || {}
        return { ...proxy, testUrl, timeout }
      }
      return proxy
    })

    const sortIndex = [...(proxiesData.GLOBAL?.all ?? []), 'GLOBAL']
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
          .filter((proxy) => !(proxy.name in proxiesData))
          .map((proxy) => ({ ...proxy, provider: provider.name })),
      ),
    ]

    proxies.value = sortedProxies
    proxyProviders.value = sortedProviders as typeof proxyProviders.value
    setProxiesInfo(allProxies)
  }

  // Select proxy in group
  const selectProxyInGroup = async (proxy: Proxy, proxyName: string) => {
    await selectProxyInGroupAPI(proxy.name, proxyName)
    await fetchProxies()

    if (configStore.autoCloseConns) {
      const activeConns = connectionsStore.restructRawMsgToConnection(
        connectionsStore.latestConnectionMsg?.connections ?? [],
        [],
      )

      if (activeConns.length > 0) {
        activeConns.forEach(({ id, chains }) => {
          if (chains.includes(proxy.name)) {
            closeSingleConnectionAPI(id)
          }
        })
      }
    }
  }

  // Get now proxy node name (recursive)
  const getNowProxyNodeName = (name: string): string => {
    let node: ProxyInfo | undefined = proxyNodeMap.value[name]

    if (!name || !node) return name

    while (node && node.latency && node.latency !== node.name) {
      const nextNode: ProxyInfo | undefined = proxyNodeMap.value[node.latency]
      if (!nextNode) return node.name
      node = nextNode
    }

    return node?.name ?? name
  }

  // Get latency by name
  const getLatencyByName = (name: string, testUrl: string | null) => {
    const finalTestUrl = testUrl || configStore.urlForLatencyTest
    const latencyMapValue = latencyMap.value
    const nowName = getNowProxyNodeName(name)

    const direct = latencyMapValue[nowName]?.[finalTestUrl]
    const groupDirect = latencyMapValue[name]?.[finalTestUrl]

    if (direct != null) return direct
    if (groupDirect != null) return groupDirect

    // Fallback
    const nodeLatencies = latencyMapValue[nowName]
    if (nodeLatencies && Object.keys(nodeLatencies).length > 0) {
      const keys = Object.keys(nodeLatencies)
      const pickUrl =
        nodeLatencies[finalTestUrl] != null ? finalTestUrl : keys[0]
      if (pickUrl) return nodeLatencies[pickUrl] as number
    }

    const groupLatencies = latencyMapValue[name]
    if (groupLatencies && Object.keys(groupLatencies).length > 0) {
      const keys = Object.keys(groupLatencies)
      if (keys[0]) return groupLatencies[keys[0]] as number
    }

    return configStore.latencyQualityMap.NOT_CONNECTED
  }

  // Get latency history by name
  const getLatencyHistoryByName = (name: string, testUrl: string | null) => {
    const proxyNode = proxyNodeMap.value[name]
    const nowProxyNodeName = getNowProxyNodeName(name)
    const nowProxyNode = proxyNodeMap.value[nowProxyNodeName]
    const finalTestUrl = testUrl || configStore.urlForLatencyTest

    const exact =
      nowProxyNode?.latencyTestHistory[finalTestUrl] ||
      proxyNode?.latencyTestHistory[finalTestUrl]

    if (exact && exact.length) return exact

    // Fallback
    const childHistories = nowProxyNode?.latencyTestHistory || {}
    const childKeys = Object.keys(childHistories)
    const firstChildKey = childKeys[0]

    if (firstChildKey) {
      const hist = childHistories[firstChildKey]
      if (hist && hist.length) return hist
    }

    const groupHistories = proxyNode?.latencyTestHistory || {}
    const groupKeys = Object.keys(groupHistories)
    const firstGroupKey = groupKeys[0]

    if (firstGroupKey) {
      const hist = groupHistories[firstGroupKey]
      if (hist && hist.length) return hist
    }

    return []
  }

  // Check if proxy is a group
  const isProxyGroup = (name: string) => {
    const proxyNode = proxyNodeMap.value[name]
    if (!proxyNode) return false

    return (
      ['direct', 'reject', 'loadbalance'].includes(
        proxyNode.type.toLowerCase(),
      ) || !!proxyNode.latency
    )
  }

  // Proxy latency test
  const proxyLatencyTest = async (
    proxyName: string,
    provider: string,
    testUrl: string | null,
    timeout: number | null,
  ) => {
    const nodeName = getNowProxyNodeName(proxyName)
    proxyLatencyTestingMap.value[nodeName] = true

    try {
      const finalTestUrl = testUrl || configStore.urlForLatencyTest
      const currentNodeLatency = latencyMap.value?.[nodeName] || {}

      const { delay } = await proxyLatencyTestAPI(
        nodeName,
        provider,
        finalTestUrl,
        timeout ?? configStore.latencyTestTimeoutDuration,
      )

      currentNodeLatency[finalTestUrl] = delay
      latencyMap.value = {
        ...latencyMap.value,
        [nodeName]: currentNodeLatency,
      }
    } catch {
      const finalTestUrl = testUrl || configStore.urlForLatencyTest
      const currentNodeLatency = latencyMap.value?.[nodeName] || {}
      currentNodeLatency[finalTestUrl] =
        configStore.latencyQualityMap.NOT_CONNECTED
      latencyMap.value = {
        ...latencyMap.value,
        [nodeName]: currentNodeLatency,
      }
    } finally {
      proxyLatencyTestingMap.value[nodeName] = false
    }
  }

  // Proxy group latency test
  const proxyGroupLatencyTest = async (proxyGroupName: string) => {
    proxyGroupLatencyTestingMap.value[proxyGroupName] = true

    try {
      const currentProxyGroup = proxies.value.find(
        (item) => item.name === proxyGroupName,
      )
      await proxyGroupLatencyTestAPI(
        proxyGroupName,
        currentProxyGroup?.testUrl || configStore.urlForLatencyTest,
        currentProxyGroup?.timeout ?? configStore.latencyTestTimeoutDuration,
      )
      await fetchProxies()
    } finally {
      proxyGroupLatencyTestingMap.value[proxyGroupName] = false
    }
  }

  // Update provider
  const updateProviderByProviderName = async (providerName: string) => {
    updatingMap.value[providerName] = true

    try {
      await updateProxyProviderAPI(providerName)
    } catch {
      /* empty */
    }

    await fetchProxies()
    updatingMap.value[providerName] = false
  }

  // Update all providers
  const updateAllProvider = async () => {
    isAllProviderUpdating.value = true

    try {
      await Promise.allSettled(
        proxyProviders.value.map((provider) =>
          updateProxyProviderAPI(provider.name),
        ),
      )
      await fetchProxies()
    } finally {
      isAllProviderUpdating.value = false
    }
  }

  // Proxy provider latency test
  const proxyProviderLatencyTest = async (providerName: string) => {
    proxyProviderLatencyTestingMap.value[providerName] = true

    try {
      await proxyProviderHealthCheckAPI(providerName)
      await fetchProxies()
    } finally {
      proxyProviderLatencyTestingMap.value[providerName] = false
    }
  }

  return {
    proxies,
    proxyProviders,
    latencyMap,
    proxyNodeMap,
    proxyLatencyTestingMap,
    proxyGroupLatencyTestingMap,
    proxyProviderLatencyTestingMap,
    updatingMap,
    isAllProviderUpdating,
    collapsedMap,
    fetchProxies,
    selectProxyInGroup,
    getNowProxyNodeName,
    getLatencyByName,
    getLatencyHistoryByName,
    isProxyGroup,
    proxyLatencyTest,
    proxyGroupLatencyTest,
    updateProviderByProviderName,
    updateAllProvider,
    proxyProviderLatencyTest,
  }
})
