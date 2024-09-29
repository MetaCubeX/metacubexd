import { makePersisted } from '@solid-primitives/storage'
import {
  IconBrandSpeedtest,
  IconReload,
  IconSettings,
} from '@tabler/icons-solidjs'
import byteSize from 'byte-size'
import { twMerge } from 'tailwind-merge'
import {
  Button,
  Collapse,
  ProxiesSettingsModal,
  ProxyNodeCard,
  ProxyNodePreview,
  SubscriptionInfo,
} from '~/components'
import {
  filterProxiesByAvailability,
  sortProxiesByOrderingType,
} from '~/helpers'
import { useI18n } from '~/i18n'
import {
  endpoint,
  formatTimeFromNow,
  hideUnAvailableProxies,
  iconHeight,
  iconMarginRight,
  proxiesOrderingType,
  renderProxiesInTwoColumns,
  useConnections,
  useProxies,
} from '~/signals'

enum ActiveTab {
  proxyProviders = 'proxyProviders',
  proxies = 'proxies',
}

export default () => {
  const navigate = useNavigate()

  if (!endpoint()) {
    navigate('/setup', { replace: true })

    return null
  }

  let proxiesSettingsModalRef: HTMLDialogElement | undefined

  const [t] = useI18n()

  const {
    fetchProxies,
    proxies,
    selectProxyInGroup,
    proxyProviders,
    updateProviderByProviderName,
    updateAllProvider,
    proxyGroupLatencyTest,
    proxyProviderLatencyTest,
    proxyGroupLatencyTestingMap,
    proxyProviderLatencyTestingMap,
    isAllProviderUpdating,
    updatingMap,
  } = useProxies()

  const renderProxies = createMemo(() =>
    proxies().filter((proxy) => !proxy.hidden),
  )
  const { speedGroupByName } = useConnections()

  const [collapsedMap, setCollapsedMap] = makePersisted(
    createSignal<Record<string, boolean>>({}),
    {
      name: 'collapsedMap',
      storage: localStorage,
    },
  )

  const setCollapsedMapByKey = (key: string, value: boolean) => {
    setCollapsedMap((prev) => ({ ...prev, [key]: value }))
  }

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
      count: renderProxies().length,
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
                  'tab-sm sm:tab-md tab gap-2 px-2',
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
            class="btn-circle btn-primary btn-sm"
            onClick={() => proxiesSettingsModalRef?.showModal()}
            icon={<IconSettings />}
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={activeTab() === ActiveTab.proxies}>
          <div
            class={twMerge(
              'grid grid-cols-1 place-items-start gap-2',
              renderProxiesInTwoColumns() ? 'sm:grid-cols-2' : 'sm:grid-cols-1',
            )}
          >
            <For each={renderProxies()}>
              {(proxyGroup) => {
                const sortedProxyNames = createMemo(() =>
                  filterProxiesByAvailability(
                    sortProxiesByOrderingType(
                      proxyGroup.all ?? [],
                      proxiesOrderingType(),
                    ),
                    hideUnAvailableProxies(),
                  ),
                )

                const title = (
                  <>
                    <div class="flex items-center justify-between pr-8">
                      <div class="flex items-center">
                        <Show when={proxyGroup.icon}>
                          <img
                            src={proxyGroup.icon}
                            style={{
                              height: `${iconHeight()}px`,
                              'margin-right': `${iconMarginRight()}px`,
                            }}
                          />
                        </Show>
                        <span>{proxyGroup.name}</span>
                        <div class="badge badge-sm ml-2">
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

                    <div class="flex items-center justify-between text-sm text-slate-500">
                      <span>
                        {proxyGroup.type}{' '}
                        {proxyGroup.now?.length > 0 && ` :: ${proxyGroup.now}`}
                      </span>
                      <span>
                        {byteSize(
                          speedGroupByName()[proxyGroup.name] ?? 0,
                        ).toString()}
                        /s
                      </span>
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
                    onCollapse={(val) =>
                      setCollapsedMapByKey(proxyGroup.name, val)
                    }
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
          </div>
        </Show>

        <Show when={activeTab() === ActiveTab.proxyProviders}>
          <div
            class={twMerge(
              'grid grid-cols-1 place-items-start gap-2',
              renderProxiesInTwoColumns() ? 'sm:grid-cols-2' : 'sm:grid-cols-1',
            )}
          >
            <For each={proxyProviders()}>
              {(proxyProvider) => {
                const sortedProxyNames = createMemo(() =>
                  sortProxiesByOrderingType(
                    proxyProvider.proxies.map((i) => i.name) ?? [],
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
                      setCollapsedMapByKey(proxyProvider.name, val)
                    }
                  >
                    <For each={sortedProxyNames()}>
                      {(proxyName) => <ProxyNodeCard proxyName={proxyName} />}
                    </For>
                  </Collapse>
                )
              }}
            </For>
          </div>
        </Show>
      </div>

      <ProxiesSettingsModal ref={(el) => (proxiesSettingsModalRef = el)} />
    </div>
  )
}
