import type { Options } from 'ky'
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
import { compareVersions, isSingBoxVersion } from '~/utils'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'
import { useMockData } from './useMockData'

// Mock mode support
export function useMockMode() {
  const config = useRuntimeConfig()

  return config.public.mockMode === true
}

interface MockHistory {
  time: string
  delay: number
}
interface MockProxyShape {
  name?: string
  all?: string[]
  history?: MockHistory[]
}
interface MockProviderShape {
  proxies?: MockProxyShape[]
}

const MOCK_HISTORY_CAP = 10

function pickJitteredDelay(previous: number | undefined): number {
  if (!previous || previous <= 0) {
    // No prior datapoint: 90% chance of a "successful" test in the 40-300ms range
    return Math.random() < 0.9 ? Math.round(40 + Math.random() * 260) : 0
  }
  // ±20% jitter around the previous value, never below 1ms
  const variance = previous * 0.2
  return Math.round(
    Math.max(1, previous - variance) + Math.random() * variance * 2,
  )
}

function appendMockHistory(proxy: MockProxyShape, delay: number) {
  const entry: MockHistory = { time: new Date().toISOString(), delay }
  proxy.history = [...(proxy.history ?? []), entry].slice(-MOCK_HISTORY_CAP)
}

function simulateProxyDelay(
  proxies: Record<string, MockProxyShape>,
  proxyName: string,
): { delay: number } {
  const proxy = proxies[proxyName]
  if (!proxy) return { delay: 0 }
  const previous = proxy.history?.at(-1)?.delay
  const delay = pickJitteredDelay(previous)
  appendMockHistory(proxy, delay)
  return { delay }
}

function simulateGroupDelay(
  proxies: Record<string, MockProxyShape>,
  groupName: string,
): Record<string, number> {
  const group = proxies[groupName]
  if (!group?.all) return {}
  const results: Record<string, number> = {}
  for (const child of group.all) {
    results[child] = simulateProxyDelay(proxies, child).delay
  }
  return results
}

function simulateProviderHealthCheck(
  providers: Record<string, MockProviderShape>,
  proxies: Record<string, MockProxyShape>,
  providerName: string,
): Record<string, number> {
  const provider = providers[providerName]
  if (!provider?.proxies) return {}
  const results: Record<string, number> = {}
  for (const node of provider.proxies) {
    if (!node.name) continue
    const previous =
      proxies[node.name]?.history?.at(-1)?.delay ?? node.history?.at(-1)?.delay
    const delay = pickJitteredDelay(previous)
    results[node.name] = delay
    // Keep both the provider's copy and the top-level proxy in sync so a
    // subsequent fetchProxies reflects the new history.
    appendMockHistory(node, delay)
    if (proxies[node.name]) appendMockHistory(proxies[node.name]!, delay)
  }
  return results
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
      rulesObj[String(idx)] = rule
    })

    return { rules: rulesObj }
  }
  if (path === 'providers/rules')
    return { providers: mockData.mockRuleProviders }
  if (path === 'rules/disable') return {}
  if (path === 'connections')
    return {
      connections: mockData.mockConnections,
      downloadTotal: 850000000,
      uploadTotal: 125000000,
    }
  if (path === 'group') return { groups: {} }

  // Latency-test endpoints — must be matched before the generic `proxies/` catch-all
  if (path.startsWith('proxies/') && path.endsWith('/delay')) {
    const proxyName = decodeURIComponent(
      path.slice('proxies/'.length, -'/delay'.length),
    )
    return simulateProxyDelay(
      mockData.mockProxies as Record<string, MockProxyShape>,
      proxyName,
    )
  }
  if (path.startsWith('group/') && path.endsWith('/delay')) {
    const groupName = decodeURIComponent(
      path.slice('group/'.length, -'/delay'.length),
    )
    return simulateGroupDelay(
      mockData.mockProxies as Record<string, MockProxyShape>,
      groupName,
    )
  }
  if (path.startsWith('providers/proxies/') && path.endsWith('/healthcheck')) {
    const middle = path.slice(
      'providers/proxies/'.length,
      -'/healthcheck'.length,
    )
    // Two shapes share this prefix: `{provider}/healthcheck` triggers the whole
    // provider (returns a name->delay map), while `{provider}/{node}/healthcheck`
    // tests a single node (returns { delay }, like the per-node delay endpoint).
    const segments = middle.split('/')
    if (segments.length === 2) {
      return simulateProxyDelay(
        mockData.mockProxies as Record<string, MockProxyShape>,
        decodeURIComponent(segments[1]!),
      )
    }
    return simulateProviderHealthCheck(
      mockData.mockProxyProviders as Record<string, MockProviderShape>,
      mockData.mockProxies as Record<string, MockProxyShape>,
      decodeURIComponent(middle),
    )
  }

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

