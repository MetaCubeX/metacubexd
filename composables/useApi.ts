import type {
  BackendVersion,
  Config,
  Proxy,
  ProxyProvider,
  ReleaseInfo,
  Rule,
  RuleProvider,
} from '~/types'
import ky from 'ky'

// Mock mode support
export function useMockMode() {
  return import.meta.env.VITE_MOCK_MODE === 'true'
}

export function useRequest() {
  const endpointStore = useEndpointStore()
  const endpoint = endpointStore.currentEndpoint

  if (useMockMode()) {
    // In mock mode, return a mock handler
    const mockHandler = async <T>(_url: string): Promise<T> => {
      return {} as T
    }

    return {
      get: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      post: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      put: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      patch: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      delete: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
    }
  }

  if (!endpoint) {
    return ky.create({})
  }

  const headers = new Headers()

  if (endpoint.secret) {
    headers.set('Authorization', `Bearer ${endpoint.secret}`)
  }

  return ky.create({
    prefixUrl: endpoint.url,
    headers,
  })
}

export function useGithubAPI() {
  const headers = new Headers()

  if (import.meta.env.VITE_APP_GH_TOKEN) {
    headers.set('Authorization', `Bearer ${import.meta.env.VITE_APP_GH_TOKEN}`)
  }

  return ky.create({
    prefixUrl: 'https://api.github.com',
    headers,
  })
}

// API Functions
export function checkEndpointAPI(url: string, secret: string) {
  return ky
    .get(url.endsWith('/') ? `${url}version` : `${url}/version`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    })
    .then(({ ok }) => ok)
    .catch((err) => {
      console.error(err)

      return false
    })
}

export function closeAllConnectionsAPI() {
  const request = useRequest()

  return request.delete('connections')
}

export function closeSingleConnectionAPI(id: string) {
  const request = useRequest()

  return request.delete(`connections/${id}`)
}

export function fetchBackendConfigAPI() {
  const request = useRequest()

  return request.get('configs').json<Config>()
}

export async function updateBackendConfigAPI(
  key: keyof Config,
  value: Partial<Config[keyof Config]>,
) {
  const request = useRequest()
  await request.patch('configs', { json: { [key]: value } }).json<Config>()
}

export async function fetchBackendVersionAPI() {
  const request = useRequest()
  const { version } = await request.get('version').json<BackendVersion>()

  return version
}

export function fetchProxyProvidersAPI() {
  const request = useRequest()

  return request
    .get('providers/proxies')
    .json<{ providers: Record<string, ProxyProvider> }>()
}

export function fetchProxiesAPI() {
  const request = useRequest()

  return request.get('proxies').json<{ proxies: Record<string, Proxy> }>()
}

export function updateProxyProviderAPI(providerName: string) {
  const request = useRequest()

  return request.put(`providers/proxies/${encodeURIComponent(providerName)}`)
}

export function proxyProviderHealthCheckAPI(providerName: string) {
  const request = useRequest()

  return request
    .get(`providers/proxies/${encodeURIComponent(providerName)}/healthcheck`, {
      timeout: 20 * 1000,
    })
    .json<Record<string, number>>()
}

export function selectProxyInGroupAPI(groupName: string, proxyName: string) {
  const request = useRequest()

  return request.put(`proxies/${encodeURIComponent(groupName)}`, {
    body: JSON.stringify({ name: proxyName }),
  })
}

export function proxyLatencyTestAPI(
  proxyName: string,
  provider: string,
  url: string,
  timeout: number,
) {
  const request = useRequest()

  if (provider !== '') {
    return proxyProviderHealthCheckAPI(provider).then((latencyMap) => ({
      delay: latencyMap[proxyName],
    }))
  }

  return request
    .get(`proxies/${encodeURIComponent(proxyName)}/delay`, {
      searchParams: { url, timeout },
    })
    .json<{ delay: number }>()
}

export function proxyGroupLatencyTestAPI(
  groupName: string,
  url: string,
  timeout: number,
) {
  const request = useRequest()

  return request
    .get(`group/${encodeURIComponent(groupName)}/delay`, {
      searchParams: { url, timeout },
    })
    .json<Record<string, number>>()
}

export function fetchRulesAPI() {
  const request = useRequest()

  return request.get('rules').json<{ rules: Record<string, Rule> }>()
}

export function fetchRuleProvidersAPI() {
  const request = useRequest()

  return request
    .get('providers/rules')
    .json<{ providers: Record<string, RuleProvider> }>()
}

export function updateRuleProviderAPI(providerName: string) {
  const request = useRequest()

  return request.put(`providers/rules/${encodeURIComponent(providerName)}`)
}

