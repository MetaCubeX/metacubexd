import { makePersisted } from '@solid-primitives/storage'
import {
  IconBrandSpeedtest,
  IconChevronRight,
  IconReload,
  IconSettings,
} from '@tabler/icons-solidjs'
import byteSize from 'byte-size'
import { twMerge } from 'tailwind-merge'
import {
  Button,
  Collapse,
  DocumentTitle,
  ProxiesSettingsModal,
  ProxyNodeCard,
  ProxyNodePreview,
  SubscriptionInfo,
} from '~/components'
import { ProxiesRenderWarpper } from '~/components/ProxiesRenderWrapper'
import {
  filterProxiesByAvailability,
  formatProxyType,
  formatTimeFromNow,
  sortProxiesByOrderingType,
} from '~/helpers'
import { useI18n } from '~/i18n'
import {
  endpoint,
  hideUnAvailableProxies,
  iconHeight,
  iconMarginRight,
  proxiesOrderingType,
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
  /**
   * transform an SVG into a data URI
   * @see https://gist.github.com/jennyknuth/222825e315d45a738ed9d6e04c7a88d0
   */
  const encodeSvg = (svg: string) => {
    return svg
      .replace(
        '<svg',
        ~svg.indexOf('xmlns')
          ? '<svg'
          : '<svg xmlns="http://www.w3.org/2000/svg"',
      )
      .replace(/"/g, "'")
      .replace(/%/g, '%25')
      .replace(/#/g, '%23')
      .replace(/\{/g, '%7B')
      .replace(/\}/g, '%7D')
      .replace(/</g, '%3C')
      .replace(/>/g, '%3E')
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
    <>
      <DocumentTitle>{t('proxies')}</DocumentTitle>

      <div class="flex h-full flex-col gap-2">
        <div class="flex items-center gap-2">
          <div class="tabs gap-2 tabs-box tabs-sm">
            <For each={tabs()}>
              {(tab) => (
                <button
                  class={twMerge(
                    activeTab() === tab.type && 'bg-primary !text-neutral',
                    'sm:tab-md tab gap-2 px-2',
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
              class="btn-circle btn-sm btn-primary"
              onClick={() => proxiesSettingsModalRef?.showModal()}
              icon={<IconSettings />}
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <Show when={activeTab() === ActiveTab.proxies}>
            <ProxiesRenderWarpper>
              <For each={renderProxies()}>
                {(proxyGroup) => {
                  const sortedProxyNames = createMemo(() =>
                    filterProxiesByAvailability({
                      proxyNames: sortProxiesByOrderingType({
                        proxyNames: proxyGroup.all ?? [],
                        orderingType: proxiesOrderingType(),
                        testUrl: proxyGroup.testUrl || null,
                      }),
                      enabled: hideUnAvailableProxies(),
                      testUrl: proxyGroup.testUrl || null,
                    }),
                  )

                  const title = (
                    <div class="space-y-2">
                      <div class="flex items-center justify-between pr-8">
                        <div class="flex items-center">
                          <Show when={proxyGroup.icon}>
                            <Show
                              when={proxyGroup.icon!.startsWith(
                                'data:image/svg+xml',
                              )}
                              fallback={
                                <img
                                  src={proxyGroup.icon}
                                  style={{
                                    height: `${iconHeight()}px`,
                                    'margin-right': `${iconMarginRight()}px`,
                                  }}
                                />
                              }
                            >
                              <div
                                style={{
                                  height: `${iconHeight()}px`,
                                  width: `${iconHeight()}px`,
                                  color:
                                    'oklch(var(--p) / var(--tw-bg-opacity))',
                                  'background-color': 'currentColor',
                                  'margin-right': `${iconMarginRight()}px`,
                                  'mask-image': `url("${encodeSvg(proxyGroup.icon!)}")`,
                                  'mask-size': '100% 100%',
                                }}
                              />
                            </Show>
                          </Show>
                          <span>{proxyGroup.name}</span>
                          <div class="ml-2 badge badge-sm">
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
                                proxyGroupLatencyTestingMap()[
                                  proxyGroup.name
                                ] && 'animate-pulse text-success',
                              )}
                            />
                          }
                        />
                      </div>

                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="badge badge-sm badge-primary">
                          <span class="font-bold">
                            {formatProxyType(proxyGroup.type)}
                          </span>
                          <Show when={proxyGroup.now?.length > 0}>
                            <IconChevronRight size={18} />
                            <span class="whitespace-nowrap">
                              {proxyGroup.now}
                            </span>
                          </Show>
                        </div>

                        <div class="badge badge-sm badge-secondary">
                          {byteSize(
                            speedGroupByName()[proxyGroup.name] ?? 0,
                          ).toString()}
                          /s
                        </div>
                      </div>

                      <Show when={!collapsedMap()[proxyGroup.name]}>
                        <ProxyNodePreview
                          proxyNameList={sortedProxyNames()}
                          now={proxyGroup.now}
                          testUrl={proxyGroup.testUrl || null}
                        />
                      </Show>
                    </div>
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
                            testUrl={proxyGroup.testUrl || null}
                            timeout={proxyGroup.timeout ?? null}
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
            </ProxiesRenderWarpper>
          </Show>

          <Show when={activeTab() === ActiveTab.proxyProviders}>
            <ProxiesRenderWarpper>
              <For each={proxyProviders()}>
                {(proxyProvider) => {
                  const sortedProxyNames = createMemo(() =>
                    sortProxiesByOrderingType({
                      orderingType: proxiesOrderingType(),
                      proxyNames:
                        proxyProvider.proxies.map((i) => i.name) ?? [],
                      testUrl: proxyProvider.testUrl,
                    }),
                  )

                  const title = (
                    <>
                      <div class="flex items-center justify-between pr-8">
                        <div class="flex flex-wrap items-center gap-1">
                          <span class="line-clamp-1 break-all">
                            {proxyProvider.name}
                          </span>

                          <div class="badge badge-sm">
                            {proxyProvider.proxies.length}
                          </div>

                          <div class="badge badge-sm">
                            {proxyProvider.vehicleType}
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
                              proxyProviderLatencyTestingMap()[
                                proxyProvider.name
                              ]
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

                      <div class="flex flex-col gap-2">
                        <div class="text-sm text-slate-500">
                          {t('updated')}{' '}
                          {formatTimeFromNow(proxyProvider.updatedAt)}
                        </div>

                        <Show when={!collapsedMap()[proxyProvider.name]}>
                          <ProxyNodePreview
                            proxyNameList={sortedProxyNames()}
                            testUrl={proxyProvider.testUrl}
                          />
                        </Show>
                      </div>
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
                        {(proxyName) => (
                          <ProxyNodeCard
                            proxyName={proxyName}
                            testUrl={proxyProvider.testUrl}
                            timeout={proxyProvider.timeout ?? null}
                          />
                        )}
                      </For>
                    </Collapse>
                  )
                }}
              </For>
            </ProxiesRenderWarpper>
          </Show>
        </div>

        <ProxiesSettingsModal ref={(el) => (proxiesSettingsModalRef = el)} />
      </div>
    </>
  )
}
