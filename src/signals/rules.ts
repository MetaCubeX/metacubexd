import { createSignal } from 'solid-js'
import { useRequest } from '~/signals'
import type { Rule, RuleProvider } from '~/types'

const request = useRequest()

export const useRules = () => {
  const [rules, setRules] = createSignal<Rule[]>([])
  const [rulesProviders, setRulesProviders] = createSignal<RuleProvider[]>([])

  const updateRules = async () => {
    const [{ rules }, { providers }] = await Promise.all([
      request.get('rules').json<{ rules: Record<string, Rule> }>(),
      request
        .get('providers/rules')
        .json<{ providers: Record<string, RuleProvider> }>(),
    ])

    setRules(Object.values(rules))
    setRulesProviders(Object.values(providers))
  }

  const updateAllRuleProvider = async () => {
    await Promise.all(
      rulesProviders().map((provider) => {
        return request.put(`providers/rules/${provider.name}`)
      }),
    )
    await updateRules()
  }

  const updateRuleProviderByName = async (name: string) => {
    await request.put(`providers/rules/${name}`)
    await updateRules()
  }

  return {
    rules,
    rulesProviders,
    updateRules,
    updateAllRuleProvider,
    updateRuleProviderByName,
  }
}
