import { toast } from 'vue-sonner'
import { useRequest } from './useApi'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit tests
// it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// A named connectivity / unlock target. `name` is the human-facing label shown
// in the board; `url` is what mihomo fetches THROUGH the selected node.
export interface ReachabilityTarget {
  name: string
  url: string
}

// Per-target outcome. `reachable` is derived from the delay test (a positive
// delay means mihomo reached the URL through the node). `latency` is the
// reported delay in ms, or null when unreachable.
export interface ReachabilityResult {
  reachable: boolean
  latency: number | null
}

export interface ReachabilityTestOptions {
  timeout?: number
}

// Default client-side timeout for a single delay probe. mihomo aborts the probe
// itself; this just bounds the round trip.
const DEFAULT_REACHABILITY_TIMEOUT = 5000

// General connectivity presets. These answer a bare probe quickly, so a positive
// delay through the node is a reliable "reachable" signal.
export const CONNECTIVITY_TARGETS: ReachabilityTarget[] = [
  { name: 'Google', url: 'https://www.google.com/generate_204' },
  { name: 'Cloudflare', url: 'https://cp.cloudflare.com/generate_204' },
  { name: 'GitHub', url: 'https://github.com' },
]

// Streaming / AI unlock presets. NOTE: this is proxy-REACHABILITY (delay-test
// based), NOT full region-unlock detection — region-level unlock needs
// response-body inspection, which is out of scope here (see the UI note).
export const STREAMING_UNLOCK_TARGETS: ReachabilityTarget[] = [
  { name: 'YouTube', url: 'https://www.youtube.com/generate_204' },
  { name: 'Netflix', url: 'https://www.netflix.com' },
  { name: 'Disney+', url: 'https://www.disneyplus.com' },
  { name: 'OpenAI', url: 'https://chat.openai.com' },
  { name: 'Gemini', url: 'https://gemini.google.com' },
]

// Service reachability / multi-target connectivity board.
//
// For a selected node (or group) it runs the existing Clash API delay-test
// (`proxies/:name/delay?url=&timeout=`) against each named target — mihomo
// fetches the URL THROUGH that node and returns the delay — and reports a grid
// of reachable/latency per target.
export function useReachabilityBoard() {
  const { t } = useI18n()

  const isRunning = ref(false)
  const results = ref<Record<string, ReachabilityResult>>({})

  // Probe a single target through the node. Swallows transport errors into an
  // "unreachable" result so one bad target never aborts the rest of the board.
  const probeTarget = async (
    nodeName: string,
    target: ReachabilityTarget,
    timeout: number,
  ): Promise<ReachabilityResult> => {
    try {
      const request = useRequest()
      const { delay } = await request
        .get(`proxies/${encodeURIComponent(nodeName)}/delay`, {
          searchParams: { url: target.url, timeout },
          // The delay round trip can exceed ky's 5s default for slow nodes;
          // give the client a little headroom over the per-probe timeout.
          timeout: Math.max(10_000, timeout + 5_000),
        })
        .json<{ delay: number }>()

      // mihomo reports delay 0 when it could not reach the URL through the node.
      if (typeof delay === 'number' && delay > 0) {
        return { reachable: true, latency: delay }
      }
      return { reachable: false, latency: null }
    } catch {
      return { reachable: false, latency: null }
    }
  }

  // Delay-test every named target through the selected node and return a map of
  // target name -> result. Toasts when the node could not reach ANY target.
  const testTargetsThroughNode = async (
    nodeName: string,
    targets: ReachabilityTarget[],
    options?: ReachabilityTestOptions,
  ): Promise<Record<string, ReachabilityResult>> => {
    if (!nodeName || targets.length === 0) return {}

    const timeout = options?.timeout ?? DEFAULT_REACHABILITY_TIMEOUT

    isRunning.value = true
    // Reset the board for this node so stale rows from a previous run don't
    // linger while the fresh probes are in flight.
    results.value = {}

    try {
      const probed = await Promise.all(
        targets.map(async (target) => {
          const result = await probeTarget(nodeName, target, timeout)
          results.value = { ...results.value, [target.name]: result }
          return [target.name, result] as const
        }),
      )

      const out = Object.fromEntries(probed)

      // Only treat it as a hard failure when EVERY target was unreachable —
      // that points at the node itself, not an individual service. Surface it
      // via toast rather than swallowing it silently.
      const anyReachable = probed.some(([, result]) => result.reachable)
      if (!anyReachable) {
        toast.error(t('reachabilityAllUnreachable', { node: nodeName }))
      }

      return out
    } finally {
      isRunning.value = false
    }
  }

  return {
    isRunning,
    results,
    testTargetsThroughNode,
  }
}
