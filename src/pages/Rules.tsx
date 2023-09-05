import { useI18n } from '@solid-primitives/i18n'
import { IconReload } from '@tabler/icons-solidjs'
import InfiniteScroll from 'solid-infinite-scroll'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from '~/components'
import { formatTimeFromNow, useStringBooleanMap } from '~/helpers'
import { useRules } from '~/signals'

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

  const { map: updateingMap, setWithCallback: setUpdateingMap } =
    useStringBooleanMap()
  const [allProviderIsUpdating, setAllProviderIsUpdating] = createSignal(false)

  const onUpdateProviderClick = (e: MouseEvent, name: string) => {
    e.stopPropagation()
    setUpdateingMap(name, async () => await updateRuleProviderByName(name))
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
                {typeof rule.size === 'number' &&
                  rule.size !== -1 &&
                  ` (${rule.size})`}
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
            <Button
              class="btn-circle btn-ghost btn-sm ml-2"
              onClick={(e) => onUpdateAllProviderClick(e)}
            >
              <IconReload
                class={twMerge(allProviderIsUpdating() && 'animate-spin')}
              />
            </Button>
          </h1>

          <For each={rulesProviders()}>
            {(rulesProvider) => (
              <div class="card card-bordered card-compact mb-2 bg-base-200 p-4">
                <div class="flex h-6 items-center justify-between">
                  <span>
                    {rulesProvider.name} ({rulesProvider.ruleCount})
                  </span>
                  <div>
                    <Button
                      class="btn-circle btn-sm mr-2"
                      onClick={(e) =>
                        onUpdateProviderClick(e, rulesProvider.name)
                      }
                    >
                      <IconReload
                        class={twMerge(
                          updateingMap()[rulesProvider.name] && 'animate-spin',
                        )}
                      />
                    </Button>
                  </div>
                </div>
                <div class="text-xs text-slate-500">
                  {rulesProvider.vehicleType} / {rulesProvider.behavior} /
                  {t('updated')} {formatTimeFromNow(rulesProvider.updatedAt)}
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
