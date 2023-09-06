import { useI18n } from '@solid-primitives/i18n'
import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { For, Show, createSignal } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import {
  Button,
  Collapse,
  ForTwoColumns,
  ProxyCardGroups,
  ProxyNodePreview,
  SubscriptionInfo,
} from '~/components'
import {
  formatTimeFromNow,
  sortProxiesByOrderingType,
  useStringBooleanMap,
} from '~/helpers'
import { proxiesOrderingType, useProxies } from '~/signals'
import type { Proxy } from '~/types'

enum ActiveTab {
  all = 'all',
  proxyProviders = 'proxyProviders',
  proxies = 'proxies',
}

export default () => {
  const [t] = useI18n()
  const {
    proxies,
    setProxyGroupByProxyName,
    latencyTestByProxyGroupName,
    latencyMap,
    proxyProviders,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
  } = useProxies()

  const { map: collapsedMap, set: setCollapsedMap } = useStringBooleanMap()
  const { map: latencyTestingMap, setWithCallback: setLatencyTestingMap } =
    useStringBooleanMap()

  const onProxyNodeClick = async (proxy: Proxy, proxyName: string) => {
    void setProxyGroupByProxyName(proxy, proxyName)
  }

  const onLatencyTestClick = async (e: MouseEvent, name: string) => {
    e.stopPropagation()
    void setLatencyTestingMap(name, () => latencyTestByProxyGroupName(name))
  }

  const { map: healthCheckingMap, setWithCallback: setHealthCheckingMap } =
    useStringBooleanMap()
  const { map: updatingMap, setWithCallback: setUpdatingMap } =
    useStringBooleanMap()
  const [isAllProviderUpdating, setIsAllProviderUpdating] = createSignal(false)

  const onHealthCheckClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    void setHealthCheckingMap(name, () => healthCheckByProviderName(name))
  }

  const onUpdateProviderClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    void setUpdatingMap(name, () => updateProviderByProviderName(name))
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    e.stopPropagation()
    setIsAllProviderUpdating(true)
    try {
      await updateAllProvider()
    } catch {}
    setIsAllProviderUpdating(false)
  }

  const [activeTab, setActiveTab] = createSignal(ActiveTab.all)

  const tabs = () => [
    {
      type: ActiveTab.all,
      name: t('all'),
      count: proxyProviders().length + proxies().length,
    },
    {
      type: ActiveTab.proxyProviders,
      name: t('proxyProviders'),
      count: proxyProviders().length,
    },
    {
      type: ActiveTab.proxies,
      name: t('proxies'),
      count: proxies().length,
    },
  ]

  return (
    <div class="flex h-full flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="tabs-boxed tabs gap-2">
          <For each={tabs()}>
            {(tab) => (
              <button
                class={twMerge(
                  activeTab() === tab.type && 'tab-active',
                  'tab gap-2',
                )}
                onClick={() => setActiveTab(tab.type)}
              >
                <span>{tab.name}</span>
                <div class="badge badge-sm">{tab.count}</div>
              </button>
            )}
          </For>
        </div>

        <Button
          class="btn btn-circle"
          disabled={isAllProviderUpdating()}
          onClick={(e) => onUpdateAllProviderClick(e)}
        >
          <IconReload
            class={twMerge(
              isAllProviderUpdating() && 'animate-spin text-success',
            )}
          />
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show
          when={
            activeTab() === ActiveTab.all ||
            activeTab() === ActiveTab.proxyProviders
          }
        >
          <ForTwoColumns
            subChild={proxyProviders().map((proxyProvider) => {
              const sortedProxyNames = sortProxiesByOrderingType(
                proxyProvider.proxies.map((i) => i.name) ?? [],
                latencyMap(),
                proxiesOrderingType(),
              )

              const title = (
                <>
                  <div class="mr-8 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span>{proxyProvider.name}</span>
                      <div class="badge badge-sm">
                        {proxyProvider.proxies.length}
                      </div>
                    </div>

                    <div>
                      <Button
                        class="btn btn-circle btn-sm mr-2"
                        disabled={updatingMap()[proxyProvider.name]}
                        onClick={(e) =>
                          onUpdateProviderClick(e, proxyProvider.name)
                        }
                      >
                        <IconReload
                          class={twMerge(
                            updatingMap()[proxyProvider.name] &&
                              'animate-spin text-success',
                          )}
                        />
                      </Button>

                      <Button
                        class="btn btn-circle btn-sm"
                        disabled={healthCheckingMap()[proxyProvider.name]}
                        onClick={(e) =>
                          onHealthCheckClick(e, proxyProvider.name)
                        }
                      >
                        <IconBrandSpeedtest
                          class={twMerge(
                            healthCheckingMap()[proxyProvider.name] &&
                              'animate-pulse text-success',
                          )}
                        />
                      </Button>
                    </div>
                  </div>

                  <SubscriptionInfo
                    subscriptionInfo={proxyProvider.subscriptionInfo}
                  />

                  <div class="text-sm text-slate-500">
                    {proxyProvider.vehicleType} :: {t('updated')}{' '}
                    {formatTimeFromNow(proxyProvider.updatedAt)}
                  </div>

                  <Show when={!collapsedMap()[proxyProvider.name]}>
                    <ProxyNodePreview proxyNameList={sortedProxyNames} />
                  </Show>
                </>
              )

              const content = <ProxyCardGroups proxyNames={sortedProxyNames} />

              return (
                <Collapse
                  isOpen={collapsedMap()[proxyProvider.name]}
                  title={title}
                  content={content}
                  onCollapse={(val) => setCollapsedMap(proxyProvider.name, val)}
                />
              )
            })}
          />
        </Show>

        <Show when={activeTab() === ActiveTab.all}>
          <div class="divider" />
        </Show>

        <Show
          when={
            activeTab() === ActiveTab.all || activeTab() === ActiveTab.proxies
          }
        >
          <ForTwoColumns
            subChild={proxies().map((proxy) => {
              const sortedProxyNames = sortProxiesByOrderingType(
                proxy.all ?? [],
                latencyMap(),
                proxiesOrderingType(),
              )

              const title = (
                <>
                  <div class="mr-8 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span>{proxy.name}</span>
                      <div class="badge badge-sm">{proxy.all?.length}</div>
                    </div>

                    <Button
                      class="btn-circle btn-sm"
                      disabled={latencyTestingMap()[proxy.name]}
                      onClick={(e) => onLatencyTestClick(e, proxy.name)}
                    >
                      <IconBrandSpeedtest
                        class={twMerge(
                          latencyTestingMap()[proxy.name] &&
                            'animate-pulse text-success',
                        )}
                      />
                    </Button>
                  </div>

                  <div class="text-sm text-slate-500">
                    {proxy.type} {proxy.now?.length > 0 && ` :: ${proxy.now}`}
                  </div>

                  <Show when={!collapsedMap()[proxy.name]}>
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
                  isOpen={collapsedMap()[proxy.name]}
                  title={title}
                  content={content}
                  onCollapse={(val) => setCollapsedMap(proxy.name, val)}
                />
              )
            })}
          />
        </Show>
      </div>
    </div>
  )
}
