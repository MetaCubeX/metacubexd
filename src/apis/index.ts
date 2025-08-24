import ky from 'ky'
import { ResourceActions, createSignal } from 'solid-js'
import { toast } from 'solid-toast'
import { useGithubAPI, useRequest } from '~/signals'
import {
  BackendVersion,
  Config,
  Proxy,
  ProxyProvider,
  Rule,
  RuleProvider,
} from '~/types'

export const checkEndpointAPI = (url: string, secret: string) =>
  ky
    .get(url.endsWith('/') ? `${url}version` : `${url}/version`, {
      headers: secret
        ? {
            Authorization: `Bearer ${secret}`,
          }
        : {},
    })
    .then(({ ok }) => ok)
    .catch((err) => {
      const { message } = err as Error

      toast.error(message)
    })

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
export const [upgradingUI, setUpgradingUI] = createSignal(false)
export const [restartingBackend, setRestartingBackend] = createSignal(false)

export const reloadConfigFileAPI = async () => {
  const request = useRequest()
  setReloadingConfigFile(true)
  try {
    await request.put('configs', {
      searchParams: { force: true },
      json: { path: '', payload: '' },
    })
  } catch {
    /* empty */
  }
  setReloadingConfigFile(false)
}

export const flushFakeIPDataAPI = async () => {
  const request = useRequest()
  setFlushingFakeIPData(true)
  try {
    await request.post('cache/fakeip/flush')
  } catch {
    /* empty */
  }
  setFlushingFakeIPData(false)
}

export const updateGEODatabasesAPI = async () => {
  const request = useRequest()
  setUpdatingGEODatabases(true)
  try {
    await request.post('configs/geo')
  } catch {
    /* empty */
  }
  setUpdatingGEODatabases(false)
}

export const upgradeBackendAPI = async () => {
  const request = useRequest()
  setUpgradingBackend(true)
  try {
    await request.post('upgrade')
  } catch {
    /* empty */
  }
  setUpgradingBackend(false)
}

export const upgradeUIAPI = async () => {
  const request = useRequest()
  setUpgradingUI(true)
  try {
    await request.post('upgrade/ui')
  } catch {
    /* empty */
  }
  setUpgradingUI(false)
}

export const restartBackendAPI = async () => {
  const request = useRequest()
  setRestartingBackend(true)
  try {
    await request.post('restart')
  } catch {
    /* empty */
  }
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

  return request.put(`providers/proxies/${encodeURIComponent(providerName)}`)
}

export const proxyProviderHealthCheckAPI = (providerName: string) => {
  const request = useRequest()

  return request
    .get(`providers/proxies/${encodeURIComponent(providerName)}/healthcheck`, {
      timeout: 20 * 1000,
    })
    .json<Record<string, number>>()
}

export const selectProxyInGroupAPI = (groupName: string, proxyName: string) => {
  const request = useRequest()

  return request.put(`proxies/${encodeURIComponent(groupName)}`, {
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
    .get(`proxies/${encodeURIComponent(proxyName)}/delay`, {
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
    .get(`group/${encodeURIComponent(groupName)}/delay`, {
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

  return request.put(`providers/rules/${encodeURIComponent(providerName)}`)
}

type ReleaseAPIResponse = {
  tag_name: string
  body: string
  assets: { name: string }[]
}

type ReleaseReturn = {
  isUpdateAvailable: boolean
  changelog?: string
}

export const frontendReleaseAPI = async (
  currentVersion: string,
): Promise<ReleaseReturn> => {
  const githubAPI = useGithubAPI()

  const { tag_name, body } = await githubAPI
    .get(`repos/MetaCubeX/metacubexd/releases/latest`)
    .json<ReleaseAPIResponse>()

  return {
    isUpdateAvailable: tag_name !== currentVersion,
    changelog: body,
  }
}

export const backendReleaseAPI = async (
  currentVersion: string,
): Promise<ReleaseReturn> => {
  const githubAPI = useGithubAPI()

  const repositoryURL = 'repos/MetaCubeX/mihomo'
  const match = /(alpha|beta|meta)-?(\w+)/.exec(currentVersion)

  if (!match)
    return {
      isUpdateAvailable: false,
    }

  const release = async (url: string) => {
    const { assets, body } = await githubAPI
      .get(`${repositoryURL}/${url}`)
      .json<ReleaseAPIResponse>()

    const alreadyLatest = assets.some(({ name }) => name.includes(version))

    return {
      isUpdateAvailable: !alreadyLatest,
      changelog: body,
    }
  }

  const channel = match[1],
    version = match[2]

  if (channel === 'meta') return await release('releases/latest')

  if (channel === 'alpha')
    return await release('releases/tags/Prerelease-Alpha')

  return {
    isUpdateAvailable: false,
  }
}
