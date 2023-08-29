import { For, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { useProxies } from '~/signals/proxies'
import type { Proxy } from '~/types'

export default () => {
  const {
    proxies,
    proxyProviders,
    delayMap,
    updateProxy,
    setProxiesByProxyName,
  } = useProxies()
  const [collapseMap, setCollapseMap] = createSignal<Record<string, boolean>>(
    {},
  )

  const renderDelay = (proxyname: string) => {
    const delay = delayMap()[proxyname]

    if (typeof delay !== 'number' || delay === 0) {
      return ''
    }

    return <span>{delay}ms</span>
  }

  onMount(async () => {
    await updateProxy()
  })

  const onProxyNodeClick = async (proxy: Proxy, proxyName: string) => {
    setProxiesByProxyName(proxy, proxyName)
  }

  const onCollapseTitleClick = (name: string) => {
    const cMap = collapseMap()

    cMap[name] = !cMap[name]
    setCollapseMap({ ...cMap })
  }

  const getCollapseClassName = (name: string) => {
    return collapseMap()[name] ? 'collapse-open' : 'collapse-close'
  }

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxies</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-1">
          <For each={proxies()}>
            {(proxy) => (
              <div
                class={twMerge(
                  getCollapseClassName(proxy.name),
                  'collapse collapse-arrow border-secondary bg-base-200 p-4',
                )}
              >
                <div
                  class="collapse-title text-xl font-medium"
                  onClick={() => onCollapseTitleClick(proxy.name)}
                >
                  {proxy.name} {proxy.type}
                </div>
                <div class="collapse-content grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <For each={proxy.all}>
                    {(proxyName) => (
                      <div
                        class={twMerge(
                          proxy.now === proxyName
                            ? 'border-primary bg-success-content text-success'
                            : 'border-secondary',
                          'card card-bordered card-compact m-1 cursor-pointer flex-row justify-between p-4',
                        )}
                        onClick={() => onProxyNodeClick(proxy, proxyName)}
                      >
                        {proxyName} {renderDelay(proxyName)}
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
              <div
                class={twMerge(
                  getCollapseClassName(proxy.name),
                  'collapse-arrow collapse border-secondary bg-base-200 p-4',
                )}
              >
                <div
                  class="collapse-title text-xl font-medium"
                  onClick={() => onCollapseTitleClick(proxy.name)}
                >
                  {proxy.name}
                </div>
                <div class="collapse-content grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                  <For each={proxy.proxies}>
                    {(proxyNode) => (
                      <div class="card card-bordered card-compact m-1 flex-row justify-between border-secondary p-4">
                        {proxyNode.name} {renderDelay(proxyNode.name)}
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
