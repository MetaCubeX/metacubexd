import { For, createSignal, onMount } from 'solid-js'
import { useRequest } from '~/signals'
import type { Proxy, ProxyProvider } from '~/types'

export const Proxies = () => {
  const request = useRequest()
  const [proxies, setProxies] = createSignal<Proxy[]>([])
  const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

  onMount(async () => {
    const { proxies } = await request
      .get('proxies')
      .json<{ proxies: Record<string, Proxy> }>()

    setProxies(Object.values(proxies))

    const { providers } = await request
      .get('providers/proxies')
      .json<{ providers: Record<string, ProxyProvider> }>()

    setProxyProviders(Object.values(providers))
  })

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxies</h1>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <For each={proxies()}>
            {(proxy) => (
              <div class="card card-bordered card-compact border-secondary p-4">
                {proxy.name}
              </div>
            )}
          </For>
        </div>
      </div>

      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxy Providers</h1>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <For each={proxyProviders()}>
            {(proxy) => (
              <div class="card card-bordered card-compact border-secondary p-4">
                {proxy.name}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
