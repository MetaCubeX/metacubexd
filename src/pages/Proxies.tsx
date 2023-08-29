import { For, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { useRequest } from '~/signals'
import type { Proxy, ProxyProvider } from '~/types'

export default () => {
  const request = useRequest()
  const [proxies, setProxies] = createSignal<Proxy[]>([])
  const [delayMap, setDelayMap] = createSignal<Record<string, number>>({})
  const [proxyProviders, setProxyProviders] = createSignal<ProxyProvider[]>([])

  const renderDelay = (proxyname: string) => {
    const delay = delayMap()[proxyname]

    if (typeof delay !== 'number' || delay === 0) {
      return ''
    }

    return <span>{delay}ms</span>
  }

  onMount(async () => {
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
    setProxyProviders(Object.values(providers))

    const { proxies } = await request
      .get('proxies')
      .json<{ proxies: Record<string, Proxy> }>()

    setProxies(Object.values(proxies))
  })

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxies</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-1">
          <For each={proxies()}>
            {(proxy) => (
              <div class="collapse collapse-arrow border-secondary bg-base-200 p-4">
                <input type="checkbox" />
                <div class="collapse-title text-xl font-medium">
                  {proxy.name} {proxy.type}
                </div>
                <div class="collapse-content grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <For each={proxy.all}>
                    {(proxyPoint) => (
                      <div
                        class={twMerge(
                          proxy.now === proxyPoint
                            ? 'border-primary bg-success-content text-success'
                            : 'border-secondary',
                          'card card-bordered card-compact m-1 flex-row justify-between p-4',
                        )}
                      >
                        {proxyPoint} {renderDelay(proxyPoint)}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxy Providers</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-1">
          <For each={proxyProviders()}>
            {(proxy) => (
              <div class="collapse-arrow collapse border-secondary bg-base-200 p-4">
                <input type="checkbox" />
                <div class="collapse-title text-xl font-medium">
                  {proxy.name}
                </div>
                <div class="collapse-content grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <For each={proxy.proxies}>
                    {(proxyPoint) => (
                      <div class="card card-bordered card-compact m-1 flex-row justify-between border-secondary p-4">
                        {proxyPoint.name} {renderDelay(proxyPoint.name)}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
