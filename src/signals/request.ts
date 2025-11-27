import { createEventSignal } from '@solid-primitives/event-listener'
import { makePersisted } from '@solid-primitives/storage'
import {
  createReconnectingWS,
  ReconnectingWebSocket,
} from '@solid-primitives/websocket'
import ky from 'ky'
import _ from 'lodash'
import { autoSwitchEndpoint } from '~/signals/config'

// Mock mode support
export const isMockMode = () =>
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_MOCK_MODE === 'true'

// Lazy-loaded mock data module reference
let mockDataModule: typeof import('~/mock/data') | null = null

const getMockData = async () => {
  if (!mockDataModule) {
    mockDataModule = await import('~/mock/data')
  }

  return mockDataModule
}

// Timeout for testing endpoint connectivity
const ENDPOINT_CONNECTIVITY_TIMEOUT_MS = 5000

export const [selectedEndpoint, setSelectedEndpoint] = makePersisted(
  createSignal(''),
  {
    name: 'selectedEndpoint',
    storage: localStorage,
  },
)

export const [endpointList, setEndpointList] = makePersisted(
  createSignal<
    {
      id: string
      url: string
      secret: string
    }[]
  >([]),
  { name: 'endpointList', storage: localStorage },
)

// Track if we're currently attempting to auto-switch to prevent concurrent switches
// Using an object reference to maintain state across async calls
const autoSwitchState = { isAutoSwitching: false }

// Test if an endpoint is reachable
const testEndpointConnectivity = async (
  url: string,
  secret: string,
): Promise<boolean> => {
  try {
    const response = await ky.get(
      url.endsWith('/') ? `${url}version` : `${url}/version`,
      {
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        timeout: ENDPOINT_CONNECTIVITY_TIMEOUT_MS,
      },
    )

    return response.ok
  } catch {
    return false
  }
}

// Attempt to switch to the next available endpoint
export const tryAutoSwitchEndpoint = async (): Promise<boolean> => {
  if (!autoSwitchEndpoint() || autoSwitchState.isAutoSwitching) {
    return false
  }

  const endpoints = endpointList()

  if (endpoints.length < 2) {
    return false
  }

  autoSwitchState.isAutoSwitching = true

  try {
    const currentEndpointId = selectedEndpoint()
    const currentIndex = endpoints.findIndex((e) => e.id === currentEndpointId)

    // Try each endpoint starting from the one after current
    for (let i = 1; i < endpoints.length; i++) {
      const nextIndex = (currentIndex + i) % endpoints.length
      const nextEndpoint = endpoints[nextIndex]

      const isAvailable = await testEndpointConnectivity(
        nextEndpoint.url,
        nextEndpoint.secret,
      )

      if (isAvailable) {
        setSelectedEndpoint(nextEndpoint.id)
        console.log(`[Auto Switch] Switched to endpoint: ${nextEndpoint.url}`)

        return true
      }
    }

    return false
  } finally {
    autoSwitchState.isAutoSwitching = false
  }
}

export const useRequest = () => {
  // In mock mode, use mock fetch handler
  if (isMockMode()) {
    const mockHandler = async (url: string) => {
      const mockData = await getMockData()
      // Extract path from URL
      const path = url

      if (path.includes('version')) {
        return mockData.mockVersion
      }

      if (path.includes('configs')) {
        return mockData.mockConfig
      }

      if (path.includes('providers/proxies')) {
        return {
          providers: Object.fromEntries(
            mockData.mockProxyProviders.map((p) => [p.name, p]),
          ),
        }
      }

      if (path.includes('proxies')) {
        return {
          proxies: Object.fromEntries(
            mockData.mockProxies.map((p) => [p.name, p]),
          ),
        }
      }

      if (path.includes('rules/providers')) {
        return {
          providers: Object.fromEntries(
            mockData.mockRuleProviders.map((p) => [p.name, p]),
          ),
        }
      }

      if (path.includes('rules')) {
        return { rules: mockData.mockRules }
      }

      if (path.includes('connections')) {
        return mockData.generateMockConnectionsMessage()
      }

      if (path.includes('memory')) {
        return mockData.mockMemory
      }

      if (path.includes('traffic')) {
        return mockData.mockTraffic
      }

      return { message: 'OK' }
    }

    return {
      get: (url: string) => ({ json: () => mockHandler(url) }),
      post: (url: string) => ({ json: () => mockHandler(url) }),
      put: (url: string) => ({ json: () => mockHandler(url) }),
      patch: (url: string) => ({ json: () => mockHandler(url) }),
      delete: (url: string) => ({ json: () => mockHandler(url) }),
    }
  }

  const e = endpoint()

  if (!e) {
    return ky.create({})
  }

  const headers = new Headers()

  if (e.secret) {
    headers.set('Authorization', `Bearer ${e.secret}`)
  }

  return ky.create({
    prefixUrl: e.url,
    headers,
  })
}

export const useGithubAPI = () => {
  const headers = new Headers()

  if (import.meta.env.VITE_APP_GH_TOKEN) {
    headers.set('Authorization', `Bearer ${import.meta.env.VITE_APP_GH_TOKEN}`)
  }

  return ky.create({
    prefixUrl: 'https://api.github.com',
    headers,
  })
}

export const endpoint = () =>
  endpointList().find(({ id }) => id === selectedEndpoint())

export const secret = () => endpoint()?.secret

export const wsEndpointURL = () =>
  _.trimEnd(new URL(endpoint()?.url ?? '').href.replace('http', 'ws'), '/')

const webSocketInstanceMap = new Map<string, ReconnectingWebSocket>()
const mockWebSocketInstanceMap = new Map<string, { close: () => void }>()

export const useWsRequest = <T>(
  path: string,
  queries: Record<string, string> = {},
) => {
  // Mock mode WebSocket handling
  if (isMockMode()) {
    const oldMockInstance = mockWebSocketInstanceMap.get(path)

    if (oldMockInstance) {
      oldMockInstance.close()
      mockWebSocketInstanceMap.delete(path)
    }

    const [data, setData] = createSignal<T | null>(null)

    // Dynamically import mock module and create mock WebSocket
    import('~/mock').then(({ MockWebSocket }) => {
      const mockWs = new MockWebSocket(`ws://mock/${path}`)

      mockWs.addEventListener('message', (event: MessageEvent) => {
        try {
          setData(JSON.parse(event.data))
        } catch {
          // Ignore parse errors
        }
      })

      mockWebSocketInstanceMap.set(path, mockWs)
    })

    return createMemo<T | null>(() => data())
  }

  const oldInstance = webSocketInstanceMap.get(path)

  if (oldInstance) {
    oldInstance.close()
    webSocketInstanceMap.delete(path)
  }

  const queryParams = new URLSearchParams(queries)
  queryParams.set('token', secret() ?? '')

  const ws = createReconnectingWS(
    `${wsEndpointURL()}/${path}?${queryParams.toString()}`,
  )

  const event = createEventSignal<{
    message: MessageEvent
  }>(ws, 'message')

  webSocketInstanceMap.set(path, ws)

  return createMemo<T | null>(() => {
    const e = event()

    if (!e) {
      return null
    }

    return JSON.parse(event()?.data)
  })
}
