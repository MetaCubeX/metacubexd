import type {
  Proxy,
  ProxyNodeWithProvider,
  ProxyProvider,
  ProxyWithProvider,
} from '~/types'
import { defineStore } from 'pinia'
import {
  closeAllConnectionsAPI,
  closeSingleConnectionAPI,
  fetchProxiesAPI,
  fetchProxyProvidersAPI,
  proxyGroupLatencyTestAPI,
  proxyLatencyTestAPI,
  selectProxyInGroupAPI,
  unfixProxyInGroupAPI,
  updateProxyProviderAPI,
} from '~/composables/useApi'

interface ProxyInfo {
  name: string
  alive?: boolean
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

  const normalizeLatencyTestUrl = (testUrl: string | null) =>
    testUrl || configStore.urlForLatencyTest

  // First positive (successful) latency among a node's per-test-url readings.
  // NOT_CONNECTED (0) reads are treated as "no data" and skipped, so a node
  // that only succeeded under a different test url (e.g. its provider's own
  // health-check url) still surfaces a value instead of "---".
  const findPositiveLatency = (
    latencies: Record<string, number> | undefined,
  ) => {
    if (!latencies) return undefined
    for (const value of Object.values(latencies)) {
      if (value > 0) return value
    }
    return undefined
  }

  // Non-empty latency series for the requested url, else any non-empty series
  // the node recorded under another url — mirrors findPositiveLatency so the
  // stability bar matches the pill.
  const pickLatencyHistory = (
    histories: Record<string, Proxy['history'] | undefined>,
    finalTestUrl: string,
  ) => {
    const exact = histories[finalTestUrl]
    if (exact?.length) return exact
    for (const series of Object.values(histories)) {
      if (series?.length) return series
    }
    return undefined
  }

  const replaceNodeLatency = (
    nodeName: string,
    finalTestUrl: string,
    delay: number,
  ) => {
    latencyMap.value = {
      ...latencyMap.value,
      [nodeName]: {
        ...(latencyMap.value[nodeName] || {}),
        [finalTestUrl]: delay,
      },
    }
  }

  // Cap matches the clash core's per-test-url history bound so the UI bar
  // stays bounded between server fetches.
  const LATENCY_HISTORY_MAX = 10

  const appendLatencyHistoryEntry = (
    nodeName: string,
    finalTestUrl: string,
    delay: number,
  ) => {
    const existingNode = proxyNodeMap.value[nodeName]
    const previousHistories = existingNode?.latencyTestHistory ?? {}
    const previousEntries = previousHistories[finalTestUrl] ?? []
    const entry = { time: new Date().toISOString(), delay }
    const nextEntries = [...previousEntries, entry].slice(-LATENCY_HISTORY_MAX)

    const nextNode: ProxyInfo = existingNode
      ? {
          ...existingNode,
          latencyTestHistory: {
            ...previousHistories,
            [finalTestUrl]: nextEntries,
          },
        }
      : {
          name: nodeName,
          alive: undefined,
          udp: false,
          tfo: false,
          xudp: false,
          type: '',
          latency: '',
          provider: '',
          latencyTestHistory: { [finalTestUrl]: nextEntries },
        }

    proxyNodeMap.value = { ...proxyNodeMap.value, [nodeName]: nextNode }
  }

  const clearLatencyTestStateForNodes = (
    nodeNames: string[],
    testUrl: string | null,
  ) => {
    const finalTestUrl = normalizeLatencyTestUrl(testUrl)
    const nodeSet = new Set(
      nodeNames
        .map((name) => getNowProxyNodeName(name))
        .filter((name): name is string => !!name),
    )

    nodeSet.forEach((nodeName) => {
      replaceNodeLatency(
        nodeName,
        finalTestUrl,
        configStore.latencyQualityMap.NOT_CONNECTED,
      )
    })
  }

  const clearLatencyTestStateForGroup = (
    groupName: string,
    testUrl: string | null = null,
  ) => {
    const currentProxyGroup = proxies.value.find(
      (item) => item.name === groupName,
    )
    clearLatencyTestStateForNodes(
      currentProxyGroup?.all ?? [groupName],
      testUrl || currentProxyGroup?.testUrl || null,
    )
  }

  const recordLatencyTestResult = (
    nodeName: string,
    testUrl: string | null,
    delay: number,
  ) => {
    const resolvedNodeName = getNowProxyNodeName(nodeName)
    const finalTestUrl = normalizeLatencyTestUrl(testUrl)
    const resultDelay = Number.isFinite(delay)
      ? delay
      : configStore.latencyQualityMap.NOT_CONNECTED

    replaceNodeLatency(resolvedNodeName, finalTestUrl, resultDelay)
  }

