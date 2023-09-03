import { useI18n } from '@solid-primitives/i18n'
import { IconBrandSpeedtest } from '@tabler/icons-solidjs'
import { createSignal, Show } from 'solid-js'
import {
  Button,
  Collapse,
  ForTwoColumns,
  ProxyCardGroups,
  ProxyNodePreview,
} from '~/components'
import { getBtnElFromClickEvent, sortProxiesByOrderingType } from '~/helpers'
import { proxiesOrderingType, useProxies } from '~/signals'
import type { Proxy } from '~/types'

export default () => {
  const [t] = useI18n()
  const {
    proxies,
    setProxyGroupByProxyName,
    latencyTestByProxyGroupName,
    latencyMap,
  } = useProxies()

  const [collapsedMap, setCollapsedMap] = createSignal<Record<string, boolean>>(
    {},
  )

  const onProxyNodeClick = async (proxy: Proxy, proxyName: string) => {
    void setProxyGroupByProxyName(proxy, proxyName)
  }

  const onSpeedTestClick = async (e: MouseEvent, name: string) => {
    const el = getBtnElFromClickEvent(e)

    el.classList.add('animate-pulse')
    e.stopPropagation()
    await latencyTestByProxyGroupName(name)
    el.classList.remove('animate-pulse')
  }

  return (
    <div class="flex flex-col gap-2">
      <h1 class="flex h-8 items-center pb-2 text-lg font-semibold">
        {t('proxies')}
      </h1>
      <ForTwoColumns
        subChild={proxies().map((proxy) => {
          const sortedProxyNames = sortProxiesByOrderingType(
            proxy.all ?? [],
            latencyMap(),
            proxiesOrderingType(),
          )

          const title = (
            <>
              <div class="mr-10 flex items-center justify-between">
                <span>{proxy.name}</span>
                <Button
                  class="btn-circle btn-sm"
                  onClick={(e) => onSpeedTestClick(e, proxy.name)}
                >
                  <IconBrandSpeedtest />
                </Button>
              </div>
              <div class="text-sm text-slate-500">
                {proxy.type} :: {proxy.now}
              </div>
              <Show when={!collapsedMap()[`group-${proxy.name}`]}>
                <ProxyNodePreview
                  proxyNameList={sortedProxyNames}
                  now={proxy.now}
                />
              </Show>
            </>
          )

          const content = (
            <ProxyCardGroups
              proxyNames={sortedProxyNames}
              now={proxy.now}
              onClick={(name) => {
                void onProxyNodeClick(proxy, name)
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
  )
}
