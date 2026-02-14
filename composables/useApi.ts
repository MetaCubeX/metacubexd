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
import semver from 'semver'
import { useMockData } from './useMockData'

// Mock mode support
export function useMockMode() {
  const config = useRuntimeConfig()

  return config.public.mockMode === true
}

// Mock data resolver
function getMockData(url: string): unknown {
  // Lazy import to avoid bundling mock data in production
  const config = useRuntimeConfig()
  const mockData = config.public.mockMode === true ? useMockData() : null

  if (!mockData) return {}

  // Remove leading slash if present
  const path = url.startsWith('/') ? url.slice(1) : url

  // Map API endpoints to mock data
  if (path === 'version') return mockData.mockVersion
  if (path === 'configs') return mockData.mockConfig
  if (path === 'proxies') return { proxies: mockData.mockProxies }
  if (path === 'providers/proxies')
    return { providers: mockData.mockProxyProviders }
  // Convert rules array to object for API compatibility
  if (path === 'rules') {
    const rulesObj: Record<string, (typeof mockData.mockRules)[0]> = {}
    mockData.mockRules.forEach((rule, idx) => {
      rulesObj[`rule-${idx}`] = rule
    })

    return { rules: rulesObj }
  }
  if (path === 'providers/rules')
    return { providers: mockData.mockRuleProviders }
  if (path === 'connections')
    return {
      connections: mockData.mockConnections,
      downloadTotal: 850000000,
      uploadTotal: 125000000,
    }
  if (path === 'group') return { groups: {} }

  // Handle dynamic proxy endpoints
  if (path.startsWith('proxies/')) {
    const proxyName = decodeURIComponent(path.replace('proxies/', ''))

    return (mockData.mockProxies as Record<string, unknown>)[proxyName] || {}
  }

  if (path.startsWith('providers/proxies/')) {
    const providerName = decodeURIComponent(
      path.replace('providers/proxies/', ''),
    )

    return (
      (mockData.mockProxyProviders as Record<string, unknown>)[providerName] ||
      {}
    )
  }

  return {}
}

export function useRequest() {
  const endpointStore = useEndpointStore()
  const endpoint = endpointStore.currentEndpoint

  if (useMockMode()) {
    // In mock mode, return a mock handler
    const mockHandler = async <T>(url: string): Promise<T> => {
      return getMockData(url) as T
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
      delay: latencyMap[proxyName] ?? 0,
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

  const fetchingRemoteConfig = ref(false)
  const fetchRemoteConfigAPI = async (url: string) => {
    const request = useRequest()
    fetchingRemoteConfig.value = true
    try {
      // Fetch config content from remote URL
      const response = await ky.get(url)
      const payload = await response.text()

      // Update config with fetched payload
      await request.put('configs', {
        searchParams: { force: true },
        json: { path: '', payload },
      })
    } catch (error) {
      console.error('Failed to fetch remote config:', error)
      throw error
    } finally {
      fetchingRemoteConfig.value = false
    }
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
    fetchingRemoteConfig,
    reloadConfigFileAPI,
    flushFakeIPDataAPI,
    flushDNSCacheAPI,
    updateGEODatabasesAPI,
    upgradeBackendAPI,
    upgradeUIAPI,
    restartBackendAPI,
    fetchRemoteConfigAPI,
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
    isUpdateAvailable: semver.gt(
      semver.coerce(tag_name) || '0.0.0',
      semver.coerce(currentVersion) || '0.0.0',
    ),
    changelog: body,
  }
}

export async function backendReleaseAPI(currentVersion: string) {
  const githubAPI = useGithubAPI()
  const repositoryURL = 'repos/MetaCubeX/mihomo'
  const match = /(alpha|beta|meta)-?(\w+)/.exec(currentVersion)

  const releaseByAssets = async (url: string, versionSuffix: string) => {
    const { assets, body } = await githubAPI
      .get(`${repositoryURL}/${url}`)
      .json<ReleaseAPIResponse>()

    const alreadyLatest = assets.some(({ name }) =>
      name.includes(versionSuffix),
    )

    return {
      isUpdateAvailable: !alreadyLatest,
      changelog: body,
    }
  }

  if (match) {
    const versionSuffix = match[2] || ''
    const channel = match[1] || ''

    if (channel === 'meta')
      return await releaseByAssets('releases/latest', versionSuffix)

    if (channel === 'alpha')
      return await releaseByAssets(
        'releases/tags/Prerelease-Alpha',
        versionSuffix,
      )

    return { isUpdateAvailable: false }
  }

  // Stable version (e.g. "v1.19.9") - compare using semver
  const { tag_name, body } = await githubAPI
    .get(`${repositoryURL}/releases/latest`)
    .json<ReleaseAPIResponse>()

  return {
    isUpdateAvailable: semver.gt(
      semver.coerce(tag_name) || '0.0.0',
      semver.coerce(currentVersion) || '0.0.0',
    ),
    changelog: body,
  }
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

  if (!match) {
    // Stable version (e.g. "v1.19.9") - fetch stable releases
    let releases = await githubAPI
      .get(`${repositoryURL}/releases`, {
        searchParams: { per_page: count },
      })
      .json<ReleaseAPIResponse[]>()
    releases = releases.filter(
      (r) =>
        !r.tag_name.includes('Alpha') && !r.tag_name.includes('Prerelease'),
    )

    return releases.map((release) => ({
      version: release.tag_name,
      changelog: release.body,
      publishedAt: release.published_at,
      isCurrent: release.tag_name === currentVersion,
    }))
  }

  const channel = match[1] || ''
  const versionSuffix = match[2] || ''
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
      release.assets?.some(({ name }) => name.includes(versionSuffix)) ?? false,
  }))
}
