import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { Show, createSignal, onMount } from 'solid-js'
import Collapse from '~/components/Collpase'
import ForTwoLine from '~/components/ForTwoLine'
import ProxyCardGroups from '~/components/ProxyCardGroups'
import ProxyNodeDots from '~/components/ProxyNodeDots'
import SubscriptionInfo from '~/components/SubscriptionInfo'
import { useProxies } from '~/signals/proxies'
import type { Proxy } from '~/types'
import { formatTimeFromNow } from '~/utils/proxies'

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

        <ForTwoLine
          subChild={proxies().map((proxy) => {
            const title = (
              <>
                <div class="mr-10 flex items-center justify-between">
                  <span>{proxy.name}</span>
                  <button
                    class="btn btn-circle btn-sm"
                    onClick={(e) => onSpeedTestClick(e, proxy.name)}
                  >
                    <IconBrandSpeedtest />
                  </button>
                </div>
                <div class="text-sm text-slate-500">
                  {proxy.type} :: {proxy.now}
                </div>
                <Show when={!collapsedMap()[`group-${proxy.name}`]}>
                  <ProxyNodeDots
                    proxyNameList={proxy.all ?? []}
                    now={proxy.now}
                  />
                </Show>
              </>
            )

            const content = (
              <ProxyCardGroups
                proxies={proxy.all!}
                now={proxy.now}
                onClick={(name) => {
                  onProxyNodeClick(proxy, name)
                }}
              />
            )

            return (
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
            )
          })}
        />
      </div>

      <Show when={proxyProviders().length > 0}>
        <h1 class="pb-4 text-lg font-semibold">Proxy Providers</h1>

        <ForTwoLine
          subChild={proxyProviders().map((proxyProvider) => {
            const title = (
              <>
                <div class="mr-10 flex items-center justify-between">
                  <span>{proxyProvider.name}</span>
                  <div>
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
                <SubscriptionInfo
                  subscriptionInfo={proxyProvider.subscriptionInfo}
                />
                <div class="text-sm text-slate-500">
                  {proxyProvider.vehicleType} :: Updated{' '}
                  {formatTimeFromNow(proxyProvider.updatedAt)}
                </div>
                <Show when={!collapsedMap()[`provider-${proxyProvider.name}`]}>
                  <ProxyNodeDots
                    proxyNameList={
                      proxyProvider.proxies.map((i) => i.name) ?? []
                    }
                  />
                </Show>
              </>
            )
            const content = (
              <ProxyCardGroups
                proxies={proxyProvider.proxies.map((i) => i.name)}
              />
            )

            return (
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
            )
          })}
        />
      </Show>
    </div>
  )
}
