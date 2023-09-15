import { useI18n } from '@solid-primitives/i18n'
import { IconReload } from '@tabler/icons-solidjs'
import { For, Show, createSignal, onMount } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from '~/components'
import { formatTimeFromNow, useStringBooleanMap } from '~/helpers'
import { useRules } from '~/signals'

enum ActiveTab {
  ruleProviders = 'ruleProviders',
  rules = 'rules',
}

export default () => {
  const [t] = useI18n()
  const {
    rules,
    ruleProviders,
    updateRules,
    updateAllRuleProvider,
    updateRuleProviderByName,
  } = useRules()

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

  const [activeTab, setActiveTab] = createSignal(ActiveTab.rules)

  const tabs = () => [
    {
      type: ActiveTab.rules,
      name: t('rules'),
      count: rules().length,
    },
    {
      type: ActiveTab.ruleProviders,
      name: t('ruleProviders'),
      count: ruleProviders().length,
    },
  ]

  return (
    <div class="flex h-full flex-col gap-2">
      <div class="flex items-center gap-2">
        <div class="tabs tabs-boxed gap-2">
          <For each={tabs()}>
            {(tab) => (
              <button
                class={twMerge(
                  activeTab() === tab.type && 'tab-active',
                  'tab tab-sm gap-2 px-2 md:tab-md',
                )}
                onClick={() => setActiveTab(tab.type)}
              >
                <span>{tab.name}</span>
                <div class="badge badge-sm">{tab.count}</div>
              </button>
            )}
          </For>
        </div>

        <Show when={activeTab() === ActiveTab.ruleProviders}>
          <Button
            class="btn btn-circle btn-sm"
            disabled={allProviderIsUpdating()}
            onClick={(e) => onUpdateAllProviderClick(e)}
          >
            <IconReload
              class={twMerge(
                allProviderIsUpdating() && 'animate-spin text-success',
              )}
            />
          </Button>
        </Show>
      </div>

      <div class="flex-1 overflow-y-auto">
        <Show when={activeTab() === ActiveTab.rules}>
          <div class="grid gap-2">
            <For each={rules()}>
              {(rule) => (
                <div class="card card-bordered card-compact bg-base-200 p-4">
                  <div class="flex items-center gap-2">
                    <span class="break-all">{rule.payload}</span>
                    <Show
                      when={typeof rule.size === 'number' && rule.size !== -1}
                    >
                      <div class="badge badge-sm">{rule.size}</div>
                    </Show>
                  </div>
                  <div class="text-xs text-slate-500">
                    {rule.type} :: {rule.proxy}
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={activeTab() === ActiveTab.ruleProviders}>
          <div class="grid gap-2">
            <For each={ruleProviders()}>
              {(ruleProvider) => (
                <div class="card card-bordered card-compact bg-base-200 p-4">
                  <div class="flex items-center gap-2 pr-8">
                    <span class="break-all">{ruleProvider.name}</span>
                    <div class="badge badge-sm">{ruleProvider.ruleCount}</div>
                  </div>

                  <div class="text-xs text-slate-500">
                    {ruleProvider.vehicleType} / {ruleProvider.behavior} /
                    {t('updated')} {formatTimeFromNow(ruleProvider.updatedAt)}
                  </div>

                  <Button
                    class="btn-circle btn-sm absolute right-2 top-2 mr-2 h-4"
                    disabled={updatingMap()[ruleProvider.name]}
                    onClick={(e) => onUpdateProviderClick(e, ruleProvider.name)}
                  >
                    <IconReload
                      class={twMerge(
                        updatingMap()[ruleProvider.name] &&
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
    </div>
  )
}