// Config Actions with loading states
export function useConfigActions() {
  const reloadingConfigFile = ref(false)
  const updatingGEODatabases = ref(false)
  const flushingFakeIPData = ref(false)
  const flushingDNSCache = ref(false)
  const upgradingBackend = ref(false)
  const upgradingUI = ref(false)
  const restartingBackend = ref(false)

  const reloadConfigFileAPI = async () => {
    const request = useRequest()
    reloadingConfigFile.value = true
    try {
      await request.put('configs', {
        searchParams: { force: true },
        json: { path: '', payload: '' },
      })
    } catch {
      /* empty */
    }
    reloadingConfigFile.value = false
  }

  const flushFakeIPDataAPI = async () => {
    const request = useRequest()
    flushingFakeIPData.value = true
    try {
      await request.post('cache/fakeip/flush')
    } catch {
      /* empty */
    }
    flushingFakeIPData.value = false
  }

  const flushDNSCacheAPI = async () => {
    const request = useRequest()
    flushingDNSCache.value = true
    try {
      await request.post('cache/dns/flush')
    } catch {
      /* empty */
    }
    flushingDNSCache.value = false
  }

  const updateGEODatabasesAPI = async () => {
    const request = useRequest()
    updatingGEODatabases.value = true
    try {
      await request.post('configs/geo')
    } catch {
      /* empty */
    }
    updatingGEODatabases.value = false
  }

  const upgradeBackendAPI = async () => {
    const request = useRequest()
    upgradingBackend.value = true
    try {
      await request.post('upgrade')
    } catch {
      /* empty */
    }
    upgradingBackend.value = false
  }

  const upgradeUIAPI = async () => {
    const request = useRequest()
    upgradingUI.value = true
    try {
      await request.post('upgrade/ui')
    } catch {
      /* empty */
    }
    upgradingUI.value = false
  }

  const restartBackendAPI = async () => {
    const request = useRequest()
    restartingBackend.value = true
    try {
      await request.post('restart')
    } catch {
      /* empty */
    }
    restartingBackend.value = false
  }

  return {
    reloadingConfigFile,
    updatingGEODatabases,
    flushingFakeIPData,
    flushingDNSCache,
    upgradingBackend,
    upgradingUI,
    restartingBackend,
    reloadConfigFileAPI,
    flushFakeIPDataAPI,
    flushDNSCacheAPI,
    updateGEODatabasesAPI,
    upgradeBackendAPI,
    upgradeUIAPI,
    restartBackendAPI,
  }
}

// Release API
interface ReleaseAPIResponse {
  tag_name: string
  body: string
  assets: { name: string }[]
  published_at: string
}

export async function frontendReleaseAPI(currentVersion: string) {
  const githubAPI = useGithubAPI()
  const { tag_name, body } = await githubAPI
    .get(`repos/MetaCubeX/metacubexd/releases/latest`)
    .json<ReleaseAPIResponse>()

  return {
    isUpdateAvailable: tag_name !== currentVersion,
    changelog: body,
  }
}

export async function backendReleaseAPI(currentVersion: string) {
  const githubAPI = useGithubAPI()
  const repositoryURL = 'repos/MetaCubeX/mihomo'
  const match = /(alpha|beta|meta)-?(\w+)/.exec(currentVersion)

  if (!match) return { isUpdateAvailable: false }

  const release = async (url: string) => {
    const { assets, body } = await githubAPI
      .get(`${repositoryURL}/${url}`)
      .json<ReleaseAPIResponse>()

    const alreadyLatest = assets.some(({ name }) => name.includes(match[2]))

    return {
      isUpdateAvailable: !alreadyLatest,
      changelog: body,
    }
  }

  const channel = match[1]

  if (channel === 'meta') return await release('releases/latest')

  if (channel === 'alpha')
    return await release('releases/tags/Prerelease-Alpha')

  return { isUpdateAvailable: false }
}

export async function fetchFrontendReleasesAPI(
  currentVersion: string,
  count: number = 10,
): Promise<ReleaseInfo[]> {
  const githubAPI = useGithubAPI()
  const releases = await githubAPI
    .get(`repos/MetaCubeX/metacubexd/releases`, {
      searchParams: { per_page: count },
    })
    .json<ReleaseAPIResponse[]>()

  return releases.map((release) => ({
    version: release.tag_name,
    changelog: release.body,
    publishedAt: release.published_at,
    isCurrent: release.tag_name === currentVersion,
  }))
}

export async function fetchBackendReleasesAPI(
  currentVersion: string,
  count: number = 10,
): Promise<ReleaseInfo[]> {
  const githubAPI = useGithubAPI()
  const repositoryURL = 'repos/MetaCubeX/mihomo'
  const match = /(alpha|beta|meta)-?(\w+)/.exec(currentVersion)

  if (!match) return []

  const channel = match[1]
  let releases: ReleaseAPIResponse[] = []

  if (channel === 'meta') {
    releases = await githubAPI
      .get(`${repositoryURL}/releases`, { searchParams: { per_page: count } })
      .json<ReleaseAPIResponse[]>()
    releases = releases.filter(
      (r) =>
        !r.tag_name.includes('Alpha') && !r.tag_name.includes('Prerelease'),
    )
  } else if (channel === 'alpha') {
    releases = await githubAPI
      .get(`${repositoryURL}/releases`, {
        searchParams: { per_page: count * 2 },
      })
      .json<ReleaseAPIResponse[]>()
    releases = releases
      .filter(
        (r) =>
          r.tag_name.includes('Alpha') || r.tag_name.includes('Prerelease'),
      )
      .slice(0, count)
  }

  return releases.map((release) => ({
    version: release.tag_name,
    changelog: release.body,
    publishedAt: release.published_at,
    isCurrent:
      release.assets?.some(({ name }) => name.includes(match[2])) ?? false,
  }))
}
