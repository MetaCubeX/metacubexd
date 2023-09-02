import { useI18n } from '@solid-primitives/i18n'
import { IconBrandSpeedtest, IconReload } from '@tabler/icons-solidjs'
import { Show, createSignal } from 'solid-js'
import Collapse from '~/components/Collpase'
import ForTwoLine from '~/components/ForTwoLine'
import ProxyCardGroups from '~/components/ProxyCardGroups'
import ProxyNodePreview from '~/components/ProxyNodePreview'
import SubscriptionInfo from '~/components/SubscriptionInfo'
import { useProxies } from '~/signals/proxies'
import { formatTimeFromNow } from '~/utils/proxies'

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

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateAllProvider()
    el.classList.remove('animate-spin')
  }

  return (
    <div class="flex flex-col gap-2">
      <h1 class="pm-4 flex items-center text-lg font-semibold">
        {t('proxyProviders')}
        <button
          class="btn btn-circle btn-ghost btn-sm ml-2"
          onClick={(e) => onUpdateAllProviderClick(e)}
        >
          <IconReload />
        </button>
      </h1>
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
