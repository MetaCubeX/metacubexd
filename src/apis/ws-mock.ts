// Mock WebSocket implementation for development mode
import { generateMockConnectionsMessage, mockLogs } from './definitions'

/**
 * Simulated WebSocket for mock mode
 */
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

  private sendInitialHistoryData(
    generateData: () => Record<string, unknown>,
    count: number,
    intervalMs: number,
  ) {
    // Send initial batch of historical data points to populate charts
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const data = generateData()

        this.dispatchEvent(
          'message',
          new MessageEvent('message', { data: JSON.stringify(data) }),
        )
      }, i * intervalMs)
    }
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
      const generateTraffic = () => ({
        up: Math.floor(Math.random() * 2097152), // 0-2MB/s
        down: Math.floor(Math.random() * 10485760), // 0-10MB/s
      })

      // Send 30 initial data points quickly to populate chart
      this.sendInitialHistoryData(generateTraffic, 30, 50)

      // Then continue with regular interval
      setTimeout(() => {
        this.intervalId = setInterval(() => {
          const data = generateTraffic()

          this.dispatchEvent(
            'message',
            new MessageEvent('message', { data: JSON.stringify(data) }),
          )
        }, 1000)
      }, 1500)
    } else if (urlPath.includes('memory')) {
      const generateMemory = () => ({
        inuse: 52428800 + Math.floor(Math.random() * 10485760), // 50-60MB
        oslimit: 0,
      })

      // Send 30 initial data points quickly to populate chart
      this.sendInitialHistoryData(generateMemory, 30, 50)

      // Then continue with regular interval
      setTimeout(() => {
        this.intervalId = setInterval(() => {
          const data = generateMemory()

          this.dispatchEvent(
            'message',
            new MessageEvent('message', { data: JSON.stringify(data) }),
          )
        }, 1000)
      }, 1500)
    } else if (urlPath.includes('logs')) {
      let logIndex = 0

      // Send initial batch of logs quickly to populate table
      for (let i = 0; i < 50; i++) {
        setTimeout(() => {
          const log = mockLogs[logIndex % mockLogs.length]

          this.dispatchEvent(
            'message',
            new MessageEvent('message', { data: JSON.stringify(log) }),
          )
          logIndex++
        }, i * 30)
      }

      // Then continue with regular interval
      setTimeout(() => {
        this.intervalId = setInterval(() => {
          const log = mockLogs[logIndex % mockLogs.length]

          this.dispatchEvent(
            'message',
            new MessageEvent('message', { data: JSON.stringify(log) }),
          )
          logIndex++
        }, 500)
      }, 1500)
    }
  }

  addEventListener(
    type: string,
    listener:
      | ((event: MessageEvent) => void)
      | EventListenerOrEventListenerObject,
  ) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }

    this.listeners.get(type)!.add(listener as (event: MessageEvent) => void)
  }

  removeEventListener(
    type: string,
    listener:
      | ((event: MessageEvent) => void)
      | EventListenerOrEventListenerObject,
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
