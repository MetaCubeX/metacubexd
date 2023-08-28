import { For, createSignal, onMount } from 'solid-js'
import { useRequest } from '~/signals'
import type { Rule, RuleProvider } from '~/types'

export const Rules = () => {
  const request = useRequest()
  const [rules, setRules] = createSignal<Rule[]>([])
  const [rulesProviders, setRulesProviders] = createSignal<RuleProvider[]>([])

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
        <h1 class="pb-4 text-lg font-semibold">Rules</h1>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <For each={rules()}>
            {(rule) => (
              <div class="card card-bordered card-compact border-secondary p-4">
                <div>{rule.payload}</div>
                <div>
                  {rule.type}: {rule.proxy}
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div>
        <h1 class="pb-4 text-lg font-semibold">Rules Providers</h1>

        <div class="grid grid-cols-2 gap-2 sm:grid-cols-1">
          <For each={rulesProviders()}>
            {(rulesProvider) => (
              <div class="card card-bordered card-compact border-secondary p-4">
                <div>{rulesProvider.name}</div>
                <div>
                  {rulesProvider.vehicleType}: {rulesProvider.behavior} (
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
