import {
  IconBrandSpeedtest,
  IconReload,
  IconSettings,
} from '@tabler/icons-solidjs'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import {
  Button,
  Collapse,
  ProxiesSettingsModal,
  ProxyNodeCard,
  ProxyNodePreview,
  RenderInTwoColumns,
  SubscriptionInfo,
} from '~/components'
import {
  filterProxiesByAvailability,
  sortProxiesByOrderingType,
} from '~/helpers'
import { useI18n } from '~/i18n'
import {
  formatTimeFromNow,
  hideUnAvailableProxies,
  proxiesOrderingType,
  useProxies,
} from '~/signals'

enum ActiveTab {
  proxyProviders = 'proxyProviders',
  proxies = 'proxies',
}

export default () => {
  let proxiesSettingsModalRef: HTMLDialogElement | undefined

  const [t] = useI18n()

  const {
    fetchProxies,
    proxies,
    selectProxyInGroup,
    latencyMap,
    proxyProviders,
    updateProviderByProviderName,
    updateAllProvider,
    proxyGroupLatencyTest,
    proxyProviderLatencyTest,
    collapsedMap,
    setCollapsedMap,
    proxyGroupLatencyTestingMap,
    proxyProviderLatencyTestingMap,
    isAllProviderUpdating,
    updatingMap,
  } = useProxies()

  onMount(fetchProxies)

  const onProxyGroupLatencyTestClick = async (
    e: MouseEvent,
    groupName: string,
  ) => {
    e.stopPropagation()
    void proxyGroupLatencyTest(groupName)
  }

  const onProxyProviderLatencyTestClick = (
    e: MouseEvent,
    providerName: string,
  ) => {
    e.stopPropagation()
    void proxyProviderLatencyTest(providerName)
  }

  const onUpdateProxyProviderClick = (e: MouseEvent, providerName: string) => {
    e.stopPropagation()
    void updateProviderByProviderName(providerName)
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    e.stopPropagation()
    void updateAllProvider()
  }

  const [activeTab, setActiveTab] = createSignal(ActiveTab.proxies)

  const tabs = () => [
    {
      type: ActiveTab.proxies,
      name: t('proxies'),
      count: proxies().length,
    },
    {
      type: ActiveTab.proxyProviders,
      name: t('proxyProviders'),
      count: proxyProviders().length,
    },
  ]

  return (
    <div class="flex h-full flex-col gap-2">
      <div class="flex items-center gap-2">
        <div class="tabs-boxed tabs gap-2">
          <For each={tabs()}>
            {(tab) => (
              <button
                class={twMerge(
                  activeTab() === tab.type && 'tab-active',
                  'tab tab-sm gap-2 px-2 sm:tab-md',
                )}
                onClick={() => setActiveTab(tab.type)}
              >
                <span>{tab.name}</span>
                <div class="badge badge-sm">{tab.count}</div>
              </button>
            )}
          </For>
        </div>

        <Show when={activeTab() === ActiveTab.proxyProviders}>
          <Button
            class="btn btn-circle btn-sm"
            disabled={isAllProviderUpdating()}
            onClick={(e) => onUpdateAllProviderClick(e)}
            icon={
              <IconReload
                class={twMerge(
                  isAllProviderUpdating() && 'animate-spin text-success',
                )}
              />
            }
          />
        </Show>

        <div class="ml-auto">
          <Button
            class="btn-circle btn-sm sm:btn-md"
            onClick={() => proxiesSettingsModalRef?.showModal()}
            icon={<IconSettings />}
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={activeTab() === ActiveTab.proxies}>
          <RenderInTwoColumns>
            <For each={proxies()}>
              {(proxyGroup) => {
                const sortedProxyNames = createMemo(() =>
                  filterProxiesByAvailability(
                    sortProxiesByOrderingType(
                      proxyGroup.all ?? [],
                      latencyMap(),
                      proxiesOrderingType(),
                    ),
                    latencyMap(),
                    hideUnAvailableProxies(),
                  ),
                )

                const title = (
                  <>
                    <div class="flex items-center justify-between pr-8">
                      <div class="flex items-center gap-2">
                        <span>{proxyGroup.name}</span>
                        <div class="badge badge-sm">
                          {proxyGroup.all?.length}
                        </div>
                      </div>

                      <Button
                        class="btn-circle btn-sm"
                        disabled={
                          proxyGroupLatencyTestingMap()[proxyGroup.name]
                        }
                        onClick={(e) =>
                          onProxyGroupLatencyTestClick(e, proxyGroup.name)
                        }
                        icon={
                          <IconBrandSpeedtest
                            class={twMerge(
                              proxyGroupLatencyTestingMap()[proxyGroup.name] &&
                                'animate-pulse text-success',
                            )}
                          />
                        }
                      />
                    </div>

                    <div class="text-sm text-slate-500">
                      {proxyGroup.type}{' '}
                      {proxyGroup.now?.length > 0 && ` :: ${proxyGroup.now}`}
                    </div>

                    <Show when={!collapsedMap()[proxyGroup.name]}>
                      <ProxyNodePreview
                        proxyNameList={sortedProxyNames()}
                        now={proxyGroup.now}
                      />
                    </Show>
                  </>
                )

                return (
                  <Collapse
                    isOpen={collapsedMap()[proxyGroup.name]}
                    title={title}
                    onCollapse={(val) => setCollapsedMap(proxyGroup.name, val)}
                  >
                    <For each={sortedProxyNames()}>
                      {(proxyName) => (
                        <ProxyNodeCard
                          proxyName={proxyName}
                          isSelected={proxyGroup.now === proxyName}
                          onClick={() =>
                            void selectProxyInGroup(proxyGroup, proxyName)
                          }
                        />
                      )}
                    </For>
                  </Collapse>
                )
              }}
            </For>
          </RenderInTwoColumns>
        </Show>

        <Show when={activeTab() === ActiveTab.proxyProviders}>
          <RenderInTwoColumns>
            <For each={proxyProviders()}>
              {(proxyProvider) => {
                const sortedProxyNames = createMemo(() =>
                  sortProxiesByOrderingType(
                    proxyProvider.proxies.map((i) => i.name) ?? [],
                    latencyMap(),
                    proxiesOrderingType(),
                  ),
                )

                const title = (
                  <>
                    <div class="flex items-center justify-between pr-8">
                      <div class="flex items-center gap-2">
                        <span>{proxyProvider.name}</span>
                        <div class="badge badge-sm">
                          {proxyProvider.proxies.length}
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <Button
                          class="btn btn-circle btn-sm"
                          disabled={updatingMap()[proxyProvider.name]}
                          onClick={(e) =>
                            onUpdateProxyProviderClick(e, proxyProvider.name)
                          }
                          icon={
                            <IconReload
                              class={twMerge(
                                updatingMap()[proxyProvider.name] &&
                                  'animate-spin text-success',
                              )}
                            />
                          }
                        />

                        <Button
                          class="btn btn-circle btn-sm"
                          disabled={
                            proxyProviderLatencyTestingMap()[proxyProvider.name]
                          }
                          onClick={(e) =>
                            onProxyProviderLatencyTestClick(
                              e,
                              proxyProvider.name,
                            )
                          }
                          icon={
                            <IconBrandSpeedtest
                              class={twMerge(
                                proxyProviderLatencyTestingMap()[
                                  proxyProvider.name
                                ] && 'animate-pulse text-success',
                              )}
                            />
                          }
                        />
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
                      <ProxyNodePreview proxyNameList={sortedProxyNames()} />
                    </Show>
                  </>
                )

                return (
                  <Collapse
                    isOpen={collapsedMap()[proxyProvider.name]}
                    title={title}
                    onCollapse={(val) =>
                      setCollapsedMap(proxyProvider.name, val)
                    }
                  >
                    <For each={sortedProxyNames()}>
                      {(proxyName) => <ProxyNodeCard proxyName={proxyName} />}
                    </For>
                  </Collapse>
                )
              }}
            </For>
          </RenderInTwoColumns>
        </Show>
      </div>

      <ProxiesSettingsModal ref={(el) => (proxiesSettingsModalRef = el)} />
    </div>
  )
}
