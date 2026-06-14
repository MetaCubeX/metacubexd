// packages/ui/stores/__tests__/kernel.spec.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKernelStore } from '../kernel'

const api = {
  getKernelStatus: vi.fn(),
  startKernel: vi.fn(),
  stopKernel: vi.fn(),
  restartKernel: vi.fn(),
  logsUrl: vi.fn(() => 'http://x/api/control/kernel/logs?token=t'),
}
vi.mock('~/composables/useControlApi', () => ({
  useControlApi: () => api,
}))

const running = {
  status: 'running' as const,
  pid: 1234,
  startedAt: 1000,
  version: 'v1.19.27',
  externalController: '127.0.0.1:9090',
  secret: 's',
}

describe('stores/kernel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    delete (globalThis as any).__lastEventSource
  })

  it('fetchStatus stores the returned KernelState', async () => {
    api.getKernelStatus.mockResolvedValue(running)
    const store = useKernelStore()
    await store.fetchStatus()
    expect(store.state?.status).toBe('running')
    expect(store.state?.pid).toBe(1234)
  })

  it('start/stop/restart store the returned state', async () => {
    api.startKernel.mockResolvedValue(running)
    api.stopKernel.mockResolvedValue({ ...running, status: 'stopped' })
    api.restartKernel.mockResolvedValue({ ...running, status: 'running' })
    const store = useKernelStore()
    await store.start()
    expect(store.state?.status).toBe('running')
    await store.stop()
    expect(store.state?.status).toBe('stopped')
    await store.restart()
    expect(store.state?.status).toBe('running')
  })

  it('connectLogs appends log frames and updates state from state frames', () => {
    const store = useKernelStore()
    store.connectLogs()
    const es = (globalThis as any).__lastEventSource
    es.emit(
      JSON.stringify({
        type: 'log',
        stream: 'stdout',
        line: 'hello',
        ts: 1,
      }),
    )
    es.emit(JSON.stringify({ type: 'state', ...running }))
    expect(store.logs).toHaveLength(1)
    expect(store.logs[0]!.line).toBe('hello')
    expect(store.state?.status).toBe('running')
    expect(store.connected).toBe(true)
  })

  it('caps the log ring buffer at 1000 entries', () => {
    const store = useKernelStore()
    store.connectLogs()
    const es = (globalThis as any).__lastEventSource
    for (let i = 0; i < 1050; i++) {
      es.emit(
        JSON.stringify({ type: 'log', stream: 'stdout', line: `l${i}`, ts: i }),
      )
    }
    expect(store.logs).toHaveLength(1000)
    expect(store.logs[0]!.line).toBe('l50')
    expect(store.logs[999]!.line).toBe('l1049')
  })

  it('disconnectLogs closes the EventSource and flips connected off', () => {
    const store = useKernelStore()
    store.connectLogs()
    const es = (globalThis as any).__lastEventSource
    store.disconnectLogs()
    expect(es.close).toHaveBeenCalled()
    expect(store.connected).toBe(false)
  })

  it('ignores malformed SSE frames without throwing', () => {
    const store = useKernelStore()
    store.connectLogs()
    const es = (globalThis as any).__lastEventSource
    expect(() => es.emit('not json')).not.toThrow()
    expect(store.logs).toHaveLength(0)
  })
})
