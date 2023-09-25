import ky from 'ky'
import { ResourceActions, createSignal } from 'solid-js'
import { toast } from 'solid-toast'
import { useRequest } from '~/signals'
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

export const [reloadingConfigFile, setReloadingConfigFile] = createSignal(false)
export const [updatingGEODatabases, setUpdatingGEODatabases] =
  createSignal(false)
export const [flushingFakeIPData, setFlushingFakeIPData] = createSignal(false)
export const [upgradingBackend, setUpgradingBackend] = createSignal(false)
export const [restartingBackend, setRestartingBackend] = createSignal(false)

export const reloadConfigFileAPI = async () => {
  const request = useRequest()
  setReloadingConfigFile(true)
  try {
    await request.put('configs', {
      searchParams: { force: true },
      json: { path: '', payload: '' },
    })
  } catch {}
  setReloadingConfigFile(false)
}

export const flushFakeIPDataAPI = async () => {
  const request = useRequest()
  setFlushingFakeIPData(true)
  try {
    await request.post('cache/fakeip/flush')
  } catch {}
  setFlushingFakeIPData(false)
}

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
  value: Partial<Config[keyof Config]>,
  refetch: ResourceActions<Config | undefined>['refetch'],
) => {
  try {
    const request = useRequest()

    await request.patch('configs', { json: { [key]: value } }).json<Config>()

    await refetch()
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

export const proxyProviderHealthCheckAPI = (providerName: string) => {
  const request = useRequest()

  return request
    .get(`providers/proxies/${providerName}/healthcheck`, {
      timeout: 5 * 1000,
    })
    .json<Record<string, number>>()
}

export const selectProxyInGroupAPI = (groupName: string, proxyName: string) => {
  const request = useRequest()

  return request.put(`proxies/${groupName}`, {
    body: JSON.stringify({
      name: proxyName,
    }),
  })
}

export const proxyLatencyTestAPI = (
  proxyName: string,
  provider: string,
  url: string,
  timeout: number,
) => {
  const request = useRequest()

  if (provider !== '') {
    return proxyProviderHealthCheckAPI(provider).then((latencyMap) => ({
      delay: latencyMap[proxyName],
    }))
  }

  return request
    .get(`proxies/${proxyName}/delay`, {
      searchParams: {
        url,
        timeout,
      },
    })
    .json<{ delay: number }>()
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

export const isUpdateAvailableAPI = async (versionResponse: string) => {
  const match = /(alpha|beta|meta)-?(\w+)/.exec(versionResponse)

  if (!match) {
    return false
  }

  const channel = match[1],
    version = match[2]

  if (channel === 'meta') {
    const { assets } = await ky
      .get('https://api.github.com/repos/MetaCubeX/Clash.Meta/releases/latest')
      .json<{
        assets: {
          name: string
        }[]
      }>()

    const alreadyLatest = assets.some(({ name }) => name.includes(version))

    return !alreadyLatest
  }

  if (channel === 'alpha') {
    const { assets } = await ky
      .get(
        'https://api.github.com/repos/MetaCubeX/Clash.Meta/releases/tags/Prerelease-Alpha',
      )
      .json<{
        assets: {
          name: string
        }[]
      }>()

    const alreadyLatest = assets.some(({ name }) => name.includes(version))

    return !alreadyLatest
  }

  return false
}
