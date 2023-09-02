import { createSignal } from 'solid-js'
import { useRequest } from '~/signals'
import type { Proxy, ProxyNode, ProxyProvider } from '~/types'

type ProxyInfo = {
  name: string
  udp: boolean
  type: string
  delay?: number
}
// these signals should be global state
const [proxies, setProxies] = createSignal<Proxy[]>([])
const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

const [proxyNodeMap, setProxyNodeMap] = createSignal<Record<string, ProxyInfo>>(
  {},
)

export function useProxies() {
  const request = useRequest()
  const setProxyInfoByProixes = (proxies: Proxy[] | ProxyNode[]) => {
    proxies.forEach((proxy) => {
      setProxyNodeMap({
        ...proxyNodeMap(),
        [proxy.name]: {
          udp: proxy.udp,
          type: proxy.type,
          delay: proxy.history.at(-1)?.delay ?? 0,
          name: proxy.name,
        },
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

    await request.put(`proxies/${proxy.name}`, {
      body: JSON.stringify({
        name: proxyName,
      }),
    })

    proxyGroup.now = proxyName
    setProxies(proxyGroupList)
    updateProxy()
  }

  const delayTestByProxyGroupName = async (proxyGroupName: string) => {
    const data: Record<string, number> = await request
      .get(`group/${proxyGroupName}/delay`, {
        searchParams: {
          url: 'https://www.gstatic.com/generate_204',
          timeout: 2000,
        },
      })
      .json()

    Object.entries(data).forEach(([name, delay]) => {
      setProxyNodeMap({
        ...proxyNodeMap(),
        [name]: {
          ...proxyNodeMap()[name],
          delay: delay,
        },
      })
    })
  }

  const updateProviderByProviderName = async (proxyProviderName: string) => {
    await request.put(`providers/proxies/${proxyProviderName}`)
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
    proxyNodeMap,
    updateProxy,
    setProxyGroupByProxyName,
    updateProviderByProviderName,
    healthCheckByProviderName,
  }
}
