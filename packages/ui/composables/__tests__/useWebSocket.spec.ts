import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
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

const mockEndpointStore = reactive({
  selectedEndpoint: 'endpoint-a',
  currentEndpoint: {
    url: 'http://localhost:9090',
    secret: 'secret',
  },
  get wsEndpointURL() {
    return this.currentEndpoint.url.replace(/^http/, 'ws')
  },
})

const mockConnectionsStore = {
  updateFromWsMsg: vi.fn(),
}

const mockGlobalStore = {
  setLatestTraffic: vi.fn(),
  setLatestMemory: vi.fn(),
  addTrafficDataPoint: vi.fn(),
  addMemoryDataPoint: vi.fn(),
  addConnectionCountDataPoint: vi.fn(),
  clearChartHistory: vi.fn(),
}

const mockLogsStore = {
  addLog: vi.fn(),
  clearLogs: vi.fn(),
}

const mockConfigStore = {
  logLevel: 'info',
}

// Kernel-control gating (desktop). Defaults below (set in beforeEach) keep the
// composable in "web dashboard" mode — no kernel-control feature — so the
// existing always-connect/always-reconnect tests are unaffected.
let mockHasFeature: (f: string) => boolean = () => false
let mockKernelState: { status?: string } | null = null

vi.stubGlobal('WebSocket', MockWebSocket)
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)
vi.stubGlobal('useConnectionsStore', () => mockConnectionsStore)
vi.stubGlobal('useGlobalStore', () => mockGlobalStore)
vi.stubGlobal('useLogsStore', () => mockLogsStore)
vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useControlInfo', () => ({
  hasFeature: (f: string) => mockHasFeature(f),
}))
// `state` is a getter so the composable reads the CURRENT kernel status each
// time (mirrors pinia reactivity), letting a test flip status mid-run.
vi.stubGlobal('useKernelStore', () => ({
  get state() {
    return mockKernelState
  },
}))

describe('composables/useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockWebSocket.instances = []
    mockUseMockMode.mockReturnValue(false)
    mockHasFeature = () => false
    mockKernelState = null
    mockEndpointStore.selectedEndpoint = 'endpoint-a'
    mockEndpointStore.currentEndpoint = {
      url: 'http://localhost:9090',
      secret: 'secret',
    }
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

  it.each(['id', 'url', 'secret'])(
    'reconnects and clears live data when the endpoint %s changes',
    async (field) => {
      const scope = effectScope()
      scope.run(() => useBackendWebSocket().connect())
      const previous = [...MockWebSocket.instances]
      const oldMessage = previous[0]!.onmessage
      const oldClose = previous[0]!.onclose
      if (field === 'id') mockEndpointStore.selectedEndpoint = 'endpoint-b'
      if (field === 'url') {
        mockEndpointStore.currentEndpoint.url = 'http://other.invalid:9090'
      }
      if (field === 'secret')
        mockEndpointStore.currentEndpoint.secret = 'rotated'
      oldMessage?.({ data: '{"connections":[]}' } as MessageEvent<string>)
      expect(mockConnectionsStore.updateFromWsMsg).not.toHaveBeenCalled()
      await nextTick()

      expect(MockWebSocket.instances).toHaveLength(8)
      for (const socket of previous) expect(socket.close).toHaveBeenCalledOnce()
      expect(mockGlobalStore.setLatestTraffic).toHaveBeenCalledWith(null)
      expect(mockGlobalStore.setLatestMemory).toHaveBeenCalledWith(null)
      expect(mockGlobalStore.clearChartHistory).toHaveBeenCalledOnce()
      expect(mockLogsStore.clearLogs).toHaveBeenCalledOnce()
      if (field === 'url')
        expect(MockWebSocket.instances[4]!.url).toContain(
          'ws://other.invalid:9090/',
        )
      if (field === 'secret')
        expect(MockWebSocket.instances[4]!.url).toContain('token=rotated')
      oldMessage?.({ data: '{"connections":[]}' } as MessageEvent<string>)
      oldClose?.(new Event('close'))
      expect(mockConnectionsStore.updateFromWsMsg).not.toHaveBeenCalled()
      scope.stop()
    },
  )

  it('keeps an intentionally disconnected session closed after an endpoint change', async () => {
    const scope = effectScope()
    scope.run(() => {
      const session = useBackendWebSocket()
      session.connect()
      session.disconnect()
    })
    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()
    expect(MockWebSocket.instances).toHaveLength(4)
    scope.stop()
  })

  it('retains the stopped-kernel gate when an endpoint changes', async () => {
    mockHasFeature = (f) => f === 'kernel-control'
    mockKernelState = { status: 'stopped' }
    const scope = effectScope()
    scope.run(() => useBackendWebSocket().connect())
    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()
    expect(MockWebSocket.instances).toHaveLength(0)
    scope.stop()
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

  describe('desktop kernel-control gating', () => {
    it('opens no sockets when kernel-controlled and the kernel is not running', () => {
      mockHasFeature = (f) => f === 'kernel-control'
      mockKernelState = { status: 'stopped' }

      const { connect } = useBackendWebSocket()
      connect()

      // Clash API port is closed while the kernel is down — stay silent instead
      // of reconnect-looping on ERR_CONNECTION_REFUSED.
      expect(MockWebSocket.instances).toHaveLength(0)
    })

    it('opens no logs socket via reconnectLogs while the kernel is stopped', () => {
      mockHasFeature = (f) => f === 'kernel-control'
      mockKernelState = { status: 'stopped' }

      const { reconnectLogs } = useBackendWebSocket()
      reconnectLogs()

      expect(MockWebSocket.instances).toHaveLength(0)
    })

    it('opens sockets when kernel-controlled and the kernel is running', () => {
      mockHasFeature = (f) => f === 'kernel-control'
      mockKernelState = { status: 'running' }

      const { connect } = useBackendWebSocket()
      connect()

      expect(MockWebSocket.instances).toHaveLength(4)
    })

    it('does not reconnect once the kernel has stopped', async () => {
      vi.useFakeTimers()
      mockHasFeature = (f) => f === 'kernel-control'
      mockKernelState = { status: 'running' }

      const { connect } = useBackendWebSocket()
      connect()
      expect(MockWebSocket.instances).toHaveLength(4)

      // Kernel stops: its API port closes, dropping every socket.
      mockKernelState = { status: 'stopped' }
      for (const socket of [...MockWebSocket.instances]) {
        socket.onclose?.(new Event('close'))
      }
      await vi.advanceTimersByTimeAsync(4000)

      // No reconnect attempt while the kernel is down.
      expect(MockWebSocket.instances).toHaveLength(4)

      vi.useRealTimers()
    })
  })
})
