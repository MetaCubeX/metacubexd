import type { LatencyResult } from '~/types/network'

// Abort a probe that takes too long so it surfaces as an error (the UI shows
// "timeout") instead of spinning on 'pending' forever.
const LATENCY_TEST_TIMEOUT = 5000

// Default latency test targets.
// Use connectivity-check endpoints that answer a bare HEAD request with 204.
// Cloudflare's `cdn-cgi/trace` is a GET-only text endpoint (it 404s on HEAD and
// sits behind bot management), which made the Cloudflare probe report a false
// "timeout"; `cp.cloudflare.com/generate_204` is the captive-portal endpoint
// designed for exactly this kind of probe.
const DEFAULT_LATENCY_TARGETS = [
  { name: 'Google', url: 'https://www.google.com/generate_204' },
  { name: 'Cloudflare', url: 'https://cp.cloudflare.com/generate_204' },
  { name: 'GitHub', url: 'https://github.com' },
]

// Measure latency to a URL using fetch timing
async function measureLatency(url: string): Promise<number | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LATENCY_TEST_TIMEOUT)
  try {
    const startTime = performance.now()
    await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    const endTime = performance.now()

    return Math.round(endTime - startTime)
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

// Composable for network latency testing
export function useLatencyTest() {
  const results = ref<Map<string, LatencyResult>>(new Map())
  const isTestingAll = ref(false)
  const targets = ref(DEFAULT_LATENCY_TARGETS)

  // Test latency for a single URL
  async function testLatency(name: string, url: string) {
    results.value.set(url, {
      url,
      latency: null,
      status: 'pending',
      timestamp: Date.now(),
    })

    const latency = await measureLatency(url)

    results.value.set(url, {
      url,
      latency,
      status: latency !== null ? 'success' : 'error',
      timestamp: Date.now(),
    })

    return latency
  }

  // Test all configured targets
  async function testAllLatencies() {
    isTestingAll.value = true

    const promises = targets.value.map((target) =>
      testLatency(target.name, target.url),
    )

    await Promise.all(promises)
    isTestingAll.value = false
  }

  // Get result for a specific URL
  function getResult(url: string): LatencyResult | undefined {
    return results.value.get(url)
  }

  // Get all results as array
  const allResults = computed(() => {
    return targets.value.map((target) => ({
      name: target.name,
      url: target.url,
      result: results.value.get(target.url),
    }))
  })

  // Average latency of successful tests
  const averageLatency = computed(() => {
    const successful = Array.from(results.value.values()).filter(
      (r) => r.status === 'success' && r.latency !== null,
    )

    if (successful.length === 0) return null

    const sum = successful.reduce((acc, r) => acc + (r.latency ?? 0), 0)

    return Math.round(sum / successful.length)
  })

  return {
    results,
    isTestingAll,
    targets,
    testLatency,
    testAllLatencies,
    getResult,
    allResults,
    averageLatency,
  }
}
