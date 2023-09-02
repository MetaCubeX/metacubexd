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
import { formatTimeFromNow, getBtnElFromClickEvent } from '~/helpers'
import { useProxies } from '~/signals'

export default () => {
  const [t] = useI18n()
  const {
    proxyProviders,
    updateProviderByProviderName,
    updateAllProvider,
    healthCheckByProviderName,
  } = useProxies()

  const [collapsedMap, setCollapsedMap] = createSignal<Record<string, boolean>>(
    {},
  )

  const onHealthCheckClick = async (e: MouseEvent, name: string) => {
    const el = getBtnElFromClickEvent(e)

    el.classList.add('animate-pulse')
    e.stopPropagation()
    await healthCheckByProviderName(name)
    el.classList.remove('animate-pulse')
  }

  const onUpdateProviderClick = async (e: MouseEvent, name: string) => {
    const el = getBtnElFromClickEvent(e)

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateProviderByProviderName(name)
    el.classList.remove('animate-spin')
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    const el = getBtnElFromClickEvent(e)

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateAllProvider()
    el.classList.remove('animate-spin')
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
                {proxyProvider.vehicleType} :: Updated{' '}
                {formatTimeFromNow(proxyProvider.updatedAt)}
              </div>
              <Show when={!collapsedMap()[`provider-${proxyProvider.name}`]}>
                <ProxyNodePreview
                  proxyNameList={proxyProvider.proxies.map((i) => i.name) ?? []}
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
    </div>
  )
}