// Expose the JSON contract shared by mock responses and Ky's response promises.
interface RequestResponse {
  json: <T = unknown>() => Promise<T>
}

type RequestClient = Record<
  'get' | 'post' | 'put' | 'patch' | 'delete',
  (url: string, options?: Options) => RequestResponse
>

export function useRequest(): RequestClient {
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
    prefix: endpoint.url,
    headers,
    timeout: 5000,
  })
}

export function useGithubAPI() {
  const runtimeConfig = useRuntimeConfig()
  const headers = new Headers()
  headers.set('Accept', 'application/vnd.github+json')

  const browserConfig =
    typeof window !== 'undefined'
      ? (window as unknown as {
          __METACUBEXD_CONFIG__?: { githubToken?: string }
          metacubexd?: { githubToken?: string }
        })
      : undefined
  const injectedToken =
    browserConfig?.metacubexd?.githubToken ||
    browserConfig?.__METACUBEXD_CONFIG__?.githubToken
  const token =
    injectedToken ||
    (runtimeConfig.public.githubToken as string | undefined) ||
    import.meta.env.VITE_APP_GH_TOKEN
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return ky.create({
    prefix: 'https://api.github.com',
    headers,
  })
}

// API Functions
export type EndpointCheckError =
  'mixed_content' | 'auth_error' | 'network_error' | null

export function checkEndpointAPI(
  url: string,
  secret: string,
): Promise<EndpointCheckError> {
  return ky
    .get(url.endsWith('/') ? `${url}version` : `${url}/version`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      timeout: 5000,
    })
    .then(() => null)
    .catch((err) => {
      console.error(err)

      // A rejected secret (Mihomo answers /version with 401) is an auth
      // problem, not a reachability one — surface it distinctly so the fix
      // is "check the secret", not "check the URL / is the kernel running".
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        return 'auth_error'
      }

      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        url.startsWith('http://')
      ) {
        return 'mixed_content'
      }

      return 'network_error'
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

  // Mihomo returns 204 No Content — this only triggers an async health check.
  return request.get(
    `providers/proxies/${encodeURIComponent(providerName)}/healthcheck`,
    {
      timeout: 20 * 1000,
    },
  )
}

export function selectProxyInGroupAPI(groupName: string, proxyName: string) {
  const request = useRequest()

  return request.put(`proxies/${encodeURIComponent(groupName)}`, {
    body: JSON.stringify({ name: proxyName }),
  })
}

export function unfixProxyInGroupAPI(groupName: string) {
  const request = useRequest()

  // Clears a manual pin on an automatic group (url-test/fallback/load-balance),
  // restoring automatic selection. Mihomo returns 400 for Selector groups,
  // which have no "fixed" concept — callers should only offer this on groups
  // that report a non-empty `fixed`.
  return request.delete(`proxies/${encodeURIComponent(groupName)}`)
}

export function proxyLatencyTestAPI(
  proxyName: string,
  provider: string,
  url: string,
  timeout: number,
) {
  const request = useRequest()

  // A provider node may not be present in the global /proxies map (or its name
  // may collide with another provider's node), so when the provider is known we
  // hit the provider-scoped health-check endpoint to test that exact node.
  // Both endpoints share mihomo's getProxyDelay handler and return { delay }.
  const path = provider
    ? `providers/proxies/${encodeURIComponent(provider)}/${encodeURIComponent(proxyName)}/healthcheck`
    : `proxies/${encodeURIComponent(proxyName)}/delay`

  return request
    .get(path, {
      searchParams: { url, timeout },
      // `timeout` is the backend's per-node budget; the client round trip adds
      // network overhead on top. ky's default 5s timeout equals the default
      // backend timeout, so a slow-but-valid node was aborted client-side
      // before the kernel answered and always showed as failed (#2041). Give
      // the client comfortable headroom over the backend budget.
      timeout: Math.max(20_000, timeout + 10_000),
    })
    .json<{ delay: number }>()
}

