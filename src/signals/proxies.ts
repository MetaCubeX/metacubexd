import { createSignal } from 'solid-js'
import {
  autoCloseConns,
  latencyTestTimeoutDuration,
  urlForLatencyTest,
  useRequest,
} from '~/signals'
import type { Proxy, ProxyNode, ProxyProvider } from '~/types'
import { useConnections } from './connections'

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
    const latency = proxy.history.at(-1)?.delay || -1

    newProxyNodeMap[proxy.name] = {
      udp: proxy.udp,
      xudp: proxy.xudp,
      type: proxy.type,
      now: proxy.now,
      name: proxy.name,
    }
    newLatencyMap[proxy.name] = latency
  })

  setProxyNodeMap(newProxyNodeMap)
  setLatencyMap(newLatencyMap)
}

export const useProxies = () => {
  const request = useRequest()
  const { activeConnections } = useConnections()

  const updateProxies = async () => {
    const [{ providers }, { proxies }] = await Promise.all([
      request
        .get('providers/proxies')
        .json<{ providers: Record<string, ProxyProvider> }>(),
      request.get('proxies').json<{ proxies: Record<string, Proxy> }>(),
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

    setProxies(sortedProxies)
    setProxyProviders(sortedProviders)
    setProxiesInfo(allProxies)
  }

  const setProxyGroupByProxyName = async (proxy: Proxy, proxyName: string) => {
    const proxyGroupList = proxies().slice()
    const proxyGroup = proxyGroupList.find((i) => i.name === proxy.name)!

    await request.put(`proxies/${proxy.name}`, {
      body: JSON.stringify({
        name: proxyName,
      }),
    })

    if (autoCloseConns()) {
      activeConnections().forEach(({ id, chains }) => {
        if (chains.includes(proxy.name)) {
          request.delete(`connections/${id}`)
        }
      })
    }

    proxyGroup.now = proxyName
    setProxies(proxyGroupList)
  }

  const latencyTestByProxyGroupName = async (proxyGroupName: string) => {
    const data: Record<string, number> = await request
      .get(`group/${proxyGroupName}/delay`, {
        searchParams: {
          url: urlForLatencyTest(),
          timeout: latencyTestTimeoutDuration(),
        },
      })
      .json()

    setLatencyMap({
      ...latencyMap(),
      ...data,
    })
  }

  const updateProviderByProviderName = async (proxyProviderName: string) => {
    try {
      await request.put(`providers/proxies/${proxyProviderName}`)
    } catch {}
    await updateProxies()
  }

  const updateAllProvider = async () => {
    await Promise.allSettled(
      proxyProviders().map((provider) =>
        request.put(`providers/proxies/${provider.name}`),
      ),
    )
    await updateProxies()
  }

  const healthCheckByProviderName = async (providerName: string) => {
    await request.get(`providers/proxies/${providerName}/healthcheck`, {
      timeout: 20 * 1000,
    })
    await updateProxies()
  }

  return {
    proxies,
    proxyProviders,
    latencyTestByProxyGroupName,
    latencyMap,
    proxyNodeMap,
    updateProxies,
    setProxyGroupByProxyName,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
  }
}
