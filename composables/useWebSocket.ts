import type { Log, MemoryData, TrafficData, WsMsg } from '~/types'

export function useBackendWebSocket() {
  const endpointStore = useEndpointStore()
  const connectionsStore = useConnectionsStore()
  const globalStore = useGlobalStore()
  const logsStore = useLogsStore()
  const configStore = useConfigStore()

  // WebSocket connections
  let connectionsWs: WebSocket | null = null
  let trafficWs: WebSocket | null = null
  let memoryWs: WebSocket | null = null
  let logsWs: WebSocket | null = null

  const createWebSocket = (
    path: string,
    onMessage: (data: unknown) => void,
  ) => {
    const endpoint = endpointStore.currentEndpoint
    if (!endpoint) return null

    const wsUrl = endpointStore.wsEndpointURL
    const secret = endpoint.secret

    const params = new URLSearchParams()
    if (secret) params.set('token', secret)

    const ws = new WebSocket(`${wsUrl}/${path}?${params.toString()}`)

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch {
        // Ignore parse errors
      }
    }

    ws.onerror = (error) => {
      console.error(`WebSocket error for ${path}:`, error)
    }

    return ws
  }

  // Connect to all WebSocket endpoints
  const connect = () => {
    // Connections WebSocket
    connectionsWs = createWebSocket('connections', (data: unknown) => {
      connectionsStore.updateFromWsMsg(data as WsMsg)
    })

    // Traffic WebSocket
    trafficWs = createWebSocket('traffic', (data: unknown) => {
      globalStore.setLatestTraffic(data as TrafficData)
    })

    // Memory WebSocket
    memoryWs = createWebSocket('memory', (data: unknown) => {
      globalStore.setLatestMemory(data as MemoryData)
    })

    // Logs WebSocket
    const endpoint = endpointStore.currentEndpoint
    if (endpoint) {
      const wsUrl = endpointStore.wsEndpointURL
      const params = new URLSearchParams()
      if (endpoint.secret) params.set('token', endpoint.secret)
      params.set('level', configStore.logLevel)

      logsWs = new WebSocket(`${wsUrl}/logs?${params.toString()}`)
      logsWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Log
          logsStore.addLog(data)
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // Disconnect all WebSockets
  const disconnect = () => {
    connectionsWs?.close()
    trafficWs?.close()
    memoryWs?.close()
    logsWs?.close()

    connectionsWs = null
    trafficWs = null
    memoryWs = null
    logsWs = null
  }

  // Reconnect (e.g., when log level changes)
  const reconnectLogs = () => {
    logsWs?.close()

    const endpoint = endpointStore.currentEndpoint
    if (endpoint) {
      const wsUrl = endpointStore.wsEndpointURL
      const params = new URLSearchParams()
      if (endpoint.secret) params.set('token', endpoint.secret)
      params.set('level', configStore.logLevel)

      logsWs = new WebSocket(`${wsUrl}/logs?${params.toString()}`)
      logsWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Log
          logsStore.addLog(data)
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  return {
    connect,
    disconnect,
    reconnectLogs,
  }
}