export function proxyGroupLatencyTestAPI(
  groupName: string,
  url: string,
  timeout: number,
) {
  const request = useRequest()

  // The backend's `timeout` is per-node; the group test fans out to every
  // member, so the overall round trip easily exceeds ky's 5s default. Scale
  // the client timeout generously, floored at 30s, plus 10s of headroom.
  return request
    .get(`group/${encodeURIComponent(groupName)}/delay`, {
      searchParams: { url, timeout },
      timeout: Math.max(30_000, timeout * 2 + 10_000),
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

export function toggleRuleDisabledAPI(index: number, disabled: boolean) {
  const request = useRequest()

  return request.patch('rules/disable', {
    json: { [index]: disabled },
  })
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
      return true
    } catch {
      return false
    } finally {
      reloadingConfigFile.value = false
    }
  }

  const fetchingRemoteConfig = ref(false)
  const fetchRemoteConfigAPI = async (url: string) => {
    fetchingRemoteConfig.value = true
    try {
      if (useControlInfo().hasFeature('profiles')) {
        // Server/desktop: import the URL as a persisted remote profile and
        // activate it. The agent fetches it (correct UA + subscription-userinfo),
        // writes the active config, and restarts the kernel — so the fetched
        // config survives a restart, unlike PUT /configs which only loads it into
        // the running kernel and is lost on the next restart (#2070). This also
        // works on a fresh server with no profile yet, and surfaces the import in
        // the Profiles page for later refresh/management.
        const api = useControlApi()
        const meta = await api.importProfile(url)
        await api.activateProfile(meta.id)
        return
      }
      // Plain remote mihomo backend (no agent): hot-load into the running kernel.
      const response = await ky.get(url)
      const payload = await response.text()
      await useRequest().put('configs', {
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
    } finally {
      flushingFakeIPData.value = false
    }
  }

  const flushDNSCacheAPI = async () => {
    const request = useRequest()
    flushingDNSCache.value = true
    try {
      await request.post('cache/dns/flush')
    } catch {
      /* empty */
    } finally {
      flushingDNSCache.value = false
    }
  }

  const updateGEODatabasesAPI = async () => {
    const request = useRequest()
    updatingGEODatabases.value = true
    try {
      await request.post('configs/geo')
    } catch {
      /* empty */
    } finally {
      updatingGEODatabases.value = false
    }
  }

  const upgradeBackendAPI = async () => {
    const request = useRequest()
    upgradingBackend.value = true
    try {
      await request.post('upgrade')
    } catch {
      /* empty */
    } finally {
      upgradingBackend.value = false
    }
  }

  const upgradeUIAPI = async () => {
    const request = useRequest()
    upgradingUI.value = true
    try {
      await request.post('upgrade/ui')
    } catch {
      /* empty */
    } finally {
      upgradingUI.value = false
    }
  }

  const restartBackendAPI = async () => {
    const request = useRequest()
    restartingBackend.value = true
    try {
      await request.post('restart')
      return true
    } catch {
      return false
    } finally {
      restartingBackend.value = false
    }
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
const METACUBEX_MIHOMO_REPOSITORY_URL = 'repos/MetaCubeX/mihomo'
const VERNESONG_MIHOMO_REPOSITORY_URL = 'repos/vernesong/mihomo'

type BackendReleaseChannel = 'alpha' | 'beta' | 'meta' | 'stable'

function isAsciiWord(char: string | undefined): boolean {
  if (!char) return false
  const lower = char.toLowerCase()
  return (
    (lower >= 'a' && lower <= 'z') ||
    (char >= '0' && char <= '9') ||
    char === '_'
  )
}

function backendVersionParts(currentVersion: string): {
  channel: Exclude<BackendReleaseChannel, 'stable'> | undefined
  suffix: string
} {
  const value = currentVersion.toLowerCase()
  let best:
    | {
        index: number
        channel: Exclude<BackendReleaseChannel, 'stable'>
        suffix: string
      }
    | undefined

  for (const channel of ['alpha', 'beta', 'meta'] as const) {
    let index = value.indexOf(channel)
    while (index !== -1) {
      const hasBoundary = index === 0 || !isAsciiWord(value[index - 1])
      let suffixStart = index + channel.length
      if (value[suffixStart] === '-') suffixStart++
      const hasSuffix =
        suffixStart < value.length && value[suffixStart]!.trim() !== ''
      if (hasBoundary && hasSuffix) {
        let suffixEnd = suffixStart
        while (suffixEnd < value.length && value[suffixEnd]!.trim() !== '') {
          suffixEnd++
        }
        const candidate = {
          index,
          channel,
          suffix: currentVersion.slice(suffixStart, suffixEnd),
        }
        if (!best || candidate.index < best.index) best = candidate
        break
      }
      index = value.indexOf(channel, index + channel.length)
    }
  }

  return best
    ? { channel: best.channel, suffix: best.suffix }
    : { channel: undefined, suffix: '' }
}

function resolveBackendReleaseTarget(currentVersion: string): {
  channel: BackendReleaseChannel
  repositoryURL: string
  versionSuffix: string
} {
  const { channel, suffix } = backendVersionParts(currentVersion)

  return {
    channel: channel ?? 'stable',
    repositoryURL: currentVersion.toLowerCase().includes('-smart-')
      ? VERNESONG_MIHOMO_REPOSITORY_URL
      : METACUBEX_MIHOMO_REPOSITORY_URL,
    versionSuffix: suffix,
  }
}

function isStableRelease(release: ReleaseAPIResponse) {
  const tagName = release.tag_name.toLowerCase()

  return (
    !release.prerelease &&
    !tagName.includes('alpha') &&
    !tagName.includes('prerelease')
  )
}

function isAlphaRelease(release: ReleaseAPIResponse) {
  const tagName = release.tag_name.toLowerCase()

  return tagName.includes('alpha') || tagName.includes('prerelease')
}

interface ReleaseAPIResponse {
  tag_name: string
  body: string | null
  assets: { name: string }[]
  published_at: string
  draft: boolean
  prerelease: boolean
}

const RELEASE_CACHE_TTL = 60 * 60 * 1000
interface ReleaseCacheEntry {
  expiresAt: number
  releases: Promise<ReleaseAPIResponse[]>
}
const releaseCache = new Map<string, ReleaseCacheEntry>()

let githubCooldown: { until: number; error: unknown } | undefined

function isRelease(value: unknown): value is ReleaseAPIResponse {
  if (!value || typeof value !== 'object') return false
  const release = value as ReleaseAPIResponse
  return (
    typeof release.tag_name === 'string' &&
    (release.body === null || typeof release.body === 'string') &&
    typeof release.published_at === 'string' &&
    typeof release.draft === 'boolean' &&
    typeof release.prerelease === 'boolean' &&
    Array.isArray(release.assets) &&
    release.assets.every((asset) => asset && typeof asset.name === 'string')
  )
}

async function cachedReleaseRequest(
  githubAPI: ReturnType<typeof useGithubAPI>,
  path: string,
  count?: number,
) {
  const url = count === undefined ? path : `${path}?per_page=${count}`
  const cached = releaseCache.get(url)
  if (cached && cached.expiresAt > Date.now()) return cached.releases
  if (githubCooldown && githubCooldown.until > Date.now())
    throw githubCooldown.error

  // GitHub sets max-age=60. Reuse the HTTP cache for an hour, then refresh it.
  let expiresAt = 0
  try {
    expiresAt = Number(sessionStorage.getItem(url)) || 0
  } catch {
    // Storage is optional when browsing with persistence disabled.
  }
  const reuse =
    expiresAt > Date.now() && expiresAt <= Date.now() + RELEASE_CACHE_TTL
  const request = githubAPI
    .get(url, { cache: reuse ? 'force-cache' : 'reload', retry: 0 })
    .json<ReleaseAPIResponse | ReleaseAPIResponse[]>()
    .then((response) => {
      const data = (Array.isArray(response) ? response : [response]).filter(
        (release) => !release?.draft,
      )
      if (!data.every(isRelease))
        throw new Error('Invalid GitHub releases response')
      if (!reuse) {
        expiresAt = Date.now() + RELEASE_CACHE_TTL
        try {
          sessionStorage.setItem(url, String(expiresAt))
        } catch {
          // The in-memory cache still covers this page load.
        }
      }
      entry.expiresAt = expiresAt
      return data
    })
    .catch((error) => {
      releaseCache.delete(url)
      const response = error?.response as Response | undefined
      if (response && (response.status === 403 || response.status === 429)) {
        const headers = response.headers
        const retryAfter = Number(headers.get('retry-after')) * 1000
        const reset =
          headers.get('x-ratelimit-remaining') === '0'
            ? Number(headers.get('x-ratelimit-reset')) * 1000
            : 0
        githubCooldown = {
          until: Math.max(
            githubCooldown?.until ?? 0,
            reset || 0,
            Date.now() + (retryAfter || 60_000),
          ),
          error,
        }
      }
      throw error
    })
  // Share the pending request; its one-hour lifetime starts on success.
  const entry = { expiresAt: Infinity, releases: request }
  releaseCache.set(url, entry)
  return request
}

async function latestStableRelease(
  githubAPI: ReturnType<typeof useGithubAPI>,
  repositoryURL: string,
) {
  const releases = await cachedReleaseRequest(
    githubAPI,
    `${repositoryURL}/releases`,
    20,
  )
  // shortcut: use list order for latest stable; use /latest if a repo pins older releases.
  return (
    releases.find(
      (release) =>
        isStableRelease(release) && /^v?\d+\.\d+\.\d+$/.test(release.tag_name),
    ) ??
    (
      await cachedReleaseRequest(githubAPI, `${repositoryURL}/releases/latest`)
    )[0]
  )
}

export async function frontendReleaseAPI(currentVersion: string) {
  const release = await latestStableRelease(
    useGithubAPI(),
    'repos/MetaCubeX/metacubexd',
  )
  if (!release) return { isUpdateAvailable: false }

  return {
    isUpdateAvailable: compareVersions(release.tag_name, currentVersion) > 0,
    changelog: release.body ?? '',
  }
}

export async function backendReleaseAPI(currentVersion: string) {
  // sing-box serves the clash API but isn't mihomo; checking its version
  // against the mihomo release feed would always report a bogus "update
  // available". Skip the check entirely for sing-box (#1870).
  if (isSingBoxVersion(currentVersion)) return { isUpdateAvailable: false }

  const { channel, repositoryURL, versionSuffix } =
    resolveBackendReleaseTarget(currentVersion)

  if (channel === 'beta') return { isUpdateAvailable: false }
  const githubAPI = useGithubAPI()
  let release: ReleaseAPIResponse | undefined
  if (channel === 'alpha') {
    const releases = await cachedReleaseRequest(
      githubAPI,
      `${repositoryURL}/releases`,
      20,
    )
    release = releases.find(
      (release) => release.tag_name === 'Prerelease-Alpha',
    )
    release ??= (
      await cachedReleaseRequest(
        githubAPI,
        `${repositoryURL}/releases/tags/Prerelease-Alpha`,
      )
    )[0]
  } else {
    release = await latestStableRelease(githubAPI, repositoryURL)
  }
  if (!release) return { isUpdateAvailable: false }

  return {
    isUpdateAvailable:
      channel === 'stable'
        ? compareVersions(release.tag_name, currentVersion) > 0
        : !release.assets.some(({ name }) => name.includes(versionSuffix)),
    changelog: release.body ?? '',
  }
}

function toReleaseInfo(
  release: ReleaseAPIResponse,
  isCurrent: boolean,
): ReleaseInfo {
  return {
    version: release.tag_name,
    changelog: release.body ?? '',
    publishedAt: release.published_at,
    isCurrent,
  }
}

export async function fetchFrontendReleasesAPI(
  currentVersion: string,
  count: number = 10,
): Promise<ReleaseInfo[]> {
  const releases = await cachedReleaseRequest(
    useGithubAPI(),
    'repos/MetaCubeX/metacubexd/releases',
    Math.max(20, count),
  )

  return releases
    .slice(0, count)
    .map((release) =>
      toReleaseInfo(release, release.tag_name === currentVersion),
    )
}

export async function fetchBackendReleasesAPI(
  currentVersion: string,
  count: number = 10,
): Promise<ReleaseInfo[]> {
  if (isSingBoxVersion(currentVersion)) return []
  const { channel, repositoryURL, versionSuffix } =
    resolveBackendReleaseTarget(currentVersion)
  if (channel === 'beta') return []
  const releases = await cachedReleaseRequest(
    useGithubAPI(),
    `${repositoryURL}/releases`,
    Math.max(20, channel === 'alpha' ? count * 2 : count),
  )

  return releases
    .filter(channel === 'alpha' ? isAlphaRelease : isStableRelease)
    .slice(0, count)
    .map((release) =>
      toReleaseInfo(
        release,
        channel === 'stable'
          ? release.tag_name === currentVersion
          : release.assets.some(({ name }) => name.includes(versionSuffix)),
      ),
    )
}
