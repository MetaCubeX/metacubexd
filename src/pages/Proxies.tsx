import { IconBrandSpeedtest } from '@tabler/icons-solidjs'
import { For, createSignal, onMount } from 'solid-js'
import Collapse from '~/components/Collpase'
import ProxyNodeCard from '~/components/ProxyNodeCard'
import { useProxies } from '~/signals/proxies'
import type { Proxy } from '~/types'

export default () => {
  const {
    proxies,
    proxyProviders,
    updateProxy,
    setProxiesByProxyName,
    delayTestByProxyGroupName,
  } = useProxies()

  const [collapsedMap, setCollapsedMap] = createSignal<Record<string, boolean>>(
    {},
  )

  onMount(async () => {
    await updateProxy()
  })

  const onProxyNodeClick = async (proxy: Proxy, proxyName: string) => {
    setProxiesByProxyName(proxy, proxyName)
  }

  const onSpeedTestClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    delayTestByProxyGroupName(name)
  }

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxies</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={proxies()}>
            {(proxy) => {
              const title = (
                <>
                  <div class="flex items-center gap-2">
                    <span>{proxy.name}</span>

                    <IconBrandSpeedtest
                      class="cursor-pointer"
                      onClick={(e) => onSpeedTestClick(e, proxy.name)}
                    />
                  </div>
                  <div class="text-sm text-slate-500">
                    {proxy.type} :: {proxy.now}
                  </div>
                </>
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
            }}
          </For>
        </div>
      </div>

      <div>
        <h1 class="pb-4 text-lg font-semibold">Proxy Providers</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <For each={proxyProviders()}>
            {(proxyProvider) => {
              const title = <>{proxyProvider.name}</>
              const content = (
                <For each={proxyProvider.proxies}>
                  {(proxy) => <ProxyNodeCard proxyName={proxy.name} />}
                </For>
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
            }}
          </For>
        </div>
      </div>
    </div>
  )
}
