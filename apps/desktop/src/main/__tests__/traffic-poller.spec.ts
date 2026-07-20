import { describe, expect, it, vi } from 'vitest'
import {
  createTrafficPoller,
  formatRate,
  formatTraySpeed,
  parseTrafficLine,
} from '../traffic-poller'

describe('parseTrafficLine', () => {
  it('parses a well-formed sample', () => {
    expect(parseTrafficLine('{"up":10,"down":20}')).toEqual({
      up: 10,
      down: 20,
    })
  })

  it('returns null when a field is missing or non-numeric', () => {
    expect(parseTrafficLine('{"up":10}')).toBeNull()
    expect(parseTrafficLine('{"up":"x","down":1}')).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    expect(parseTrafficLine('{oops')).toBeNull()
    expect(parseTrafficLine('')).toBeNull()
  })
})

describe('formatRate', () => {
  it('renders bytes below 1000 as whole bytes', () => {
    expect(formatRate(0)).toBe('0B')
    expect(formatRate(999)).toBe('999B')
  })

  it('renders K/M/G with one decimal below 100 and whole above', () => {
    expect(formatRate(1024)).toBe('1.0K')
    expect(formatRate(1024 * 150)).toBe('150K')
    expect(formatRate(1024 * 1024 * 2.5)).toBe('2.5M')
    expect(formatRate(1024 * 1024 * 1024 * 3)).toBe('3.0G')
  })

  it('guards against negative / non-finite input', () => {
    expect(formatRate(-5)).toBe('0B')
    expect(formatRate(Number.NaN)).toBe('0B')
  })
})

describe('formatTraySpeed', () => {
  it('renders the up/down arrows line', () => {
    expect(formatTraySpeed({ up: 1024, down: 1024 * 1024 })).toBe(
      '↑ 1.0K ↓ 1.0M',
    )
  })
})

/** A ReadableStream that yields each chunk (utf-8) then closes. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

describe('createTrafficPoller', () => {
  const endpoint = { url: 'http://127.0.0.1:9090', secret: 's3cr3t' }

  it('emits one sample per JSON line, buffering split fragments', async () => {
    const samples: { up: number; down: number }[] = []
    // Body split so one JSON object straddles two chunks — the buffer must
    // reassemble it before parsing.
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      body: streamOf(['{"up":1,"down":2}\n{"up":3,', '"down":4}\n']),
    })) as unknown as typeof fetch

    const poller = createTrafficPoller({
      endpoint,
      fetchImpl,
      onSample: (s) => samples.push(s),
      // Stop the loop instead of reconnecting once the (single) stream ends.
      delay: () => {
        poller.stop()
        return Promise.resolve()
      },
    })
    poller.start()
    // Let the stream drain (microtasks) before asserting.
    await vi.waitFor(() => expect(samples.length).toBe(2))
    expect(samples).toEqual([
      { up: 1, down: 2 },
      { up: 3, down: 4 },
    ])
    // Bearer header carried.
    const init = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![1] as RequestInit
    expect(init.headers).toMatchObject({ Authorization: 'Bearer s3cr3t' })
  })

  it('start() is idempotent (a second call does not open a second stream)', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      body: streamOf(['{"up":1,"down":1}\n']),
    })) as unknown as typeof fetch
    const poller = createTrafficPoller({
      endpoint,
      fetchImpl,
      onSample: () => {},
      delay: () => {
        poller.stop()
        return Promise.resolve()
      },
    })
    poller.start()
    poller.start()
    await vi.waitFor(() =>
      expect(
        (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
          .length,
      ).toBe(1),
    )
  })

  it('swallows a non-ok response and stops cleanly', async () => {
    const onSample = vi.fn()
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      body: null,
    })) as unknown as typeof fetch
    const poller = createTrafficPoller({
      endpoint,
      fetchImpl,
      onSample,
      delay: () => {
        poller.stop()
        return Promise.resolve()
      },
    })
    poller.start()
    await vi.waitFor(() =>
      expect(
        (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls
          .length,
      ).toBe(1),
    )
    expect(onSample).not.toHaveBeenCalled()
  })
})
