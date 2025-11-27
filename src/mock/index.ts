// Mock API handlers for development and screenshot generation
import {
  generateMockConnectionsMessage,
  mockConfig,
  mockLogs,
  mockMemory,
  mockProxies,
  mockProxyProviders,
  mockRuleProviders,
  mockRules,
  mockTraffic,
  mockVersion,
} from './data'

export const isMockMode = () =>
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.VITE_MOCK_MODE === 'true'

// Mock API response handlers
export const mockApiHandlers: Record<
  string,
  () => Promise<Record<string, unknown>>
> = {
  version: async () => mockVersion,
  configs: async () => mockConfig,
  proxies: async () => ({
    proxies: Object.fromEntries(mockProxies.map((p) => [p.name, p])),
  }),
  providers: async () => ({
    providers: Object.fromEntries(mockProxyProviders.map((p) => [p.name, p])),
  }),
  rules: async () => ({ rules: mockRules }),
  'rules/providers': async () => ({
    providers: Object.fromEntries(mockRuleProviders.map((p) => [p.name, p])),
  }),
  connections: async () => generateMockConnectionsMessage(),
  logs: async () => ({ logs: mockLogs }),
  memory: async () => mockMemory,
  traffic: async () => mockTraffic,
}

// Simulated WebSocket for mock mode
export class MockWebSocket {
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map()
  private intervalId: ReturnType<typeof setInterval> | null = null
  public readyState: number = WebSocket.OPEN

  constructor(private url: string) {
    // Start sending mock data based on URL type
    setTimeout(() => {
      this.dispatchEvent('open', new Event('open'))
      this.startMockData()
    }, 100)
  }

  private startMockData() {
    // Parse path from URL (handle ws://mock/path format)
    const urlPath = this.url.replace(/^ws:\/\/mock\/?/, '/')

    if (urlPath.includes('connections')) {
      this.intervalId = setInterval(() => {
        const data = generateMockConnectionsMessage()
        this.dispatchEvent(
          'message',
          new MessageEvent('message', { data: JSON.stringify(data) }),
        )
      }, 1000)
    } else if (urlPath.includes('traffic')) {
      this.intervalId = setInterval(() => {
        const data = {
          up: Math.floor(Math.random() * 2097152), // 0-2MB/s
          down: Math.floor(Math.random() * 10485760), // 0-10MB/s
        }
        this.dispatchEvent(
          'message',
          new MessageEvent('message', { data: JSON.stringify(data) }),
        )
      }, 1000)
    } else if (urlPath.includes('memory')) {
      this.intervalId = setInterval(() => {
        const data = {
          inuse: 52428800 + Math.floor(Math.random() * 10485760), // 50-60MB
          oslimit: 0,
        }
        this.dispatchEvent(
          'message',
          new MessageEvent('message', { data: JSON.stringify(data) }),
        )
      }, 1000)
    } else if (urlPath.includes('logs')) {
      let logIndex = 0
      this.intervalId = setInterval(() => {
        const log = mockLogs[logIndex % mockLogs.length]
        this.dispatchEvent(
          'message',
          new MessageEvent('message', { data: JSON.stringify(log) }),
        )
        logIndex++
      }, 500)
    }
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }

    this.listeners.get(type)!.add(listener as (event: MessageEvent) => void)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    this.listeners.get(type)?.delete(listener as (event: MessageEvent) => void)
  }

  private dispatchEvent(type: string, event: Event) {
    this.listeners
      .get(type)
      ?.forEach((listener) => listener(event as MessageEvent))
  }

  close() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    this.readyState = WebSocket.CLOSED
    this.dispatchEvent('close', new CloseEvent('close'))
  }

  send(_data: string | ArrayBuffer | Blob | ArrayBufferView) {
    // Mock WebSocket doesn't need to handle sends
  }
}

// Create mock fetch wrapper
export const createMockFetch = () => {
  return async (
    input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString()
    const pathname = new URL(url, 'http://localhost').pathname

    // Find matching handler
    for (const [path, handler] of Object.entries(mockApiHandlers)) {
      if (pathname.endsWith(path) || pathname.includes(`/${path}`)) {
        const data = await handler()

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Default response for unhandled paths
    return new Response(JSON.stringify({ message: 'OK' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
