import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONNECTIVITY_TARGETS,
  STREAMING_UNLOCK_TARGETS,
  useReachabilityBoard,
} from '../useReachabilityBoard'

// Mock useRequest — mirror the useBatchLatencyTest spec so the delay endpoint is
// driven without touching the network.
const mockGet = vi.fn()
const mockJson = vi.fn()
mockGet.mockReturnValue({ json: mockJson })

vi.mock('../useApi', () => ({
  useRequest: () => ({
    get: mockGet,
  }),
}))

// Hoisted so the mock factory (runs before the module body) can reference it.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

describe('composables/useReachabilityBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReturnValue({ json: mockJson })
  })

  describe('preset target groups', () => {
    it('ships connectivity presets including Google / GitHub / Cloudflare', () => {
      const names = CONNECTIVITY_TARGETS.map((t) => t.name)
      expect(names).toContain('Google')
      expect(names).toContain('GitHub')
      expect(names).toContain('Cloudflare')
      // Every preset has a usable url.
      for (const target of CONNECTIVITY_TARGETS) {
        expect(target.url).toMatch(/^https?:\/\//)
      }
    })

    it('ships streaming/AI unlock presets including YouTube / Netflix / OpenAI / Gemini', () => {
      const names = STREAMING_UNLOCK_TARGETS.map((t) => t.name)
      expect(names).toContain('YouTube')
      expect(names).toContain('Netflix')
      expect(names).toContain('OpenAI')
      expect(names).toContain('Gemini')
      for (const target of STREAMING_UNLOCK_TARGETS) {
        expect(target.url).toMatch(/^https?:\/\//)
      }
    })
  })

  describe('initial state', () => {
    it('starts not running with empty results', () => {
      const { isRunning, results } = useReachabilityBoard()

      expect(isRunning.value).toBe(false)
      expect(results.value).toEqual({})
    })
  })

  describe('testTargetsThroughNode', () => {
    it('delay-tests each named target through the selected node via the Clash delay endpoint', async () => {
      mockJson.mockResolvedValue({ delay: 123 })

      const { testTargetsThroughNode } = useReachabilityBoard()

      await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
        { name: 'GitHub', url: 'https://github.example' },
      ])

      // One delay call per target, all routed through the same node name.
      expect(mockGet).toHaveBeenCalledTimes(2)
      expect(mockGet).toHaveBeenCalledWith(
        'proxies/Auto/delay',
        expect.objectContaining({
          searchParams: expect.objectContaining({
            url: 'https://google.example/204',
          }),
        }),
      )
      expect(mockGet).toHaveBeenCalledWith(
        'proxies/Auto/delay',
        expect.objectContaining({
          searchParams: expect.objectContaining({
            url: 'https://github.example',
          }),
        }),
      )
    })

    it('url-encodes node names with special characters', async () => {
      mockJson.mockResolvedValue({ delay: 50 })

      const { testTargetsThroughNode } = useReachabilityBoard()

      await testTargetsThroughNode('🇺🇸 Node/A', [
        { name: 'Google', url: 'https://google.example/204' },
      ])

      expect(mockGet).toHaveBeenCalledWith(
        `proxies/${encodeURIComponent('🇺🇸 Node/A')}/delay`,
        expect.anything(),
      )
    })

    it('passes the configured timeout to the delay endpoint', async () => {
      mockJson.mockResolvedValue({ delay: 80 })

      const { testTargetsThroughNode } = useReachabilityBoard()

      await testTargetsThroughNode(
        'Auto',
        [{ name: 'Google', url: 'https://google.example/204' }],
        { timeout: 8000 },
      )

      expect(mockGet).toHaveBeenCalledWith(
        'proxies/Auto/delay',
        expect.objectContaining({
          searchParams: expect.objectContaining({ timeout: 8000 }),
        }),
      )
    })

    it('records reachable + latency per target on success', async () => {
      mockJson
        .mockResolvedValueOnce({ delay: 111 })
        .mockResolvedValueOnce({ delay: 222 })

      const { testTargetsThroughNode, results } = useReachabilityBoard()

      const out = await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
        { name: 'GitHub', url: 'https://github.example' },
      ])

      expect(out).toEqual({
        Google: { reachable: true, latency: 111 },
        GitHub: { reachable: true, latency: 222 },
      })
      // State is exposed reactively too.
      expect(results.value).toEqual(out)
    })

    it('marks a target unreachable with null latency when the delay test fails', async () => {
      mockJson
        .mockResolvedValueOnce({ delay: 90 })
        .mockRejectedValueOnce(new Error('proxy unreachable'))

      const { testTargetsThroughNode, results } = useReachabilityBoard()

      const out = await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
        { name: 'Netflix', url: 'https://netflix.example' },
      ])

      expect(out.Google).toEqual({ reachable: true, latency: 90 })
      expect(out.Netflix).toEqual({ reachable: false, latency: null })
      expect(results.value.Netflix).toEqual({ reachable: false, latency: null })
    })

    it('treats a non-positive delay as unreachable', async () => {
      mockJson.mockResolvedValue({ delay: 0 })

      const { testTargetsThroughNode } = useReachabilityBoard()

      const out = await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
      ])

      expect(out.Google).toEqual({ reachable: false, latency: null })
    })

    it('toggles isRunning around the run and resets it afterwards', async () => {
      mockJson.mockResolvedValue({ delay: 100 })

      const { testTargetsThroughNode, isRunning } = useReachabilityBoard()

      const p = testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
      ])
      expect(isRunning.value).toBe(true)
      await p
      expect(isRunning.value).toBe(false)
    })

    it('does nothing and does not toast when no targets are given', async () => {
      const { testTargetsThroughNode } = useReachabilityBoard()

      const out = await testTargetsThroughNode('Auto', [])

      expect(out).toEqual({})
      expect(mockGet).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('does nothing and does not toast when no node is selected', async () => {
      const { testTargetsThroughNode } = useReachabilityBoard()

      const out = await testTargetsThroughNode('', [
        { name: 'Google', url: 'https://google.example/204' },
      ])

      expect(out).toEqual({})
      expect(mockGet).not.toHaveBeenCalled()
      expect(toast.error).not.toHaveBeenCalled()
    })

    it('toasts an error when every target is unreachable through the node', async () => {
      mockJson.mockRejectedValue(new Error('all down'))

      const { testTargetsThroughNode } = useReachabilityBoard()

      await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
        { name: 'GitHub', url: 'https://github.example' },
      ])

      expect(toast.error).toHaveBeenCalled()
    })

    it('does not toast an error when at least one target is reachable', async () => {
      mockJson
        .mockResolvedValueOnce({ delay: 100 })
        .mockRejectedValueOnce(new Error('one down'))

      const { testTargetsThroughNode } = useReachabilityBoard()

      await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
        { name: 'GitHub', url: 'https://github.example' },
      ])

      expect(toast.error).not.toHaveBeenCalled()
    })

    it('resets isRunning even when a target throws unexpectedly outside the per-target guard', async () => {
      // The request builder itself throwing must not leave the board stuck.
      mockGet.mockImplementationOnce(() => {
        throw new Error('builder boom')
      })

      const { testTargetsThroughNode, isRunning } = useReachabilityBoard()

      await testTargetsThroughNode('Auto', [
        { name: 'Google', url: 'https://google.example/204' },
      ])

      expect(isRunning.value).toBe(false)
    })
  })
})
