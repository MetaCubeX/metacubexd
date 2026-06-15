import type { Log, MemoryData, TrafficData, WsMsg } from '~/types'
import { getCurrentScope, onScopeDispose } from 'vue'
import { useMockMode } from './useApi'
import { useMockData } from './useMockData'

// Delay before retrying after an unexpected socket close (e.g. "Restart Core").
const RECONNECT_DELAY = 3000

export function useBackendWebSocket() {
  const endpointStore = useEndpointStore()
  const connectionsStore = useConnectionsStore()
  const globalStore = useGlobalStore()
  const logsStore = useLogsStore()
  const configStore = useConfigStore()
  const kernelStore = useKernelStore()
  const { hasFeature } = useControlInfo()

  // In the desktop app the Clash API is served by the managed kernel; when the
  // kernel is stopped that port is closed, so opening (or reconnecting) any
  // socket just loops on ERR_CONNECTION_REFUSED. Only talk to it while the
  // kernel is running. The web dashboard has no kernel-control feature, so this
  // is always true there — preserving the original always-connect behavior.
  const kernelAllowsConnection = () =>
    !hasFeature('kernel-control') || kernelStore.state?.status === 'running'

  // WebSocket connections
  let connectionsWs: WebSocket | null = null
  let trafficWs: WebSocket | null = null
  let memoryWs: WebSocket | null = null
  let logsWs: WebSocket | null = null

  // Mock mode intervals
  let mockInterval: ReturnType<typeof setInterval> | null = null

  // Auto-reconnect bookkeeping
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Close a socket WITHOUT triggering its auto-reconnect handler. Used for
  // intentional teardown (reconnect, unmount), so we don't reconnect a socket
  // we closed on purpose.
  const closeWs = (ws: WebSocket | null) => {
    if (!ws) return
    ws.onclose = null
    ws.close()
  }

  // Debounced reconnect. A backend restart ("Restart Core") drops every socket
  // at once, so coalesce into a single attempt; each failed attempt's socket
  // fires onclose again, so this keeps retrying until the backend is back.
  const scheduleReconnect = () => {
    if (useMockMode()) return
    if (reconnectTimer) return
    if (!endpointStore.currentEndpoint) return
    if (!kernelAllowsConnection()) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_DELAY)
  }

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

    ws.onclose = () => {
      scheduleReconnect()
    }

    return ws
  }

  // Connect to all WebSocket endpoints
  const connect = () => {
    disconnect()

    // In mock mode, use mock data instead of WebSocket
    if (useMockMode()) {
      const mockData = useMockData()

      // Immediately populate stores with mock data
      connectionsStore.updateFromWsMsg({
        connections: mockData.mockConnections,
        uploadTotal: mockData.mockTrafficStats.up,
        downloadTotal: mockData.mockTrafficStats.down,
      } as WsMsg)

      globalStore.setLatestTraffic(mockData.mockTrafficStats as TrafficData)
      globalStore.setLatestMemory(mockData.mockMemory as MemoryData)

      // Add initial chart data points for traffic, memory, and connections
      const now = Date.now()
      const baseConnectionCount = mockData.mockConnections.length
      for (let i = 30; i >= 0; i--) {
        const time = now - i * 1000
        const trafficDown =
          mockData.mockTrafficStats.down +
          Math.floor(Math.random() * 100000) -
          50000
        const trafficUp =
          mockData.mockTrafficStats.up +
          Math.floor(Math.random() * 20000) -
          10000
        const memoryValue =
          mockData.mockMemory.inuse +
          Math.floor(Math.random() * 5000000) -
          2500000
        // Simulate connection count fluctuation
        const connectionCount =
          baseConnectionCount + Math.floor(Math.random() * 10) - 5
        globalStore.addTrafficDataPoint(time, trafficDown, trafficUp)
        globalStore.addMemoryDataPoint(time, memoryValue)
        globalStore.addConnectionCountDataPoint(time, connectionCount)
      }

      // Add mock logs
      mockData.mockLogs.forEach((log) => {
        logsStore.addLog(log as Log)
      })

      // Simulate periodic updates for traffic/memory/connections
      mockInterval = setInterval(() => {
        const time = Date.now()
        // Simulate traffic fluctuation
        const trafficVariation = {
          up: mockData.mockTrafficStats.up + Math.floor(Math.random() * 10000),
          down:
            mockData.mockTrafficStats.down + Math.floor(Math.random() * 50000),
        }
        globalStore.setLatestTraffic(trafficVariation as TrafficData)
        globalStore.addTrafficDataPoint(
          time,
          trafficVariation.down,
          trafficVariation.up,
        )

        // Simulate memory fluctuation
        const memoryVariation = {
          inuse:
            mockData.mockMemory.inuse +
            Math.floor(Math.random() * 5000000) -
            2500000,
          oslimit: mockData.mockMemory.oslimit,
        }
        globalStore.setLatestMemory(memoryVariation as MemoryData)
        globalStore.addMemoryDataPoint(time, memoryVariation.inuse)

        // Simulate connection count fluctuation
        const connectionCount =
          mockData.mockConnections.length + Math.floor(Math.random() * 10) - 5
        globalStore.addConnectionCountDataPoint(time, connectionCount)
      }, 1000)

      return
    }

    // Desktop: don't open sockets while the managed kernel is down (its Clash
    // API port is closed). disconnect() above already cleared everything.
    if (!kernelAllowsConnection()) return

    // Connections WebSocket
    connectionsWs = createWebSocket('connections', (data: unknown) => {
      const wsMsg = data as WsMsg
      connectionsStore.updateFromWsMsg(wsMsg)
      // Add data point for connection count history
      if (wsMsg) {
        const connectionCount = wsMsg.connections?.length ?? 0
        globalStore.addConnectionCountDataPoint(Date.now(), connectionCount)
      }
    })

    // Traffic WebSocket
    trafficWs = createWebSocket('traffic', (data: unknown) => {
      const trafficData = data as TrafficData
      globalStore.setLatestTraffic(trafficData)
      // Add data point for chart history
      globalStore.addTrafficDataPoint(
        Date.now(),
        trafficData.down,
        trafficData.up,
      )
    })

    // Memory WebSocket
    memoryWs = createWebSocket('memory', (data: unknown) => {
      const memoryData = data as MemoryData
      globalStore.setLatestMemory(memoryData)
      // Add data point for chart history
      globalStore.addMemoryDataPoint(Date.now(), memoryData.inuse)
    })

    // Logs WebSocket
    logsWs = createLogsWebSocket()
  }

  // Disconnect all WebSockets
  const disconnect = () => {
    // Cancel any pending reconnect — this is an intentional teardown.
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    // Clear mock interval if in mock mode
    if (mockInterval) {
      clearInterval(mockInterval)
      mockInterval = null
    }

    closeWs(connectionsWs)
    closeWs(trafficWs)
    closeWs(memoryWs)
    closeWs(logsWs)

    connectionsWs = null
    trafficWs = null
    memoryWs = null
    logsWs = null
  }

  // Helper: create logs WebSocket
  const createLogsWebSocket = (): WebSocket | null => {
    const endpoint = endpointStore.currentEndpoint
    if (!endpoint) return null
    // Same kernel gate as connect(): no logs socket while the kernel is down.
    if (!kernelAllowsConnection()) return null

    const wsUrl = endpointStore.wsEndpointURL
    const params = new URLSearchParams()
    if (endpoint.secret) params.set('token', endpoint.secret)
    params.set('level', configStore.logLevel)

    const ws = new WebSocket(`${wsUrl}/logs?${params.toString()}`)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Log
        logsStore.addLog(data)
      } catch {
        // Ignore parse errors
      }
    }

    ws.onclose = () => {
      scheduleReconnect()
    }

    return ws
  }

  // Reconnect (e.g., when log level changes)
  const reconnectLogs = () => {
    closeWs(logsWs)
    logsWs = useMockMode() ? null : createLogsWebSocket()
  }

  if (getCurrentScope()) {
    onScopeDispose(disconnect)
  }

  return {
    connect,
    disconnect,
    reconnectLogs,
  }
}
