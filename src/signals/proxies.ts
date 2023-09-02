import { createEffect, createSignal } from 'solid-js'
import { endpoint, selectedEndpoint, useRequest } from '~/signals'
import { autoCloseConns, urlForDelayTest } from '~/signals/config'
import type { Proxy, ProxyNode, ProxyProvider } from '~/types'

type ProxyInfo = {
  name: string
  udp: boolean
  type: string
}
// these signals should be global state
const [proxies, setProxies] = createSignal<Proxy[]>([])
const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

const [delayMap, setDelayMap] = createSignal<Record<string, number>>({})
const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

export function useProxies() {
  const request = useRequest()
  const setProxyInfoByProixes = (proxies: Proxy[] | ProxyNode[]) => {
    proxies.forEach((proxy) => {
      const delay = proxy.history.at(-1)?.delay ?? 0

      setProxyNodeMap({
        ...proxyNodeMap(),
        [proxy.name]: {
          udp: proxy.udp,
          type: proxy.type,
          name: proxy.name,
        },
      })
      setDelayMap({
        ...delayMap(),
        [proxy.name]: delay,
      })
    })
  }

  const updateProxy = async () => {
    const { providers } = await request
      .get('providers/proxies')
      .json<{ providers: Record<string, ProxyProvider> }>()

    Object.values(providers).forEach((provider) => {
      setProxyInfoByProixes(provider.proxies)
    })

    setProxyProviders(
      Object.values(providers).filter(
        (provider) =>
          provider.name !== 'default' && provider.vehicleType !== 'Compatible',
      ),
    )

    const { proxies } = await request
      .get('proxies')
      .json<{ proxies: Record<string, Proxy> }>()
    const sortIndex = [...(proxies['GLOBAL'].all ?? []), 'GLOBAL']

    setProxyInfoByProixes(Object.values(proxies))
    setProxies(
      Object.values(proxies)
        .filter((proxy) => proxy.all?.length)
        .sort(
          (pre, next) =>
            sortIndex.indexOf(pre.name) - sortIndex.indexOf(next.name),
        ),
    )
  }

  const setProxyGroupByProxyName = async (proxy: Proxy, proxyName: string) => {
    const proxyGroupList = proxies().slice()
    const proxyGroup = proxyGroupList.find((i) => i.name === proxy.name)!

    if (autoCloseConns()) request.delete('connections')

    await request.put(`proxies/${proxy.name}`, {
      body: JSON.stringify({
        name: proxyName,
      }),
    })

    proxyGroup.now = proxyName

    setProxies(proxyGroupList)
    // queueMicrotask(updateProxy)
  }

  const delayTestByProxyGroupName = async (proxyGroupName: string) => {
    const data: Record<string, number> = await request
      .get(`group/${proxyGroupName}/delay`, {
        searchParams: {
          url: urlForDelayTest(),
          timeout: 2000,
        },
      })
      .json()

    setDelayMap({
      ...delayMap(),
      ...data,
    })
  }

  const updateProviderByProviderName = async (proxyProviderName: string) => {
    try {
      await request.put(`providers/proxies/${proxyProviderName}`)
    } catch {}
    await updateProxy()
  }

  const updateAllProvider = async () => {
    await Promise.all(
      proxyProviders().map((provider) => {
        return request.put(`providers/proxies/${provider.name}`)
      }),
    )
    await updateProxy()
  }

  const healthCheckByProviderName = async (providerName: string) => {
    await request.get(`providers/proxies/${providerName}/healthcheck`, {
      timeout: 30 * 1000, // thie api was a little bit slow sometimes...
    })
    await updateProxy()
  }

  return {
    proxies,
    proxyProviders,
    delayTestByProxyGroupName,
    delayMap,
    proxyNodeMap,
    updateProxy,
    setProxyGroupByProxyName,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
  }
}

createEffect(() => {
  if (selectedEndpoint() && endpoint()) {
    useProxies().updateProxy()
  }
})
