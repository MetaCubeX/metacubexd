import { createSignal } from 'solid-js'
import { useRequest } from '~/signals'
import type { Proxy, ProxyProvider } from '~/types'

export function useProxies() {
  const request = useRequest()
  const [proxies, setProxies] = createSignal<Proxy[]>([])
  const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])
  const [delayMap, setDelayMap] = createSignal<Record<string, number>>({})

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

    setProxies(
      Object.values(proxies).filter(
        (proxy) => proxy.all && proxy.all.length > 0,
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

  return {
    proxies,
    proxyProviders,
    delayMap,
    updateProxy,
    setProxiesByProxyName,
  }
}
