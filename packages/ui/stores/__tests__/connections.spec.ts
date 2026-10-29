import type { WsMsg } from '~/types'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { useConnectionsStore } from '../connections'

const dbMock = vi.hoisted(() => ({
  addLogs: vi.fn(),
  cleanup: vi.fn(),
  clearAll: vi.fn(),
}))

vi.mock('~/utils/db', () => ({ db: dbMock }))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

const mockGlobalStore = { clearChartHistory: vi.fn() }
const mockEndpointStore = reactive({ selectedEndpoint: 'endpoint-a' })
const mockConfigStore = reactive({ enableDataUsageTracking: true })

vi.stubGlobal('useGlobalStore', () => mockGlobalStore)
vi.stubGlobal('useEndpointStore', () => mockEndpointStore)
vi.stubGlobal('useConfigStore', () => mockConfigStore)

function makeConn(id: string, upload: number, download: number) {
  return {
    id,
    upload,
    download,
    chains: ['DIRECT'],
    metadata: {
      sourceIP: '10.0.0.1',
      host: 'example.com',
      destinationIP: '93.184.216.34',
      process: 'curl',
      inboundUser: 'user',
      type: 'http',
    },
  }
}

function makeMsg(
  uploadTotal: number,
  downloadTotal: number,
  connections: ReturnType<typeof makeConn>[],
): WsMsg {
  return { uploadTotal, downloadTotal, connections } as unknown as WsMsg
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorageMock.clear()
  mockEndpointStore.selectedEndpoint = 'endpoint-a'
  mockConfigStore.enableDataUsageTracking = true
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('stores/connections restart detection vs endpoint switch', () => {
  it('does not wipe usage history or chart when switching endpoints', async () => {
    const store = useConnectionsStore()

    // Backend A establishes a high cumulative baseline.
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))

    // Switch to backend B (SPA navigation, no page reload).
    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()

    // Backend B's first message has lower totals (a freshly started kernel).
    store.updateFromWsMsg(makeMsg(10, 20, [makeConn('c2', 5, 10)]))

    expect(dbMock.clearAll).not.toHaveBeenCalled()
    expect(mockGlobalStore.clearChartHistory).not.toHaveBeenCalled()
  })

  it('still detects a real kernel restart on the same endpoint', async () => {
    const store = useConnectionsStore()

    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    // Same endpoint, cumulative totals drop → genuine restart.
    store.updateFromWsMsg(makeMsg(10, 20, [makeConn('c1', 5, 10)]))

    expect(dbMock.clearAll).toHaveBeenCalled()
    expect(mockGlobalStore.clearChartHistory).toHaveBeenCalled()

    store.updateFromWsMsg(makeMsg(20, 40, [makeConn('c1', 15, 30)]))
    await vi.advanceTimersByTimeAsync(30000)
    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })
})

describe('stores/connections data usage baselines', () => {
  it('records only increments after the initial connection snapshot', async () => {
    const store = useConnectionsStore()

    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    await vi.advanceTimersByTimeAsync(30000)
    expect(dbMock.addLogs).not.toHaveBeenCalled()

    store.updateFromWsMsg(makeMsg(1010, 2020, [makeConn('c1', 510, 1020)]))
    await vi.advanceTimersByTimeAsync(30000)
    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })

  it('counts a new connection after an empty initial snapshot', async () => {
    const store = useConnectionsStore()

    store.updateFromWsMsg(makeMsg(1000, 2000, []))
    store.updateFromWsMsg(makeMsg(1010, 2020, [makeConn('c1', 10, 20)]))
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })

  it('includes the initial bytes of connections opened after tracking starts', async () => {
    const store = useConnectionsStore()

    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    store.updateFromWsMsg(
      makeMsg(1020, 2040, [makeConn('c1', 510, 1020), makeConn('c2', 10, 20)]),
    )
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 20, download: 40 }),
    ])
  })

  it('does not replay accumulated bytes after recreating the dashboard store', async () => {
    const firstStore = useConnectionsStore()
    firstStore.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    firstStore.updateFromWsMsg(makeMsg(1010, 2020, [makeConn('c1', 510, 1020)]))
    await vi.advanceTimersByTimeAsync(30000)

    setActivePinia(createPinia())
    const reloadedStore = useConnectionsStore()
    reloadedStore.updateFromWsMsg(
      makeMsg(1010, 2020, [makeConn('c1', 510, 1020)]),
    )
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledTimes(1)
    expect(dbMock.clearAll).not.toHaveBeenCalled()

    reloadedStore.updateFromWsMsg(
      makeMsg(1020, 2040, [makeConn('c1', 520, 1040)]),
    )
    await vi.advanceTimersByTimeAsync(30000)
    expect(dbMock.addLogs).toHaveBeenLastCalledWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })

  it('baselines existing connections when switching endpoints', async () => {
    const store = useConnectionsStore()
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))

    mockEndpointStore.selectedEndpoint = 'endpoint-b'
    await nextTick()
    store.updateFromWsMsg(makeMsg(100, 200, [makeConn('c2', 50, 100)]))
    store.updateFromWsMsg(makeMsg(110, 220, [makeConn('c2', 60, 120)]))
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
    expect(dbMock.clearAll).not.toHaveBeenCalled()
  })

  it('keeps the new baseline while clearing persisted history asynchronously', async () => {
    const store = useConnectionsStore()
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))
    store.updateFromWsMsg(makeMsg(1010, 2020, [makeConn('c1', 510, 1020)]))

    let finishClear!: () => void
    dbMock.clearAll.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishClear = resolve
      }),
    )
    const clearing = store.clearDataUsage()
    store.updateFromWsMsg(makeMsg(1020, 2040, [makeConn('c1', 520, 1040)]))
    finishClear()
    await clearing
    store.updateFromWsMsg(makeMsg(1030, 2060, [makeConn('c1', 530, 1060)]))
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })

  it('does not backfill traffic transferred while tracking was disabled', async () => {
    const store = useConnectionsStore()
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))

    mockConfigStore.enableDataUsageTracking = false
    store.updateFromWsMsg(makeMsg(1100, 2200, [makeConn('c1', 600, 1200)]))
    mockConfigStore.enableDataUsageTracking = true
    store.updateFromWsMsg(makeMsg(1200, 2400, [makeConn('c1', 700, 1400)]))
    store.updateFromWsMsg(makeMsg(1210, 2420, [makeConn('c1', 710, 1420)]))
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })

  it('resets the baseline when tracking is toggled between snapshots', async () => {
    const store = useConnectionsStore()
    store.updateFromWsMsg(makeMsg(1000, 2000, [makeConn('c1', 500, 1000)]))

    mockConfigStore.enableDataUsageTracking = false
    mockConfigStore.enableDataUsageTracking = true
    store.updateFromWsMsg(makeMsg(1200, 2400, [makeConn('c1', 700, 1400)]))
    store.updateFromWsMsg(makeMsg(1210, 2420, [makeConn('c1', 710, 1420)]))
    await vi.advanceTimersByTimeAsync(30000)

    expect(dbMock.addLogs).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ upload: 10, download: 20 }),
    ])
  })
})
