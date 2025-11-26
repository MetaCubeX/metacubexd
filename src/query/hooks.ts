import { useMutation, useQuery, useQueryClient } from '@tanstack/solid-query'
import { toast } from 'solid-toast'
import {
  backendReleaseAPI,
  fetchBackendConfigAPI,
  fetchBackendReleasesAPI,
  fetchBackendVersionAPI,
  fetchFrontendReleasesAPI,
  fetchProxiesAPI,
  fetchProxyProvidersAPI,
  fetchRuleProvidersAPI,
  fetchRulesAPI,
  frontendReleaseAPI,
  proxyGroupLatencyTestAPI,
  proxyLatencyTestAPI,
  proxyProviderHealthCheckAPI,
  selectProxyInGroupAPI,
  updateProxyProviderAPI,
  updateRuleProviderAPI,
} from '~/apis'
import { queryKeys } from '~/query'
import { useRequest } from '~/signals'
import { Config } from '~/types'

// Backend config query
export const useBackendConfig = () => {
  return useQuery(() => ({
    queryKey: queryKeys.backendConfig,
    queryFn: fetchBackendConfigAPI,
  }))
}

// Backend version query
export const useBackendVersion = () => {
  return useQuery(() => ({
    queryKey: queryKeys.backendVersion,
    queryFn: fetchBackendVersionAPI,
  }))
}

// Proxies query
export const useProxiesQuery = () => {
  return useQuery(() => ({
    queryKey: queryKeys.proxies,
    queryFn: fetchProxiesAPI,
  }))
}

// Proxy providers query
export const useProxyProvidersQuery = () => {
  return useQuery(() => ({
    queryKey: queryKeys.proxyProviders,
    queryFn: fetchProxyProvidersAPI,
  }))
}

// Rules query
export const useRulesQuery = () => {
  return useQuery(() => ({
    queryKey: queryKeys.rules,
    queryFn: fetchRulesAPI,
  }))
}

// Rule providers query
export const useRuleProvidersQuery = () => {
  return useQuery(() => ({
    queryKey: queryKeys.ruleProviders,
    queryFn: fetchRuleProvidersAPI,
  }))
}

// Frontend release query
export const useFrontendRelease = (version: string) => {
  return useQuery(() => ({
    queryKey: queryKeys.frontendRelease(version),
    queryFn: () => frontendReleaseAPI(version),
    staleTime: 10 * 60 * 1000, // Check for updates every 10 minutes
    refetchOnWindowFocus: false,
  }))
}

// Backend release query
export const useBackendRelease = (version: () => string) => {
  return useQuery(() => ({
    queryKey: queryKeys.backendRelease(version()),
    queryFn: () => backendReleaseAPI(version()),
    enabled: !!version(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  }))
}

// Frontend releases list query (for changelog timeline)
export const useFrontendReleases = (version: string, count: number = 10) => {
  return useQuery(() => ({
    queryKey: queryKeys.frontendReleases(version),
    queryFn: () => fetchFrontendReleasesAPI(version, count),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  }))
}

// Backend releases list query (for changelog timeline)
export const useBackendReleases = (
  version: () => string,
  count: number = 10,
) => {
  return useQuery(() => ({
    queryKey: queryKeys.backendReleases(version()),
    queryFn: () => fetchBackendReleasesAPI(version(), count),
    enabled: !!version(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  }))
}

// Update backend config mutation
export const useUpdateBackendConfig = () => {
  const queryClient = useQueryClient()

  return useMutation(() => ({
    mutationFn: async ({
      key,
      value,
    }: {
      key: keyof Config
      value: Partial<Config[keyof Config]>
    }) => {
      const request = useRequest()
      await request.patch('configs', { json: { [key]: value } }).json<Config>()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.backendConfig,
      })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  }))
}

// Update proxy provider mutation
export const useUpdateProxyProvider = () => {
  const queryClient = useQueryClient()

  return useMutation(() => ({
    mutationFn: (providerName: string) => updateProxyProviderAPI(providerName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.proxyProviders,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  }))
}

// Select proxy in group mutation
export const useSelectProxyInGroup = () => {
  const queryClient = useQueryClient()

  return useMutation(() => ({
    mutationFn: ({
      groupName,
      proxyName,
    }: {
      groupName: string
      proxyName: string
    }) => selectProxyInGroupAPI(groupName, proxyName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.proxies })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  }))
}

// Proxy latency test mutation
export const useProxyLatencyTest = () => {
  return useMutation(() => ({
    mutationFn: ({
      proxyName,
      provider,
      url,
      timeout,
    }: {
      proxyName: string
      provider: string
      url: string
      timeout: number
    }) => proxyLatencyTestAPI(proxyName, provider, url, timeout),
  }))
}

// Proxy group latency test mutation
export const useProxyGroupLatencyTest = () => {
  return useMutation(() => ({
    mutationFn: ({
      groupName,
      url,
      timeout,
    }: {
      groupName: string
      url: string
      timeout: number
    }) => proxyGroupLatencyTestAPI(groupName, url, timeout),
  }))
}

// Proxy provider health check mutation
export const useProxyProviderHealthCheck = () => {
  return useMutation(() => ({
    mutationFn: (providerName: string) =>
      proxyProviderHealthCheckAPI(providerName),
  }))
}

// Update rule provider mutation
export const useUpdateRuleProvider = () => {
  const queryClient = useQueryClient()

  return useMutation(() => ({
    mutationFn: (providerName: string) => updateRuleProviderAPI(providerName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.ruleProviders })
      await queryClient.invalidateQueries({ queryKey: queryKeys.rules })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  }))
}
