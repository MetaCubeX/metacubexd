import { createSignal } from 'solid-js'
import { useRequest } from '~/signals'
import type { Proxy, ProxyProvider } from '~/types'

// these signals should be global state
const [proxies, setProxies] = createSignal<Proxy[]>([])
const [delayMap, setDelayMap] = createSignal<Record<string, number>>({})
const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

export function useProxies() {
  const request = useRequest()

  const updateProxy = async () => {
    const { providers } = await request
      .get('providers/proxies')
      .json<{ providers: Record<string, ProxyProvider> }>()
    const delay = delayMap()

    Object.values(providers).forEach((provider) => {
      provider.proxies.forEach((proxy) => {
        delay[proxy.name] = proxy.history[proxy.history.length - 1]?.delay
      })
    })

    setDelayMap(delay)
    setProxyProviders(
      Object.values(providers).filter(
        (provider) =>
          provider.name !== 'default' && provider.vehicleType !== 'Compatible',
      ),
    )

    const { proxies } = await request
      .get('proxies')
      .json<{ proxies: Record<string, Proxy> }>()
    const sortIndex = proxies['GLOBAL'].all ?? []

    setProxies(
      Object.values(proxies)
        .filter((proxy) => proxy.all && proxy.all.length > 0)
        .sort(
          (pre, next) =>
            sortIndex.indexOf(pre.name) - sortIndex.indexOf(next.name),
        ),
    )
  }

  const setProxiesByProxyName = async (proxy: Proxy, proxyName: string) => {
    await request.put(`proxies/${proxy.name}`, {
      body: JSON.stringify({
        name: proxyName,
      }),
    })
    await updateProxy()
  }

  const delayTestByProxyGroupName = async (proxyGroupName: string) => {
    const data: Record<string, number> = await request
      .get(
        `group/${proxyGroupName}/delay?url=https%3A%2F%2Fwww.gstatic.com%2Fgenerate_204&timeout=2000`,
      )
      .json()
    const dMap = delayMap()

    Object.entries(data).forEach(([name, time]) => {
      dMap[name] = time
    })

    setDelayMap({ ...dMap })
  }

  return {
    proxies,
    proxyProviders,
    delayTestByProxyGroupName,
    delayMap,
    updateProxy,
    setProxiesByProxyName,
  }
}
