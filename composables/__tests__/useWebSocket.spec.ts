import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useBackendWebSocket } from '../useWebSocket'

const mockUseMockMode = vi.fn()

vi.mock('../useApi', () => ({
  useMockMode: () => mockUseMockMode(),
}))

vi.mock('../useMockData', () => ({
  useMockData: () => ({
    mockConnections: [],
    mockTrafficStats: { up: 0, down: 0 },
    mockMemory: { inuse: 0, oslimit: 1 },
    mockLogs: [],
  }),
}))

class MockWebSocket {
  static instances: MockWebSocket[] = []

  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  close = vi.fn()

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
  }
}

const mockEndpointStore = {
  currentEndpoint: {
    secret: 'secret',
  },
  wsEndpointURL: 'ws://localhost:9090',
}

const mockConnectionsStore = {
  updateFromWsMsg: vi.fn(),
}

const mockGlobalStore = {
  setLatestTraffic: vi.fn(),
  setLatestMemory: vi.fn(),
  addTrafficDataPoint: vi.fn(),
  addMemoryDataPoint: vi.fn(),
  addConnectionCountDataPoint: vi.fn(),
}

const mockLogsStore = {
  addLog: vi.fn(),
}

const mockConfigStore = {
  logLevel: 'info',
}

vi.stubGlobal('WebSocket', MockWebSocket)
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)
vi.stubGlobal('useConnectionsStore', () => mockConnectionsStore)
vi.stubGlobal('useGlobalStore', () => mockGlobalStore)
vi.stubGlobal('useLogsStore', () => mockLogsStore)
vi.stubGlobal('useConfigStore', () => mockConfigStore)

describe('composables/useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockWebSocket.instances = []
    mockUseMockMode.mockReturnValue(false)
  })

  it('closes existing sockets before reconnecting', () => {
    const { connect } = useBackendWebSocket()

    connect()
    const firstSockets = [...MockWebSocket.instances]

    connect()

    expect(firstSockets).toHaveLength(4)
    for (const socket of firstSockets) {
      expect(socket.close).toHaveBeenCalledTimes(1)
    }
    expect(MockWebSocket.instances).toHaveLength(8)
  })

  it('closes sockets when the owning effect scope is disposed', () => {
    const scope = effectScope()
    let firstSockets: MockWebSocket[] = []

    scope.run(() => {
      const { connect } = useBackendWebSocket()
      connect()
      firstSockets = [...MockWebSocket.instances]
    })

    scope.stop()

    expect(firstSockets).toHaveLength(4)
    for (const socket of firstSockets) {
      expect(socket.close).toHaveBeenCalledTimes(1)
    }
  })

  it('does not create a logs socket when reconnecting logs in mock mode', () => {
    mockUseMockMode.mockReturnValue(true)

    const { reconnectLogs } = useBackendWebSocket()
    reconnectLogs()

    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('reconnects after an unexpected socket close (e.g. Restart Core)', async () => {
    vi.useFakeTimers()

    const { connect } = useBackendWebSocket()
    connect()
    expect(MockWebSocket.instances).toHaveLength(4)

    // The backend restarting drops every socket at once.
    for (const socket of [...MockWebSocket.instances]) {
      socket.onclose?.(new Event('close'))
    }

    // Debounced into a single reconnect that rebuilds all four sockets
    // (3000ms RECONNECT_DELAY; advance past it).
    await vi.advanceTimersByTimeAsync(4000)

    expect(MockWebSocket.instances).toHaveLength(8)

    vi.useRealTimers()
  })

  it('does not reconnect after an intentional disconnect', async () => {
    vi.useFakeTimers()

    const { connect, disconnect } = useBackendWebSocket()
    connect()
    const sockets = [...MockWebSocket.instances]

    disconnect()
    // disconnect detaches each onclose handler, so firing them is a no-op.
    for (const socket of sockets) {
      socket.onclose?.(new Event('close'))
    }
    await vi.advanceTimersByTimeAsync(4000)

    expect(MockWebSocket.instances).toHaveLength(4)

    vi.useRealTimers()
  })
})
