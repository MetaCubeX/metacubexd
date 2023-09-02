import { useI18n } from '@solid-primitives/i18n'
import { IconReload } from '@tabler/icons-solidjs'
import InfiniteScroll from 'solid-infinite-scroll'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { useRules } from '~/signals/rules'
import { formatTimeFromNow } from '~/utils/proxies'

export default () => {
  const [t] = useI18n()
  const {
    rules,
    rulesProviders,
    updateRules,
    updateAllRuleProvider,
    updateRuleProviderByName,
  } = useRules()
  const [maxRuleRender, setMaxRuleRender] = createSignal(100)
  const renderRules = createMemo(() => rules().slice(0, maxRuleRender()))

  onMount(async () => {
    updateRules()
  })

  const onUpdateProviderClick = async (e: MouseEvent, name: string) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateRuleProviderByName(name)
    el.classList.remove('animate-spin')
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    const el = e.target as HTMLElement

    el.classList.add('animate-spin')
    e.stopPropagation()
    await updateAllRuleProvider()
    el.classList.remove('animate-spin')
  }

  return (
    <div class="flex w-full flex-row gap-4">
      <div class="flex-1">
        <h1 class="pb-4 text-lg font-semibold">{t('rules')}</h1>

        <InfiniteScroll
          each={renderRules()}
          hasMore={renderRules().length < rules().length}
          next={() => setMaxRuleRender(maxRuleRender() + 100)}
        >
          {(rule) => (
            <div class="card card-bordered card-compact mb-2 bg-base-200 p-4">
              <div class="break-all">
                {rule.payload}
                {rule.size !== -1 && ` (${rule.size})`}
              </div>
              <div class="text-xs text-slate-500">
                {rule.type} :: {rule.proxy}
              </div>
            </div>
          )}
        </InfiniteScroll>
      </div>

      <Show when={rulesProviders().length > 0}>
        <div class="flex-1">
          <h1 class="flex h-11 items-center pb-4 text-lg font-semibold">
            {t('ruleProviders')}
            <button
              class="btn btn-circle btn-ghost btn-sm ml-2"
              onClick={(e) => onUpdateAllProviderClick(e)}
            >
              <IconReload />
            </button>
          </h1>

          <For each={rulesProviders()}>
            {(rulesProvider) => (
              <div class="card card-bordered card-compact mb-2 bg-base-200 p-4">
                <div class="flex h-6 items-center justify-between">
                  <span>
                    {rulesProvider.name} ({rulesProvider.ruleCount})
                  </span>
                  <div>
                    <button
                      class="btn btn-circle btn-sm mr-2"
                      onClick={(e) =>
                        onUpdateProviderClick(e, rulesProvider.name)
                      }
                    >
                      <IconReload />
                    </button>
                  </div>
                </div>
                <div class="text-xs text-slate-500">
                  {rulesProvider.vehicleType} / {rulesProvider.behavior} /
                  Updated {formatTimeFromNow(rulesProvider.updatedAt)}
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
