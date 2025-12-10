import type { Rule, RuleProvider } from '~/types'
import { defineStore } from 'pinia'
import {
  fetchRuleProvidersAPI,
  fetchRulesAPI,
  updateRuleProviderAPI,
} from '~/composables/useApi'

export const useRulesStore = defineStore('rules', () => {
  // State
  const rules = ref<Rule[]>([])
  const ruleProviders = ref<RuleProvider[]>([])

  // Actions
  const updateRules = async () => {
    const [{ rules: rulesData }, { providers }] = await Promise.all([
      fetchRulesAPI(),
      fetchRuleProvidersAPI(),
    ])

    rules.value = Object.values(rulesData)
    ruleProviders.value = Object.values(providers)
  }

  const updateAllRuleProvider = async () => {
    await Promise.all(
      ruleProviders.value.map((provider) =>
        updateRuleProviderAPI(provider.name),
      ),
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
})
