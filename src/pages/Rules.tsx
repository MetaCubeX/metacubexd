import { useI18n } from '@solid-primitives/i18n'
import InfiniteScroll from 'solid-infinite-scroll'
import { For, createMemo, createSignal, onMount } from 'solid-js'
import { useRequest } from '~/signals'
import type { Rule, RuleProvider } from '~/types'

export default () => {
  const [t] = useI18n()
  const request = useRequest()
  const [maxRuleRender, setMaxRuleRender] = createSignal(100)
  const [rules, setRules] = createSignal<Rule[]>([])
  const [rulesProviders, setRulesProviders] = createSignal<RuleProvider[]>([])
  const renderRules = createMemo(() => rules().slice(0, maxRuleRender()))

  onMount(async () => {
    const { rules } = await request
      .get('rules')
      .json<{ rules: Record<string, Rule> }>()

    setRules(Object.values(rules))

    const { providers } = await request
      .get('providers/rules')
      .json<{ providers: Record<string, RuleProvider> }>()

    setRulesProviders(Object.values(providers))
  })

  return (
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="pb-4 text-lg font-semibold">{t('rules')}</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-1">
          <InfiniteScroll
            each={renderRules()}
            hasMore={renderRules().length < rules().length}
            next={() => setMaxRuleRender(maxRuleRender() + 100)}
          >
            {(rule) => (
              <div class="card card-bordered card-compact bg-base-200 p-4">
                <div class="break-all">{rule.payload}</div>
                <div class="text-xs text-slate-500">
                  {rule.type} :: {rule.proxy}
                </div>
              </div>
            )}
          </InfiniteScroll>
        </div>
      </div>

      <div>
        <h1 class="pb-4 text-lg font-semibold">{t('ruleProviders')}</h1>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-1">
          <For each={rulesProviders()}>
            {(rulesProvider) => (
              <div class="card card-bordered card-compact bg-base-200 p-4">
                <div>{rulesProvider.name}</div>
                <div class="text-xs text-slate-500">
                  {rulesProvider.vehicleType} :: {rulesProvider.behavior} (
                  {rulesProvider.ruleCount})
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
