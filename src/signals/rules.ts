import {
  fetchRuleProvidersAPI,
  fetchRulesAPI,
  updateRuleProviderAPI,
} from '~/apis'
import type { Rule, RuleProvider } from '~/types'

export const useRules = () => {
  const [rules, setRules] = createSignal<Rule[]>([])
  const [ruleProviders, setRuleProviders] = createSignal<RuleProvider[]>([])

  const updateRules = async () => {
    const [{ rules }, { providers }] = await Promise.all([
      fetchRulesAPI(),
      fetchRuleProvidersAPI(),
    ])

    setRules(Object.values(rules))
    setRuleProviders(Object.values(providers))
  }

  const updateAllRuleProvider = async () => {
    await Promise.all(
      ruleProviders().map((provider) => updateRuleProviderAPI(provider.name)),
    )
    await updateRules()
  }

  const updateRuleProviderByName = async (providerName: string) => {
    await updateRuleProviderAPI(providerName)
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
