import { createSignal } from 'solid-js'
import { toast } from 'solid-toast'
import { setBackendConfig, useRequest } from '~/signals'
import {
  BackendVersion,
  Config,
  Proxy,
  ProxyProvider,
  Rule,
  RuleProvider,
} from '~/types'

export const closeAllConnectionsAPI = () => {
  const request = useRequest()

  return request.delete('connections')
}

export const closeSingleConnectionAPI = (id: string) => {
  const request = useRequest()

  return request.delete(`connections/${id}`)
}

export const [updatingGEODatabases, setUpdatingGEODatabases] =
  createSignal(false)
export const [upgradingBackend, setUpgradingBackend] = createSignal(false)
export const [restartingBackend, setRestartingBackend] = createSignal(false)

export const updateGEODatabasesAPI = async () => {
  const request = useRequest()
  setUpdatingGEODatabases(true)
  try {
    await request.post('configs/geo')
  } catch {}
  setUpdatingGEODatabases(false)
}

export const upgradeBackendAPI = async () => {
  const request = useRequest()
  setUpgradingBackend(true)
  try {
    await request.post('upgrade')
  } catch {}
  setUpgradingBackend(false)
}

export const flushFakeIP = async () => {
  const request = useRequest()
  setUpgradingBackend(true)
  try {
    await request.post('cache/fakeip/flush')
  } catch {}
  setUpgradingBackend(false)
}

export const restartBackendAPI = async () => {
  const request = useRequest()
  setRestartingBackend(true)
  try {
    await request.post('restart')
  } catch {}
  setRestartingBackend(false)
}

export const fetchBackendConfigAPI = () => {
  const request = useRequest()

  return request.get('configs').json<Config>()
}

export const updateBackendConfigAPI = async (
  key: keyof Config,
  value: Config[keyof Config],
) => {
  try {
    const request = useRequest()

    await request
      .patch('configs', {
        body: JSON.stringify({
          [key]: value,
        }),
      })
      .json<Config>()

    const updatedConfig = await fetchBackendConfigAPI()

    setBackendConfig(updatedConfig)
  } catch (err) {
    toast.error((err as Error).message)
  }
}

export const fetchBackendVersionAPI = async () => {
  const request = useRequest()

  const { version } = await request.get('version').json<BackendVersion>()

  return version
}

export const fetchProxyProvidersAPI = () => {
  const request = useRequest()

  return request
    .get('providers/proxies')
    .json<{ providers: Record<string, ProxyProvider> }>()
}

export const fetchProxiesAPI = () => {
  const request = useRequest()

  return request.get('proxies').json<{ proxies: Record<string, Proxy> }>()
}

export const updateProxyProviderAPI = (providerName: string) => {
  const request = useRequest()

  return request.put(`providers/proxies/${providerName}`)
}

export const proxyProviderHealthCheck = (providerName: string) => {
  const request = useRequest()

  return request.get(`providers/proxies/${providerName}/healthcheck`, {
    timeout: 20 * 1000,
  })
}

export const selectProxyInGroupAPI = (groupName: string, proxyName: string) => {
  const request = useRequest()

  return request.put(`proxies/${groupName}`, {
    body: JSON.stringify({
      name: proxyName,
    }),
  })
}

export const proxyGroupLatencyTestAPI = (
  groupName: string,
  url: string,
  timeout: number,
) => {
  const request = useRequest()

  return request
    .get(`group/${groupName}/delay`, {
      searchParams: {
        url,
        timeout,
      },
    })
    .json<Record<string, number>>()
}

export const fetchRulesAPI = () => {
  const request = useRequest()

  return request.get('rules').json<{ rules: Record<string, Rule> }>()
}

export const fetchRuleProvidersAPI = () => {
  const request = useRequest()

  return request
    .get('providers/rules')
    .json<{ providers: Record<string, RuleProvider> }>()
}

export const updateRuleProviderAPI = (providerName: string) => {
  const request = useRequest()

  return request.put(`providers/rules/${providerName}`)
}
