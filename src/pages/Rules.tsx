import { useI18n } from '@solid-primitives/i18n'
import { IconReload } from '@tabler/icons-solidjs'
import InfiniteScroll from 'solid-infinite-scroll'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from '~/components'
import { formatTimeFromNow, useStringBooleanMap } from '~/helpers'
import { renderRulesAndProviderInTwoColumns, useRules } from '~/signals'

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

  onMount(updateRules)

  const { map: updatingMap, setWithCallback: setUpdatingMap } =
    useStringBooleanMap()
  const [allProviderIsUpdating, setAllProviderIsUpdating] = createSignal(false)

  const onUpdateProviderClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    void setUpdatingMap(name, () => updateRuleProviderByName(name))
  }

  const onUpdateAllProviderClick = async (e: MouseEvent) => {
    e.stopPropagation()
    setAllProviderIsUpdating(true)
    try {
      await updateAllRuleProvider()
    } catch {}
    setAllProviderIsUpdating(false)
  }

  return (
    <div
      class={twMerge(
        'flex w-full flex-col gap-4',
        renderRulesAndProviderInTwoColumns() && 'flex-row',
      )}
    >
      <div class="flex-1">
        <h1 class="pb-4 text-lg font-semibold">{t('rules')}</h1>

        <InfiniteScroll
          each={renderRules()}
          hasMore={renderRules().length < rules().length}
          next={() => setMaxRuleRender(maxRuleRender() + 100)}
        >
          {(rule) => (
            <div class="card card-bordered card-compact mb-2 bg-base-200 p-4">
              <div class="flex items-center gap-2">
                <span class="break-all">{rule.payload}</span>
                <Show when={typeof rule.size === 'number' && rule.size !== -1}>
                  <div class="badge badge-sm">{rule.size}</div>
                </Show>
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
          <h1 class="flex h-11 items-center gap-2 pb-4 text-lg font-semibold">
            {t('ruleProviders')}
            <Button
              class="btn-circle btn-sm"
              disabled={allProviderIsUpdating()}
              onClick={(e) => onUpdateAllProviderClick(e)}
            >
              <IconReload
                class={twMerge(
                  allProviderIsUpdating() && 'animate-spin text-success',
                )}
              />
            </Button>
          </h1>

          <For each={rulesProviders()}>
            {(rulesProvider) => (
              <div class="card card-bordered card-compact mb-2 bg-base-200 p-4">
                <div class="flex items-center gap-2 pr-8">
                  <span class="break-all">{rulesProvider.name}</span>
                  <div class="badge badge-sm">{rulesProvider.ruleCount}</div>
                </div>

                <div class="text-xs text-slate-500">
                  {rulesProvider.vehicleType} / {rulesProvider.behavior} /
                  {t('updated')} {formatTimeFromNow(rulesProvider.updatedAt)}
                </div>

                <Button
                  class="btn-circle btn-sm absolute right-2 top-2 mr-2 h-4"
                  disabled={updatingMap()[rulesProvider.name]}
                  onClick={(e) => onUpdateProviderClick(e, rulesProvider.name)}
                >
                  <IconReload
                    class={twMerge(
                      updatingMap()[rulesProvider.name] &&
                        'animate-spin text-success',
                    )}
                  />
                </Button>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
