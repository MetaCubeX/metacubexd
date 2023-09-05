import { useI18n } from '@solid-primitives/i18n'
import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { Show, createSignal } from 'solid-js'
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

export default () => {
  const [t] = useI18n()
  const {
    proxyProviders,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
    latencyMap,
  } = useProxies()

  const { map: collapsedMap, set: setCollapsedMap } = useStringBooleanMap()
  const { map: healthCheckingMap, setWithCallback: setHealthCheckingMap } =
    useStringBooleanMap()
  const { map: updateingMap, setWithCallback: setUpdateingMap } =
    useStringBooleanMap()
  const [allProviderIsUpdating, setAllProviderIsUpdating] = createSignal(false)

  const onHealthCheckClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    setHealthCheckingMap(name, () => healthCheckByProviderName(name))
  }

  const onUpdateProviderClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    setUpdateingMap(name, () => updateProviderByProviderName(name))
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    e.stopPropagation()
    setAllProviderIsUpdating(true)
    try {
      await updateAllProvider()
    } catch {}
    setAllProviderIsUpdating(false)
  }

  return (
    <div class="flex flex-col gap-2">
      <h1 class="flex h-8 items-center pb-2 text-lg font-semibold">
        {t('proxyProviders')}

        <Button
          class="btn-circle btn-ghost btn-sm ml-2"
          onClick={(e) => onUpdateAllProviderClick(e)}
        >
          <IconReload
            class={twMerge(
              allProviderIsUpdating() && 'animate-spin text-success',
            )}
          />
        </Button>
      </h1>
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
                <span>{proxyProvider.name}</span>
                <div>
                  <Button
                    class="btn btn-circle btn-sm mr-2"
                    onClick={(e) =>
                      onUpdateProviderClick(e, proxyProvider.name)
                    }
                  >
                    <IconReload
                      class={twMerge(
                        updateingMap()[proxyProvider.name] &&
                          'animate-spin text-success',
                      )}
                    />
                  </Button>

                  <Button
                    class="btn btn-circle btn-sm"
                    onClick={(e) => onHealthCheckClick(e, proxyProvider.name)}
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
    </div>
  )
}
