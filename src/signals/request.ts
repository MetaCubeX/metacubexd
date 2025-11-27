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
export const isMockMode = () => import.meta.env.VITE_MOCK_MODE === 'true'

// Lazy-loaded mock module reference
let mockModule: typeof import('~/apis/mock') | null = null
let mockDefinitionsLoaded = false

const loadMockModule = async () => {
  if (!mockModule) {
    mockModule = await import('~/apis/mock')

    // Load definitions to register mock handlers
    if (!mockDefinitionsLoaded) {
      await import('~/apis/definitions')
      mockDefinitionsLoaded = true
    }
  }

  return mockModule
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
    const mockHandler = async <T>(url: string): Promise<T> => {
      const mock = await loadMockModule()

      return mock.getMockData(url) as T
    }

    return {
      get: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      post: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      put: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      patch: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
      delete: (url: string) => ({ json: <T>() => mockHandler<T>(url) }),
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

    // Dynamically import mock WebSocket module
    import('~/apis/ws-mock').then(({ MockWebSocket }) => {
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
