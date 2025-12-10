import type { Config, Proxy, ProxyProvider, Rule, RuleProvider } from '~/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { useRequest } from './useApi'

// ============== Request Helpers ==============

function createRequest() {
  return useRequest()
}

// ============== Query Keys ==============

export const queryKeys = {
  proxies: ['proxies'] as const,
  proxyProviders: ['proxy-providers'] as const,
  rules: ['rules'] as const,
  ruleProviders: ['rule-providers'] as const,
  config: ['config'] as const,
  version: ['version'] as const,
}

// ============== Proxies ==============

export function useProxiesQuery() {
  return useQuery({
    queryKey: queryKeys.proxies,
    queryFn: async () => {
      const request = createRequest()
      const { proxies } = await request
        .get('proxies')
        .json<{ proxies: Record<string, Proxy> }>()
      return proxies
    },
  })
}

export function useProxyProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.proxyProviders,
    queryFn: async () => {
      const request = createRequest()
      const { providers } = await request
        .get('providers/proxies')
        .json<{ providers: Record<string, ProxyProvider> }>()
      return providers
    },
  })
}

export function useSelectProxyMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupName,
      proxyName,
    }: {
      groupName: string
      proxyName: string
    }) => {
      const request = createRequest()
      await request.put(`proxies/${encodeURIComponent(groupName)}`, {
        body: JSON.stringify({ name: proxyName }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
    },
  })
}

export function useProxyLatencyTestMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      proxyName,
      url,
      timeout,
    }: {
      proxyName: string
      url: string
      timeout: number
    }) => {
      const request = createRequest()
      const result = await request
        .get(`proxies/${encodeURIComponent(proxyName)}/delay`, {
          searchParams: { url, timeout },
        })
        .json<{ delay: number }>()
      return { proxyName, delay: result.delay }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
    },
  })
}

export function useProxyGroupLatencyTestMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      groupName,
      url,
      timeout,
    }: {
      groupName: string
      url: string
      timeout: number
    }) => {
      const request = createRequest()
      const result = await request
        .get(`group/${encodeURIComponent(groupName)}/delay`, {
          searchParams: { url, timeout },
        })
        .json<Record<string, number>>()
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
    },
  })
}

export function useUpdateProxyProviderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (providerName: string) => {
      const request = createRequest()
      await request.put(`providers/proxies/${encodeURIComponent(providerName)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
      queryClient.invalidateQueries({ queryKey: queryKeys.proxyProviders })
    },
  })
}

export function useProxyProviderHealthCheckMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (providerName: string) => {
      const request = createRequest()
      const result = await request
        .get(
          `providers/proxies/${encodeURIComponent(providerName)}/healthcheck`,
          { timeout: 20 * 1000 },
        )
        .json<Record<string, number>>()
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
      queryClient.invalidateQueries({ queryKey: queryKeys.proxyProviders })
    },
  })
}

// ============== Rules ==============

export function useRulesQuery() {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: async () => {
      const request = createRequest()
      const { rules } = await request
        .get('rules')
        .json<{ rules: Record<string, Rule> }>()
      return Object.values(rules)
    },
  })
}

export function useRuleProvidersQuery() {
  return useQuery({
    queryKey: queryKeys.ruleProviders,
    queryFn: async () => {
      const request = createRequest()
      const { providers } = await request
        .get('providers/rules')
        .json<{ providers: Record<string, RuleProvider> }>()
      return Object.values(providers)
    },
  })
}

export function useUpdateRuleProviderMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (providerName: string) => {
      const request = createRequest()
      await request.put(`providers/rules/${encodeURIComponent(providerName)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules })
      queryClient.invalidateQueries({ queryKey: queryKeys.ruleProviders })
    },
  })
}

// ============== Config ==============

export function useConfigQuery() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: async () => {
      const request = createRequest()
      return request.get('configs').json<Config>()
    },
  })
}

export function useUpdateConfigMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: keyof Config
      value: Partial<Config[keyof Config]>
    }) => {
      const request = createRequest()
      await request.patch('configs', { json: { [key]: value } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config })
    },
  })
}

// ============== Version ==============

export function useVersionQuery() {
  return useQuery({
    queryKey: queryKeys.version,
    queryFn: async () => {
      const request = createRequest()
      const { version } = await request
        .get('version')
        .json<{ version: string }>()
      return version
    },
  })
}

// ============== Connections ==============

export function useCloseConnectionMutation() {
  return useMutation({
    mutationFn: async (id: string) => {
      const request = createRequest()
      await request.delete(`connections/${id}`)
    },
  })
}

export function useCloseAllConnectionsMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.delete('connections')
    },
  })
}

// ============== Config Actions ==============

export function useReloadConfigMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.put('configs', {
        searchParams: { force: true },
        json: { path: '', payload: '' },
      })
    },
  })
}

export function useFlushFakeIPMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('cache/fakeip/flush')
    },
  })
}

export function useFlushDNSCacheMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('cache/dns/flush')
    },
  })
}

export function useUpdateGEOMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('configs/geo')
    },
  })
}

export function useUpgradeBackendMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('upgrade')
    },
  })
}

export function useUpgradeUIMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('upgrade/ui')
    },
  })
}

export function useRestartBackendMutation() {
  return useMutation({
    mutationFn: async () => {
      const request = createRequest()
      await request.post('restart')
    },
  })
}
