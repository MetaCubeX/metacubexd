import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLatencyTest } from '../useLatencyTest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('composables/useLatencyTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('reports success with a numeric latency when the probe resolves', async () => {
    mockFetch.mockResolvedValue({})

    const { testLatency, getResult } = useLatencyTest()
    const url = 'https://example.com/generate_204'

    await testLatency('Example', url)

    const result = getResult(url)
    expect(result?.status).toBe('success')
    expect(typeof result?.latency).toBe('number')
  })

  it('reports error (UI shows "timeout") when the probe rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'))

    const { testLatency, getResult } = useLatencyTest()
    const url = 'https://example.com/x'

    await testLatency('Example', url)

    expect(getResult(url)?.status).toBe('error')
    expect(getResult(url)?.latency).toBeNull()
  })

  it('aborts and reports error when the probe exceeds the timeout', async () => {
    vi.useFakeTimers()
    // A probe that never settles on its own — only the abort signal ends it.
    mockFetch.mockImplementation(
      (_url: string, opts: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          )
        }),
    )

    const { testLatency, getResult } = useLatencyTest()
    const url = 'https://slow.example.com'

    const pending = testLatency('Slow', url)
    await vi.advanceTimersByTimeAsync(6000) // past the 5s timeout
    await pending

    expect(getResult(url)?.status).toBe('error')
    expect(getResult(url)?.latency).toBeNull()
  })

  it('probes Cloudflare via a HEAD-friendly 204 endpoint', () => {
    // Regression guard for #1993: cdn-cgi/trace is GET-only (404s on HEAD) and
    // produced a false "timeout".
    const { targets } = useLatencyTest()
    const cloudflare = targets.value.find((t) => t.name === 'Cloudflare')
    expect(cloudflare?.url).toBe('https://cp.cloudflare.com/generate_204')
  })
})
