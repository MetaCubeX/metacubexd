import { useI18n } from '@solid-primitives/i18n'
import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { Show, createSignal } from 'solid-js'
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
  handleAnimatedBtnClickWithCallback,
  sortProxiesByOrderingType,
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

  const [collapsedMap, setCollapsedMap] = createSignal<Record<string, boolean>>(
    {},
  )

  const onHealthCheckClick = (e: MouseEvent, name: string) => {
    handleAnimatedBtnClickWithCallback(
      e,
      healthCheckByProviderName.bind(null, name),
      'animate-pulse',
    )
  }

  const onUpdateProviderClick = (e: MouseEvent, name: string) => {
    handleAnimatedBtnClickWithCallback(
      e,
      updateProviderByProviderName.bind(null, name),
    )
  }

  const onUpdateAllProviderClick = (e: MouseEvent) => {
    handleAnimatedBtnClickWithCallback(e, updateAllProvider)
  }

  return (
    <div class="flex flex-col gap-2">
      <h1 class="flex h-8 items-center pb-2 text-lg font-semibold">
        {t('proxyProviders')}

        <Button
          class="btn-circle btn-ghost btn-sm ml-2"
          onClick={(e) => onUpdateAllProviderClick(e)}
        >
          <IconReload />
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
                    <IconReload />
                  </Button>

                  <Button
                    class="btn btn-circle btn-sm"
                    onClick={(e) => onHealthCheckClick(e, proxyProvider.name)}
                  >
                    <IconBrandSpeedtest />
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
              <Show when={!collapsedMap()[`provider-${proxyProvider.name}`]}>
                <ProxyNodePreview proxyNameList={sortedProxyNames} />
              </Show>
            </>
          )

          const content = <ProxyCardGroups proxyNames={sortedProxyNames} />

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
    </div>
  )
}