  const recordLatencyTestResults = (
    results: Record<string, number>,
    testUrl: string | null,
  ) => {
    Object.entries(results).forEach(([nodeName, delay]) => {
      recordLatencyTestResult(nodeName, testUrl, delay)
    })
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
      const alive = 'alive' in proxy ? proxy.alive : undefined

      newProxyNodeMap[proxy.name] = {
        alive,
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

  // Close active connections currently routed through a group so a selection
  // change (manual pick or unpin) takes effect immediately instead of waiting
  // for the existing connections to die naturally. No-op unless the user opted
  // into autoCloseConns.
  const closeConnectionsThroughGroup = async (groupName: string) => {
    if (!configStore.autoCloseConns) return

    const activeConns = connectionsStore.restructRawMsgToConnection(
      connectionsStore.latestConnectionMsg?.connections ?? [],
      [],
    )
    if (activeConns.length === 0) return

    const closePromises = activeConns
      .filter(({ chains }) => chains.includes(groupName))
      .map(({ id }) => closeSingleConnectionAPI(id))
    await Promise.allSettled(closePromises)
  }

  // Close every active connection so a routing change that affects the whole
  // session — switching running mode (rule/global/direct) or activating a
  // different profile — takes effect immediately instead of waiting for the
  // existing connections to die naturally. Unlike closeConnectionsThroughGroup,
  // a mode/profile switch can re-route any connection regardless of which group
  // it currently flows through, so we close all of them. No-op unless the user
  // opted into autoCloseConns.
  const closeAllConnections = async () => {
    if (!configStore.autoCloseConns) return

    await closeAllConnectionsAPI()
  }

  // Select proxy in group
  const selectProxyInGroup = async (proxy: Proxy, proxyName: string) => {
    await selectProxyInGroupAPI(proxy.name, proxyName)
    await fetchProxies()
    await closeConnectionsThroughGroup(proxy.name)
  }

  // Clear a manual pin on an automatic group (url-test/fallback/load-balance),
  // restoring automatic selection.
  const unfixProxyInGroup = async (groupName: string) => {
    await unfixProxyInGroupAPI(groupName)
    await fetchProxies()
    await closeConnectionsThroughGroup(groupName)
  }

  // Get now proxy node name (recursive)
  const getNowProxyNodeName = (name: string): string => {
    let node: ProxyInfo | undefined = proxyNodeMap.value[name]

    if (!name || !node) return name

    const visited = new Set<string>()
    while (node && node.latency && node.latency !== node.name) {
      if (visited.has(node.name)) return node.name
      visited.add(node.name)
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

    const nodeLatencies = latencyMapValue[nowName]
    const groupLatencies = latencyMapValue[name]

    // A successful reading for the requested test url always wins.
    const direct = nodeLatencies?.[finalTestUrl]
    if (direct) return direct
    const groupDirect = groupLatencies?.[finalTestUrl]
    if (groupDirect) return groupDirect

    // The requested url has no successful reading — either the key is missing,
    // or it's present but NOT_CONNECTED (0). The latter happens when a node was
    // only ever health-checked under its provider's own test url: the proxies
    // view queries the global url and would otherwise show "---" forever even
    // though a real measurement exists. Reuse any successful reading instead.
    const reused =
      findPositiveLatency(nodeLatencies) ?? findPositiveLatency(groupLatencies)
    if (reused != null) return reused

    // Nothing succeeded anywhere — surface NOT_CONNECTED so the pill shows "---".
    return direct ?? groupDirect ?? configStore.latencyQualityMap.NOT_CONNECTED
  }

  // Get latency history by name
  const getLatencyHistoryByName = (name: string, testUrl: string | null) => {
    const finalTestUrl = testUrl || configStore.urlForLatencyTest
    const nowProxyNodeName = getNowProxyNodeName(name)
    const nowHistories =
      proxyNodeMap.value[nowProxyNodeName]?.latencyTestHistory || {}
    const proxyHistories = proxyNodeMap.value[name]?.latencyTestHistory || {}

    // Prefer the requested url's series; otherwise reuse any non-empty series
    // the node recorded under another url so the bar mirrors getLatencyByName.
    return (
      pickLatencyHistory(nowHistories, finalTestUrl) ??
      pickLatencyHistory(proxyHistories, finalTestUrl) ??
      []
    )
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
    const finalTestUrl = normalizeLatencyTestUrl(testUrl)
    const nodeRecommendationStore = useNodeRecommendationStore()
    // The Latency pill renders a spinner while this flag is set, hiding the
    // underlying value entirely, so there's no reason to clear it pre-flight
    // — clearing it only leaks "---" out the other side when the test fails.
    proxyLatencyTestingMap.value[nodeName] = true

    try {
      const { delay } = await proxyLatencyTestAPI(
        nodeName,
        provider,
        finalTestUrl,
        timeout ?? configStore.latencyTestTimeoutDuration,
      )

      recordLatencyTestResult(nodeName, finalTestUrl, delay)
      appendLatencyHistoryEntry(nodeName, finalTestUrl, delay)
      nodeRecommendationStore.recordTestResult(
        nodeName,
        delay > 0 ? delay : null,
        delay > 0,
      )
    } catch {
      // Transport failure (timeout/network): leave latencyMap untouched so the
      // pill keeps showing the last known value. Record a failure datapoint
      // so the stability bar / sparkline still reflect the failed attempt.
      appendLatencyHistoryEntry(
        nodeName,
        finalTestUrl,
        configStore.latencyQualityMap.NOT_CONNECTED,
      )
      nodeRecommendationStore.recordTestResult(nodeName, null, false)
    } finally {
      proxyLatencyTestingMap.value[nodeName] = false
    }
  }

  // Proxy group latency test
  const proxyGroupLatencyTest = async (proxyGroupName: string) => {
    const nodeRecommendationStore = useNodeRecommendationStore()
    proxyGroupLatencyTestingMap.value[proxyGroupName] = true

    const currentProxyGroup = proxies.value.find(
      (item) => item.name === proxyGroupName,
    )
    const finalTestUrl =
      currentProxyGroup?.testUrl || configStore.urlForLatencyTest
    const memberNames = currentProxyGroup?.all ?? [proxyGroupName]

    try {
      const results = await proxyGroupLatencyTestAPI(
        proxyGroupName,
        finalTestUrl,
        currentProxyGroup?.timeout ?? configStore.latencyTestTimeoutDuration,
      )
      await fetchProxies()
      recordLatencyTestResults(results, finalTestUrl)
      nodeRecommendationStore.recordBatchResults(results)
    } catch {
      // Transport failure: leave latencyMap untouched (pills keep their last
      // known values) and only record failure datapoints in history /
      // recommendation so the bar/sparkline reflect the failed attempt.
      const failedDelay = configStore.latencyQualityMap.NOT_CONNECTED
      const failedResults: Record<string, number> = {}
      for (const memberName of memberNames) {
        const resolved = getNowProxyNodeName(memberName)
        if (!resolved) continue
        failedResults[resolved] = failedDelay
        appendLatencyHistoryEntry(resolved, finalTestUrl, failedDelay)
      }
      nodeRecommendationStore.recordBatchResults(failedResults)
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

    try {
      await fetchProxies()
    } finally {
      updatingMap.value[providerName] = false
    }
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

  const PROVIDER_LATENCY_BATCH_SIZE = 10

  // Proxy provider latency test
  const proxyProviderLatencyTest = async (providerName: string) => {
    const nodeRecommendationStore = useNodeRecommendationStore()
    proxyProviderLatencyTestingMap.value[providerName] = true

    const provider = proxyProviders.value.find(
      (item) => item.name === providerName,
    )
    const finalTestUrl = provider?.testUrl || configStore.urlForLatencyTest
    const timeout = provider?.timeout ?? configStore.latencyTestTimeoutDuration
    const memberNames = provider?.proxies.map((proxy) => proxy.name) ?? []
    const results: Record<string, number> = {}

    try {
      for (
        let i = 0;
        i < memberNames.length;
        i += PROVIDER_LATENCY_BATCH_SIZE
      ) {
        const batch = memberNames.slice(i, i + PROVIDER_LATENCY_BATCH_SIZE)
        await Promise.all(
          batch.map(async (memberName) => {
            const nodeName = getNowProxyNodeName(memberName)
            try {
              const { delay } = await proxyLatencyTestAPI(
                nodeName,
                providerName,
                finalTestUrl,
                timeout,
              )
              results[nodeName] = delay
              recordLatencyTestResult(nodeName, finalTestUrl, delay)
              appendLatencyHistoryEntry(nodeName, finalTestUrl, delay)
              nodeRecommendationStore.recordTestResult(
                nodeName,
                delay > 0 ? delay : null,
                delay > 0,
              )
            } catch {
              const failedDelay = configStore.latencyQualityMap.NOT_CONNECTED
              results[nodeName] = failedDelay
              appendLatencyHistoryEntry(nodeName, finalTestUrl, failedDelay)
              nodeRecommendationStore.recordTestResult(nodeName, null, false)
            }
          }),
        )
      }

      try {
        await fetchProxies()
      } catch {
        /* best-effort refresh */
      }
      nodeRecommendationStore.recordBatchResults(results)
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
    closeAllConnections,
    selectProxyInGroup,
    unfixProxyInGroup,
    getNowProxyNodeName,
    getLatencyByName,
    getLatencyHistoryByName,
    clearLatencyTestStateForNodes,
    clearLatencyTestStateForGroup,
    recordLatencyTestResult,
    recordLatencyTestResults,
    isProxyGroup,
    proxyLatencyTest,
    proxyGroupLatencyTest,
    updateProviderByProviderName,
    updateAllProvider,
    proxyProviderLatencyTest,
  }
})
