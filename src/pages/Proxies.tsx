import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { For, Show, createSignal, onMount } from 'solid-js'
import Collapse from '~/components/Collpase'
import ProxyNodeCard from '~/components/ProxyNodeCard'
import SubscriptionInfo from '~/components/SubscriptionInfo'
import { useProxies } from '~/signals/proxies'
import type { Proxy } from '~/types'
import { formatTimeFromNow } from '~/utils/date'

export default () => {
  const {
    proxies,
    proxyProviders,
    updateProxy,
    setProxyGroupByProxyName,
    delayTestByProxyGroupName,
    updateProviderByProviderName,
    healthCheckByProviderName,
  } = useProxies()

  const [collapsedMap, setCollapsedMap] = createSignal<Record<string, boolean>>(
    {},
  )

  onMount(async () => {
    await updateProxy()
  })

  const onProxyNodeClick = async (proxy: Proxy, proxyName: string) => {
    setProxyGroupByProxyName(proxy, proxyName)
  }

  const onSpeedTestClick = async (e: MouseEvent, name: string) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-pulse')
    e.stopPropagation()
    await delayTestByProxyGroupName(name)
    el.classList.remove('animate-pulse')
  }

  const onHealthCheckClick = async (e: MouseEvent, name: string) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-pulse')
    e.stopPropagation()
    await healthCheckByProviderName(name)
    el.classList.remove('animate-pulse')
  }

  const onUpdateProviderClick = async (e: MouseEvent, name: string) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateProviderByProviderName(name)
    el.classList.remove('animate-spin')
  }

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxies</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={proxies()}>
            {(proxy) => {
              const title = (
                <div class="flex items-center justify-between">
                  <div class="flex flex-col">
                    <span>{proxy.name}</span>

                    <div class="text-sm text-slate-500">
                      {proxy.type} :: {proxy.now}
                    </div>
                  </div>

                  <button
                    class="btn btn-circle btn-sm"
                    onClick={(e) => onSpeedTestClick(e, proxy.name)}
                  >
                    <IconBrandSpeedtest />
                  </button>
                </div>
              )

              const content = (
                <For each={proxy.all}>
                  {(proxyName) => (
                    <ProxyNodeCard
                      proxyName={proxyName}
                      isSelected={proxy.now === proxyName}
                      onClick={() => onProxyNodeClick(proxy, proxyName)}
                    />
                  )}
                </For>
              )

              return (
                <div>
                  <Collapse
                    isOpen={collapsedMap()[`group-${proxy.name}`]}
                    title={title}
                    content={content}
                    onCollapse={(val) =>
                      setCollapsedMap({
                        ...collapsedMap(),
                        [`group-${proxy.name}`]: val,
                      })
                    }
                  />
                </div>
              )
            }}
          </For>
        </div>
      </div>

      <Show when={proxyProviders().length > 0}>
        <h1 class="pb-4 text-lg font-semibold">Proxy Providers</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={proxyProviders()}>
            {(proxyProvider) => {
              const title = (
                <div class="flex items-center justify-between">
                  <div class="flex flex-col gap-1">
                    <span>{proxyProvider.name}</span>
                    <SubscriptionInfo
                      subscriptionInfo={proxyProvider.subscriptionInfo}
                    />
                    <div class="text-sm text-slate-500">
                      {proxyProvider.vehicleType} :: Updated{' '}
                      {formatTimeFromNow(proxyProvider.updatedAt)}
                    </div>
                  </div>

                  <div class="flex flex-nowrap">
                    <button
                      class="btn btn-circle btn-sm mr-2"
                      onClick={(e) =>
                        onUpdateProviderClick(e, proxyProvider.name)
                      }
                    >
                      <IconReload />
                    </button>
                    <button
                      class="btn btn-circle btn-sm"
                      onClick={(e) => onHealthCheckClick(e, proxyProvider.name)}
                    >
                      <IconBrandSpeedtest />
                    </button>
                  </div>
                </div>
              )
              const content = (
                <For each={proxyProvider.proxies}>
                  {(proxy) => <ProxyNodeCard proxyName={proxy.name} />}
                </For>
              )

              return (
                <div>
                  <Collapse
                    isOpen={collapsedMap()[`provider-${proxyProvider.name}`]}
                    title={title}
                    content={content}
                    onCollapse={(val) =>
                      setCollapsedMap({
                        ...collapsedMap(),
                        [`provider-${proxyProvider.name}`]: val,
                      })
                    }
                  />
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
