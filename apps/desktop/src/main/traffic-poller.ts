import type { ClashEndpoint } from './clash-config'

/**
 * Live traffic (up/down bytes-per-second) reader for the tray speed display.
 * The Clash API exposes `GET /traffic` as a chunked HTTP stream emitting one
 * JSON line per second (`{"up":n,"down":n}`), so no WebSocket client is needed
 * in the main process. The poller reconnects with a fixed delay while started
 * (a stopped kernel simply keeps it retrying quietly) and every failure is
 * silent — the tray degrades to no speed line, never to an error.
 */

export interface TrafficSample {
  up: number
  down: number
}

export interface TrafficPollerOptions {
  endpoint: ClashEndpoint
  onSample: (sample: TrafficSample) => void
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
  /** Delay before reconnecting after the stream ends/fails (default 5s). */
  retryDelayMs?: number
  /** Injectable delay for tests; defaults to setTimeout. */
  delay?: (ms: number) => Promise<void>
}

export interface TrafficPoller {
  start: () => void
  stop: () => void
}

const DEFAULT_RETRY_DELAY_MS = 5000

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/** Parse one `/traffic` stream line; null on anything malformed (never throws). */
export function parseTrafficLine(line: string): TrafficSample | null {
  try {
    const parsed = JSON.parse(line) as { up?: unknown; down?: unknown }
    if (typeof parsed.up !== 'number' || typeof parsed.down !== 'number') {
      return null
    }
    return { up: parsed.up, down: parsed.down }
  } catch {
    return null
  }
}

/**
 * Human-readable rate: `0B`, `999B`, `12.3K`, `1.2M`, `3.4G` (per-second units
 * implied by the tray context). Short on purpose — macOS menu-bar space is
 * precious and the value updates every second.
 */
export function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '0B'
  if (bytesPerSec < 1000) return `${Math.round(bytesPerSec)}B`
  const units = ['K', 'M', 'G', 'T']
  let value = bytesPerSec
  let unit = ''
  for (const u of units) {
    value /= 1024
    unit = u
    if (value < 1000) break
  }
  const text = value >= 100 ? String(Math.round(value)) : value.toFixed(1)
  return `${text}${unit}`
}

/** The tray title / tooltip speed line: `↑ 12.3K ↓ 1.2M`. */
export function formatTraySpeed(sample: TrafficSample): string {
  return `↑ ${formatRate(sample.up)} ↓ ${formatRate(sample.down)}`
}

/**
 * Stream `GET /traffic` and emit one sample per JSON line. start() is
 * idempotent; stop() aborts the in-flight request and halts reconnecting.
 * The whole loop is best-effort: connection errors, non-ok responses and
 * malformed lines are all swallowed (retry after `retryDelayMs`).
 */
export function createTrafficPoller(opts: TrafficPollerOptions): TrafficPoller {
  const fetchImpl = opts.fetchImpl ?? fetch
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const delay = opts.delay ?? defaultDelay
  let running = false
  let controller: AbortController | null = null

  async function readStream(signal: AbortSignal): Promise<void> {
    const { url, secret } = opts.endpoint
    const res = await fetchImpl(`${url}/traffic`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal,
    })
    if (!res.ok || !res.body) return
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        // The stream emits newline-separated JSON objects; the tail fragment
        // stays buffered until its newline arrives.
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const sample = parseTrafficLine(line.trim())
          if (sample && running) opts.onSample(sample)
        }
      }
    } finally {
      // Release the lock so an abort can't leave a stuck reader behind.
      reader.releaseLock()
    }
  }

  async function loop(): Promise<void> {
    // `for (;;)` not `while (running)`: `running` is flipped by stop() outside
    // this function, which the unmodified-loop-condition lint can't see.
    for (;;) {
      if (!running) return
      controller = new AbortController()
      try {
        await readStream(controller.signal)
      } catch {
        /* best-effort: network error / abort — fall through to the retry */
      }
      controller = null
      if (!running) return
      await delay(retryDelayMs)
    }
  }

  return {
    start: () => {
      if (running) return
      running = true
      void loop()
    },
    stop: () => {
      running = false
      controller?.abort()
      controller = null
    },
  }
}
