import { createSignal } from 'solid-js'
import { useRequest } from '~/signals'
import type { Rule, RuleProvider } from '~/types'

export const useRules = () => {
  const request = useRequest()
  const [rules, setRules] = createSignal<Rule[]>([])
  const [ruleProviders, setRuleProviders] = createSignal<RuleProvider[]>([])

  const updateRules = async () => {
    const [{ rules }, { providers }] = await Promise.all([
      request.get('rules').json<{ rules: Record<string, Rule> }>(),
      request
        .get('providers/rules')
        .json<{ providers: Record<string, RuleProvider> }>(),
    ])

    setRules(Object.values(rules))
    setRuleProviders(Object.values(providers))
  }

  const updateAllRuleProvider = async () => {
    await Promise.all(
      ruleProviders().map((provider) => {
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
    ruleProviders,
    updateRules,
    updateAllRuleProvider,
    updateRuleProviderByName,
  }
}
