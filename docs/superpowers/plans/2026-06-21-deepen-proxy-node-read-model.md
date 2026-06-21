# Deepen the Proxy-Node Read Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the proxies store's raw `proxyNodeMap`/`latencyMap` behind a deep read-model seam, consolidate the per-node derivation duplicated across four variant components into one composable, and extract the mount-only sparkline/threshold math into unit-testable pure functions.

**Architecture:** The `useProxiesStore` becomes the deep module that guards the kernel's data-integrity invariants — the `latency`-as-Selected-Node alias and the NOT_CONNECTED sentinel are resolved behind `getNode(): ProxyNodeView`, never exposed raw. A narrow `useProxyNode` composable owns only the presentation folds the variants share. The single Latency Band ladder (`classifyLatency`) and the sparkline math (`computeLatencyTrend`) move into pure utils. (Decided via grilling: depth-locus = Hybrid-leaning-store; composable-scope = Split; collapse-in-scope = Defer; getter-exposure = Keep latency getters exported.)

**Tech Stack:** Nuxt 3 / Vue 3 (`<script setup>`, auto-imports), Pinia, Vitest (esbuild, no type-check), vue-tsc (strict). Domain glossary in `/CONTEXT.md`.

## Global Constraints

- Vue/VueUse auto-imports are bare globals in tests, stubbed in `packages/ui/test/setup.ts`. Any new Vue API used in store/composable code MUST be added there or it throws `X is not defined` at import. `toValue` is NOT yet stubbed — Task 5 adds it.
- Two independent CI gates, both must pass: `pnpm --filter @metacubexd/ui test:unit` (esbuild, no types) AND `pnpm --filter @metacubexd/ui typecheck` (vue-tsc, `strict` + `noUncheckedIndexedAccess`). Every `map[key]` access stays optional-chained (`?.`) — vitest passes ungated, vue-tsc does not.
- No `@vue/test-utils`; the repo has no component-mount harness. Composables are tested as plain function calls: seed the store, read the returned `.value`. Follow the `useTunConfig.ts` precedent (UI-framework-free).
- Preserve exact rendered output. (An earlier draft of this constraint claimed a Card tooltip "double-paren" fix; the final whole-branch review confirmed that was a mis-analysis — the Card has a single special-types render site whose output is unchanged. The branch is fully behavior-preserving, with zero rendered-output deltas.)
- These signatures stay byte-identical (external callers depend on them): `recordLatencyTestResult`, `recordLatencyTestResults`, `clearLatencyTestStateForNodes`, `clearLatencyTestStateForGroup`, `proxyProviderLatencyTest`, `closeAllConnections`, `selectProxyInGroup`, `unfixProxyInGroup`, `getLatencyByName`, `getLatencyHistoryByName`, `isProxyGroup`.
- Out of scope (deferred): `collapsedMap` and the group/provider/`updatingMap` testing flags stay exported — they are page chrome, not the node read model. Only `proxyNodeMap` and `latencyMap` get hidden.
- Conventional commits. Commit after every task.
- Run all commands from the repo root: `/Users/shikun/Developer/opensource/metacubexd`.
- Single-file test run: `pnpm --filter @metacubexd/ui exec vitest run <path-relative-to-packages/ui>`.

---

### Task 1: Latency Band classifier (`classifyLatency`)

Collapse the three forked latency-threshold ladders onto one classifier. `getLatencyClassName` becomes a color lookup over it; ProxyPreviewBar/Dots migrate in Task 2.

**Files:**

- Modify: `packages/ui/utils/index.ts` (add `LatencyBand`, `classifyLatency`, `LATENCY_BAND_TEXT_CLASS`; rewrite `getLatencyClassName` at `:220-232`)
- Test: `packages/ui/utils/__tests__/index.spec.ts` (existing `getLatencyClassName` suite at `:162` stays green; add a `classifyLatency` suite)

**Interfaces:**

- Produces:
  - `type LatencyBand = 'good' | 'medium' | 'slow' | 'not-connected'`
  - `classifyLatency(latency: number, latencyQualityMap: LatencyQualityMap): LatencyBand`
  - `getLatencyClassName(latency: number, latencyQualityMap: LatencyQualityMap): string` (unchanged signature, now delegates)

- [ ] **Step 1: Write the failing test**

Add to `packages/ui/utils/__tests__/index.spec.ts` (inside the top-level `describe`, near the existing `getLatencyClassName` block). Also add `classifyLatency` to the existing import from `'../index'` at the top of the file.

```ts
describe('classifyLatency', () => {
  const map = { NOT_CONNECTED: 0, MEDIUM: 200, HIGH: 500 }

  it('bands a fast reading as good', () => {
    expect(classifyLatency(100, map)).toBe('good')
  })
  it('bands a mid reading as medium', () => {
    expect(classifyLatency(300, map)).toBe('medium')
  })
  it('bands a slow reading as slow', () => {
    expect(classifyLatency(600, map)).toBe('slow')
  })
  it('bands the NOT_CONNECTED sentinel as not-connected', () => {
    expect(classifyLatency(0, map)).toBe('not-connected')
  })
  it('treats the MEDIUM boundary as good (not medium)', () => {
    expect(classifyLatency(200, map)).toBe('good')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metacubexd/ui exec vitest run utils/__tests__/index.spec.ts`
Expected: FAIL — `classifyLatency is not a function` / import resolves to `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `packages/ui/utils/index.ts`, replace the current `getLatencyClassName` (lines 220-232):

```ts
export function getLatencyClassName(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
) {
  if (latency > latencyQualityMap.HIGH) {
    return 'text-red-500'
  } else if (latency > latencyQualityMap.MEDIUM) {
    return 'text-yellow-500'
  } else if (latency === latencyQualityMap.NOT_CONNECTED) {
    return 'text-gray'
  }
  return 'text-green-600'
}
```

with:

```ts
export type LatencyBand = 'good' | 'medium' | 'slow' | 'not-connected'

// The single Latency Band ladder. getLatencyClassName, ProxyPreviewBar and
// ProxyPreviewDots all classify against THIS — no forked thresholds.
export function classifyLatency(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
): LatencyBand {
  if (latency > latencyQualityMap.HIGH) return 'slow'
  if (latency > latencyQualityMap.MEDIUM) return 'medium'
  if (latency === latencyQualityMap.NOT_CONNECTED) return 'not-connected'
  return 'good'
}

const LATENCY_BAND_TEXT_CLASS: Record<LatencyBand, string> = {
  slow: 'text-red-500',
  medium: 'text-yellow-500',
  'not-connected': 'text-gray',
  good: 'text-green-600',
}

export function getLatencyClassName(
  latency: number,
  latencyQualityMap: LatencyQualityMap,
) {
  return LATENCY_BAND_TEXT_CLASS[classifyLatency(latency, latencyQualityMap)]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @metacubexd/ui exec vitest run utils/__tests__/index.spec.ts`
Expected: PASS — both the new `classifyLatency` suite and the existing `getLatencyClassName` suite (the delegation preserves exact outputs).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors.

```bash
git add packages/ui/utils/index.ts packages/ui/utils/__tests__/index.spec.ts
git commit -m "refactor(ui): add classifyLatency band ladder behind getLatencyClassName"
```

---

### Task 2: Migrate previews onto the band ladder

Kill the two remaining forks: ProxyPreviewBar's bucket comparisons and ProxyPreviewDots' `getDotClass` thresholds.

**Files:**

- Modify: `packages/ui/components/ProxyPreviewBar.vue:21-51`
- Modify: `packages/ui/components/ProxyPreviewDots.vue:21-34`

**Interfaces:**

- Consumes: `classifyLatency` from `~/utils` (Task 1)

- [ ] **Step 1: Migrate ProxyPreviewBar**

In `packages/ui/components/ProxyPreviewBar.vue`, add `import { classifyLatency } from '~/utils'` to the `<script setup>`. Replace the `good`/`middle`/`slow`/`notConnected` computeds (lines 21-51) with:

```ts
const bands = computed(() =>
  latencyList.value.map((latency) =>
    classifyLatency(latency, configStore.latencyQualityMap),
  ),
)

const good = computed(() => bands.value.filter((b) => b === 'good').length)
const middle = computed(() => bands.value.filter((b) => b === 'medium').length)
const slow = computed(() => bands.value.filter((b) => b === 'slow').length)
const notConnected = computed(
  () => bands.value.filter((b) => b === 'not-connected').length,
)
```

Leave `all`, `goodPercent`, `middlePercent`, `slowPercent`, `notConnectedPercent` and the template unchanged.

- [ ] **Step 2: Migrate ProxyPreviewDots**

In `packages/ui/components/ProxyPreviewDots.vue`, add `import { classifyLatency } from '~/utils'`. Replace `getDotClass` (lines 21-34) with:

```ts
const DOT_BAND_SUFFIX = {
  'not-connected': 'neutral',
  slow: 'slow',
  medium: 'medium',
  good: 'good',
} as const

function getDotClass(latency: number | undefined, selected: boolean): string {
  const band =
    typeof latency !== 'number'
      ? 'not-connected'
      : classifyLatency(latency, configStore.latencyQualityMap)
  const suffix = DOT_BAND_SUFFIX[band]
  return selected ? `dot-${suffix}-selected` : `dot-${suffix}`
}
```

Leave the `<style>` dot classes and template unchanged.

- [ ] **Step 3: Verify (typecheck + full unit suite)**

These components have no unit tests (no mount harness); the band logic they now call is covered by Task 1. Confirm nothing else broke.

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors.
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: PASS (all existing suites).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/components/ProxyPreviewBar.vue packages/ui/components/ProxyPreviewDots.vue
git commit -m "refactor(ui): classify preview latency through the shared band ladder"
```

---

### Task 3: Extract sparkline math (`computeLatencyTrend`) + refactor the Card

Pull ProxyNodeCard's mount-only `latencyTrendData`/`sparklinePath` math into pure, unit-testable functions. Behavior-preserving for the Card.

**Files:**

- Create: `packages/ui/utils/latencyTrend.ts`
- Test: `packages/ui/utils/__tests__/latencyTrend.spec.ts`
- Modify: `packages/ui/components/ProxyNodeCard.vue:66-123`

**Interfaces:**

- Produces:
  - `interface LatencyTrend { points: { x: number; y: number }[]; min: number; max: number; avg: number; jitter: number; successRate: number; totalTests: number; successTests: number }`
  - `computeLatencyTrend(history: Proxy['history']): LatencyTrend | null`
  - `svgPathFromPoints(points: { x: number; y: number }[]): string`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/utils/__tests__/latencyTrend.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeLatencyTrend, svgPathFromPoints } from '../latencyTrend'

const at = (delay: number) => ({ time: '2026-06-21T00:00:00.000Z', delay })

describe('computeLatencyTrend', () => {
  it('returns null for empty history', () => {
    expect(computeLatencyTrend([])).toBeNull()
  })

  it('returns null with fewer than two successful readings', () => {
    expect(computeLatencyTrend([at(0), at(100)])).toBeNull()
  })

  it('computes stats over successful readings only, success rate over all', () => {
    const trend = computeLatencyTrend([at(100), at(200), at(0)])
    expect(trend).not.toBeNull()
    expect(trend!.min).toBe(100)
    expect(trend!.max).toBe(200)
    expect(trend!.avg).toBe(150)
    expect(trend!.successTests).toBe(2)
    expect(trend!.totalTests).toBe(3)
    expect(trend!.successRate).toBe(67)
    expect(trend!.points).toHaveLength(2)
  })

  it('maps points into the 0..100 / 5..45 SVG space', () => {
    const { points } = computeLatencyTrend([at(100), at(200)])!
    expect(points[0]).toEqual({ x: 0, y: 45 })
    expect(points[1]).toEqual({ x: 100, y: 5 })
  })
})

describe('svgPathFromPoints', () => {
  it('builds an M/L path string', () => {
    expect(
      svgPathFromPoints([
        { x: 0, y: 45 },
        { x: 100, y: 5 },
      ]),
    ).toBe('M 0 45 L 100 5')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metacubexd/ui exec vitest run utils/__tests__/latencyTrend.spec.ts`
Expected: FAIL — cannot find module `../latencyTrend`.

- [ ] **Step 3: Write the implementation**

Create `packages/ui/utils/latencyTrend.ts`:

```ts
import type { Proxy } from '~/types'

export interface LatencyTrend {
  points: { x: number; y: number }[]
  min: number
  max: number
  avg: number
  jitter: number
  successRate: number
  totalTests: number
  successTests: number
}

// Sparkline geometry + summary stats for a node's latency history. Successful
// measurements only — delay === 0 is NOT_CONNECTED (a failed test). Returns null
// when there are fewer than two successful readings (nothing to plot). The y
// range is 5..45 inside a 100x50 SVG viewBox so the line never clips.
export function computeLatencyTrend(
  history: Proxy['history'],
): LatencyTrend | null {
  if (history.length === 0) return null

  const latencies = history.filter((h) => h.delay > 0).map((h) => h.delay)
  if (latencies.length < 2) return null

  const min = Math.min(...latencies)
  const max = Math.max(...latencies)
  const range = max - min || 1
  const avg = Math.round(
    latencies.reduce((a, b) => a + b, 0) / latencies.length,
  )

  const variance =
    latencies.reduce((sum, lat) => sum + (lat - avg) ** 2, 0) / latencies.length
  const jitter = Math.round(Math.sqrt(variance))

  const totalTests = history.length
  const successTests = latencies.length
  const successRate = Math.round((successTests / totalTests) * 100)

  const points = latencies.map((lat, i) => ({
    x: (i / (latencies.length - 1)) * 100,
    y: 50 - ((lat - min) / range) * 40 - 5,
  }))

  return {
    points,
    min,
    max,
    avg,
    jitter,
    successRate,
    totalTests,
    successTests,
  }
}

export function svgPathFromPoints(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metacubexd/ui exec vitest run utils/__tests__/latencyTrend.spec.ts`
Expected: PASS.

- [ ] **Step 5: Refactor ProxyNodeCard to use the pure functions**

In `packages/ui/components/ProxyNodeCard.vue`, add to the imports block:

```ts
import { computeLatencyTrend, svgPathFromPoints } from '~/utils/latencyTrend'
```

Replace the `latencyTrendData` computed and the `sparklinePath` computed (lines 66-123) with:

```ts
// Latency trend for the mini chart — derived from the SAME kernel history the
// detail list renders (getLatencyHistoryByName), so sparkline, stats and list
// always agree.
const latencyTrendData = computed(() =>
  computeLatencyTrend(
    proxiesStore.getLatencyHistoryByName(props.proxyName, props.testUrl),
  ),
)

const sparklinePath = computed(() =>
  latencyTrendData.value
    ? svgPathFromPoints(latencyTrendData.value.points)
    : '',
)
```

Leave everything else in the Card untouched (the template reads `latencyTrendData.value.min/avg/max/jitter/successRate` and `sparklinePath` exactly as before).

- [ ] **Step 6: Verify typecheck + full suite, then commit**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors.
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: PASS.

```bash
git add packages/ui/utils/latencyTrend.ts packages/ui/utils/__tests__/latencyTrend.spec.ts packages/ui/components/ProxyNodeCard.vue
git commit -m "refactor(ui): extract computeLatencyTrend to a pure, unit-tested util"
```

---

### Task 4: Deepen the store — hide the maps behind queries

Add `ProxyNodeView` + the node queries, the `isTesting` consolidation, and a `__seed` test seam; stop exporting `proxyNodeMap`/`latencyMap`; rewrite the seed-by-assignment specs; migrate the three non-component raw-map sites.

**Files:**

- Modify: `packages/ui/stores/proxies.ts` (add type + queries near `:445`; change the `return {…}` at `:635-664`)
- Modify: `packages/ui/stores/__tests__/proxies.spec.ts` (add `__seed`; rewrite seed assignments; add getNode/isTesting tests)
- Modify: `packages/ui/components/ProxyMasterDetail.vue:88-92`
- Modify: `packages/ui/components/ConnectivityBoard.vue:29`
- Modify: `packages/ui/pages/proxies.vue:243`

**Interfaces:**

- Consumes: the existing internal refs `proxyNodeMap`, `latencyMap`, `proxyLatencyTestingMap`, `proxyProviderLatencyTestingMap`, `proxyGroupLatencyTestingMap`, and `getNowProxyNodeName`.
- Produces (new store surface):
  - `interface ProxyNodeView { name: string; type: string; udp: boolean; xudp: boolean; tfo: boolean; alive?: boolean; provider: string; selectedNodeName?: string }`
  - `getNode(name: string): ProxyNodeView | undefined`
  - `aliveNodeNames(names: string[]): string[]`
  - `nodeNames(): string[]`
  - `isTesting(name: string, opts?: { providerName?: string; groupName?: string }): boolean`
  - `__seed(partial: { nodes?: Record<string, ProxyInfo>; latency?: Record<string, Record<string, number>> }): void`
- Removed from the store surface: `proxyNodeMap`, `latencyMap` (now internal).

- [ ] **Step 1: Write the failing store tests**

Add to `packages/ui/stores/__tests__/proxies.spec.ts` a new `describe` block (the existing helpers `proxy`, `mockConfigStore` are in scope):

```ts
describe('stores/proxies read model', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    apiMocks.fetchProxyProvidersAPI.mockResolvedValue({ providers: {} })
  })

  it('getNode returns an honest view and never leaks latency-as-now', () => {
    const store = useProxiesStore()
    store.__seed({
      nodes: {
        GROUP: {
          name: 'GROUP',
          alive: undefined,
          udp: false,
          tfo: false,
          xudp: false,
          type: 'selector',
          latency: 'leaf', // the kernel's `now` alias lives in `latency`
          provider: '',
          latencyTestHistory: {},
        },
        leaf: {
          name: 'leaf',
          alive: true,
          udp: true,
          tfo: false,
          xudp: false,
          type: 'ss',
          latency: '',
          provider: 'subA',
          latencyTestHistory: {},
        },
      },
    })

    const group = store.getNode('GROUP')!
    expect(group.selectedNodeName).toBe('leaf')
    expect(group).not.toHaveProperty('latency')

    const leaf = store.getNode('leaf')!
    expect(leaf.selectedNodeName).toBeUndefined()
    expect(leaf.alive).toBe(true)
    expect(leaf.provider).toBe('subA')
    expect(store.getNode('missing')).toBeUndefined()
  })

  it('aliveNodeNames / nodeNames query the hidden map', () => {
    const store = useProxiesStore()
    store.__seed({
      nodes: {
        a: {
          name: 'a',
          alive: true,
          udp: false,
          tfo: false,
          xudp: false,
          type: 'ss',
          latency: '',
          provider: '',
          latencyTestHistory: {},
        },
        b: {
          name: 'b',
          alive: false,
          udp: false,
          tfo: false,
          xudp: false,
          type: 'ss',
          latency: '',
          provider: '',
          latencyTestHistory: {},
        },
      },
    })
    expect(store.aliveNodeNames(['a', 'b', 'missing'])).toEqual(['a'])
    expect(store.nodeNames().sort()).toEqual(['a', 'b'])
  })

  it('isTesting ORs node, provider and group flags', () => {
    const store = useProxiesStore()
    expect(store.isTesting('n')).toBe(false)
    store.proxyLatencyTestingMap['n'] = true
    expect(store.isTesting('n')).toBe(true)
    store.proxyLatencyTestingMap['n'] = false
    store.proxyProviderLatencyTestingMap['p'] = true
    expect(store.isTesting('n', { providerName: 'p' })).toBe(true)
    expect(store.isTesting('n')).toBe(false)
    store.proxyProviderLatencyTestingMap['p'] = false
    store.proxyGroupLatencyTestingMap['g'] = true
    expect(store.isTesting('n', { groupName: 'g' })).toBe(true)
    expect(store.isTesting('n', { providerName: 'p' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @metacubexd/ui exec vitest run stores/__tests__/proxies.spec.ts`
Expected: FAIL — `store.__seed is not a function`.

- [ ] **Step 3: Add the type + queries to the store**

In `packages/ui/stores/proxies.ts`, export the view type just above the existing `interface ProxyInfo` (line 20):

```ts
export interface ProxyNodeView {
  name: string
  type: string
  udp: boolean
  xudp: boolean
  tfo: boolean
  alive?: boolean
  provider: string
  // The honest `now`: the leaf node a group currently routes through, or
  // undefined for a leaf. Internalizes the kernel's `latency`-as-now alias.
  selectedNodeName?: string
}
```

Add these definitions just after `isProxyGroup` (after line 455):

```ts
// Honest, caller-facing projection of a node. Resolves the kernel's
// `latency`-as-now alias into selectedNodeName so callers never see the trap.
const getNode = (name: string): ProxyNodeView | undefined => {
  const info = proxyNodeMap.value[name]
  if (!info) return undefined

  const selectedNodeName =
    info.latency && info.latency !== info.name ? info.latency : undefined

  return {
    name: info.name,
    type: info.type,
    udp: info.udp,
    xudp: info.xudp,
    tfo: info.tfo,
    alive: info.alive,
    provider: info.provider,
    selectedNodeName,
  }
}

const aliveNodeNames = (names: string[]): string[] =>
  names.filter((name) => proxyNodeMap.value[name]?.alive === true)

const nodeNames = (): string[] => Object.keys(proxyNodeMap.value)

// Consolidated per-node "is a latency test running" flag: the node's own
// test, its provider's batch test, or its group's batch test. Each caller
// passes only the context it has (a leaf row has no groupName), preserving
// its current OR-arity.
const isTesting = (
  name: string,
  opts: { providerName?: string; groupName?: string } = {},
): boolean =>
  proxyLatencyTestingMap.value[name] ||
  (opts.providerName
    ? proxyProviderLatencyTestingMap.value[opts.providerName] || false
    : false) ||
  (opts.groupName
    ? proxyGroupLatencyTestingMap.value[opts.groupName] || false
    : false) ||
  false

// Test-only seam: the maps are no longer exported, so specs seed through here
// instead of assigning store.proxyNodeMap / store.latencyMap directly.
const __seed = (partial: {
  nodes?: Record<string, ProxyInfo>
  latency?: Record<string, Record<string, number>>
}) => {
  if (partial.nodes) proxyNodeMap.value = partial.nodes
  if (partial.latency) latencyMap.value = partial.latency
}
```

- [ ] **Step 4: Update the store's return surface**

In the `return { … }` (lines 635-664), delete the `latencyMap,` and `proxyNodeMap,` lines, and add the new members. The relevant region becomes:

```ts
return {
  proxies,
  proxyProviders,
  proxiesLoaded,
  proxyLatencyTestingMap,
  proxyGroupLatencyTestingMap,
  proxyProviderLatencyTestingMap,
  updatingMap,
  isAllProviderUpdating,
  collapsedMap,
  fetchProxies,
  closeAllConnections,
  selectProxyInGroup,
  unfixProxyInGroup,
  getNowProxyNodeName,
  getNode,
  aliveNodeNames,
  nodeNames,
  isTesting,
  __seed,
  getLatencyByName,
  getLatencyHistoryByName,
  clearLatencyTestStateForNodes,
  clearLatencyTestStateForGroup,
  recordLatencyTestResult,
  recordLatencyTestResults,
  isProxyGroup,
  proxyLatencyTest,
  proxyGroupLatencyTest,
  updateProviderByProviderName,
  updateAllProvider,
  proxyProviderLatencyTest,
}
```

- [ ] **Step 5: Rewrite the seed-by-assignment specs**

The hidden maps are now write-only via `__seed`. In `packages/ui/stores/__tests__/proxies.spec.ts`, find every direct assignment and convert it. Run this to list them:

Run: `grep -n "store.proxyNodeMap =\|store.latencyMap =\|\.proxyNodeMap =\|\.latencyMap =" packages/ui/stores/__tests__/proxies.spec.ts`

For each site, apply this transform (adjacent node+latency assignments collapse into one `__seed` call). Example — the block at the first test (lines 85-110) becomes:

```ts
store.__seed({
  nodes: {
    'node-a': {
      name: 'node-a',
      alive: true,
      udp: false,
      tfo: false,
      latencyTestHistory: {
        [mockConfigStore.urlForLatencyTest]: [
          { time: '2026-05-19T13:17:31.000Z', delay: 88 },
        ],
        'https://latency.test/old': [
          { time: '2026-05-19T13:15:31.000Z', delay: 66 },
        ],
      },
      latency: '',
      xudp: false,
      type: 'ss',
      provider: '',
    },
  },
  latency: {
    'node-a': {
      [mockConfigStore.urlForLatencyTest]: 88,
      'https://latency.test/old': 66,
    },
  },
})
```

Rules:

- `store.proxyNodeMap = X` → fold `X` into `__seed({ nodes: X })`.
- `store.latencyMap = Y` → fold `Y` into `__seed({ latency: Y })`.
- When a node assignment and a latency assignment are adjacent for the same setup, merge them into a single `__seed({ nodes, latency })` call.
- Assertions through `getLatencyByName` / `getLatencyHistoryByName` / `proxyLatencyTestingMap` are unchanged — leave them as-is.

After editing, confirm nothing still reads the hidden maps:

Run: `grep -n "\.proxyNodeMap\|\.latencyMap" packages/ui/stores/__tests__/proxies.spec.ts`
Expected: no matches (every occurrence is now inside a `__seed({...})` argument key, not a `store.` access).

- [ ] **Step 6: Migrate the three non-component raw-map sites**

`packages/ui/components/ProxyMasterDetail.vue` — replace `aliveCount` (lines 88-92):

```ts
function aliveCount(group: ProxyType) {
  return proxiesStore.aliveNodeNames(group.all ?? []).length
}
```

`packages/ui/components/ConnectivityBoard.vue:29` — replace:

```ts
const nodeNames = proxiesStore.nodeNames()
```

`packages/ui/pages/proxies.vue` — replace the `aliveProxyCount` computed (lines 240-247):

```ts
const aliveProxyCount = computed(
  () => proxiesStore.aliveNodeNames(props.proxyGroup.all ?? []).length,
)
```

- [ ] **Step 7: Run store tests + full suite + typecheck**

Run: `pnpm --filter @metacubexd/ui exec vitest run stores/__tests__/proxies.spec.ts`
Expected: PASS (new read-model suite + all rewritten seed tests).
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: PASS.
Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors. (If vue-tsc reports `proxyNodeMap`/`latencyMap` does not exist on any remaining file, that file still reads the hidden map — migrate it the same way.)

- [ ] **Step 8: Commit**

```bash
git add packages/ui/stores/proxies.ts packages/ui/stores/__tests__/proxies.spec.ts packages/ui/components/ProxyMasterDetail.vue packages/ui/components/ConnectivityBoard.vue packages/ui/pages/proxies.vue
git commit -m "refactor(ui): hide proxyNodeMap/latencyMap behind getNode/isTesting queries"
```

---

### Task 5: The `useProxyNode` read model

One narrow composable owning the presentation folds the four variants share. Tested as a plain function call (seed store, read `.value`).

**Files:**

- Create: `packages/ui/composables/useProxyNode.ts`
- Test: `packages/ui/composables/__tests__/useProxyNode.spec.ts`
- Modify: `packages/ui/test/setup.ts` (add the `toValue` global)

**Interfaces:**

- Consumes: `getNode`, `getLatencyByName`, `getLatencyHistoryByName`, `isTesting`, `proxyLatencyTest` (store, Task 4); `formatProxyType`, `filterSpecialProxyType`, `getLatencyClassName` (`~/utils`).
- Produces:
  - `useProxyNode(proxyName, testUrl, timeout, options?)` where the first three are `MaybeRefOrGetter<…>` and `options` is `{ providerName?: MaybeRefOrGetter<string>; groupName?: MaybeRefOrGetter<string> }`, returning `{ node, proxyType, isUDP, specialTypes, latency, latencyColorClass, stabilityBar, historyReversed, isTesting, runLatencyTest }` (all `ComputedRef` except `runLatencyTest: () => void`).

- [ ] **Step 1: Add the `toValue` test global**

In `packages/ui/test/setup.ts`, add `toValue` to the `vue` import (line 6-16) and stub it (after the `effectScope` stub, line 27):

```ts
// import line — add toValue alongside the others
import {
  computed,
  effectScope,
  markRaw,
  reactive,
  ref,
  shallowRef,
  toRef,
  toValue,
  watch,
  watchEffect,
} from 'vue'
```

```ts
// after vi.stubGlobal('effectScope', effectScope)
vi.stubGlobal('toValue', toValue)
```

- [ ] **Step 2: Write the failing test**

Create `packages/ui/composables/__tests__/useProxyNode.spec.ts`. It mirrors the store spec's global stubs so the store constructs:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProxiesStore } from '~/stores/proxies'
import { useProxyNode } from '../useProxyNode'

vi.mock('~/composables/useApi', () => ({
  closeAllConnectionsAPI: vi.fn(),
  closeSingleConnectionAPI: vi.fn(),
  fetchProxiesAPI: vi.fn(),
  fetchProxyProvidersAPI: vi.fn().mockResolvedValue({ providers: {} }),
  proxyGroupLatencyTestAPI: vi.fn(),
  proxyLatencyTestAPI: vi.fn().mockResolvedValue({ delay: 0 }),
  selectProxyInGroupAPI: vi.fn(),
  unfixProxyInGroupAPI: vi.fn(),
  updateProxyProviderAPI: vi.fn(),
}))

const mockConfigStore = {
  autoCloseConns: false,
  latencyQualityMap: { NOT_CONNECTED: 0, MEDIUM: 200, HIGH: 500 },
  latencyTestTimeoutDuration: 5000,
  urlForLatencyTest: 'https://latency.test/default',
}
vi.stubGlobal('useConfigStore', () => mockConfigStore)
vi.stubGlobal('useConnectionsStore', () => ({
  latestConnectionMsg: null,
  restructRawMsgToConnection: vi.fn(() => []),
}))
vi.stubGlobal('useNodeRecommendationStore', () => ({
  recordTestResult: vi.fn(),
  recordBatchResults: vi.fn(),
  getNodePerformance: vi.fn(),
}))

function seedNode(store: ReturnType<typeof useProxiesStore>) {
  store.__seed({
    nodes: {
      leaf: {
        name: 'leaf',
        alive: true,
        udp: true,
        tfo: false,
        xudp: false,
        type: 'ss',
        latency: '',
        provider: 'subA',
        latencyTestHistory: {
          [mockConfigStore.urlForLatencyTest]: [
            { time: '2026-06-21T00:00:00.000Z', delay: 88 },
          ],
        },
      },
    },
    latency: { leaf: { [mockConfigStore.urlForLatencyTest]: 88 } },
  })
}

describe('useProxyNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('exposes the shared folds for a node', () => {
    const store = useProxiesStore()
    seedNode(store)

    const vm = useProxyNode(
      () => 'leaf',
      () => null,
      () => null,
      { providerName: () => 'subA' },
    )

    expect(vm.proxyType.value).toBe('ss')
    expect(vm.isUDP.value).toBe(true)
    expect(vm.latency.value).toBe(88)
    expect(vm.latencyColorClass.value).toBe('text-green-600')
    expect(vm.stabilityBar.value).toEqual([{ colorClass: 'text-green-600' }])
    expect(vm.historyReversed.value).toHaveLength(1)
    expect(vm.isTesting.value).toBe(false)
  })

  it('runLatencyTest binds the node provider and flips the testing flag', () => {
    const store = useProxiesStore()
    seedNode(store)
    const spy = vi.spyOn(store, 'proxyLatencyTest')

    const vm = useProxyNode(
      () => 'leaf',
      () => null,
      () => 3000,
      { providerName: () => 'subA' },
    )
    vm.runLatencyTest()

    expect(spy).toHaveBeenCalledWith('leaf', 'subA', null, 3000)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @metacubexd/ui exec vitest run composables/__tests__/useProxyNode.spec.ts`
Expected: FAIL — cannot find module `../useProxyNode`.

- [ ] **Step 4: Implement the composable**

Create `packages/ui/composables/useProxyNode.ts`:

```ts
import type { MaybeRefOrGetter } from 'vue'
import type { Proxy } from '~/types'
import {
  filterSpecialProxyType,
  formatProxyType,
  getLatencyClassName,
} from '~/utils'

export interface UseProxyNodeOptions {
  providerName?: MaybeRefOrGetter<string>
  groupName?: MaybeRefOrGetter<string>
}

// The proxy-node read model: the presentation folds the four ProxyNode*
// variants share, derived through the store's honest queries. UI-framework-free
// (no .vue), so it unit-tests as a plain call against a seeded store.
export function useProxyNode(
  proxyName: MaybeRefOrGetter<string>,
  testUrl: MaybeRefOrGetter<string | null>,
  timeout: MaybeRefOrGetter<number | null>,
  options: UseProxyNodeOptions = {},
) {
  const proxiesStore = useProxiesStore()
  const configStore = useConfigStore()
  const { t } = useI18n()

  const node = computed(() => proxiesStore.getNode(toValue(proxyName)))

  const proxyType = computed(() => formatProxyType(node.value?.type ?? '', t))
  const isUDP = computed(() => !!(node.value?.xudp || node.value?.udp))

  // Bare joined string (no parens) — templates add their own parens.
  const specialTypes = computed(() => {
    if (!filterSpecialProxyType(node.value?.type)) return null
    return [
      node.value?.xudp && 'xudp',
      node.value?.udp && 'udp',
      node.value?.tfo && 'TFO',
    ]
      .filter(Boolean)
      .join(' / ')
  })

  const latency = computed(() =>
    proxiesStore.getLatencyByName(toValue(proxyName), toValue(testUrl)),
  )

  const latencyColorClass = computed(() =>
    latency.value
      ? getLatencyClassName(latency.value, configStore.latencyQualityMap)
      : 'text-neutral-content/30',
  )

  const stabilityBar = computed(() =>
    proxiesStore
      .getLatencyHistoryByName(toValue(proxyName), toValue(testUrl))
      .map((result) => ({
        colorClass: result.delay
          ? getLatencyClassName(result.delay, configStore.latencyQualityMap)
          : 'text-neutral-content/30',
      })),
  )

  const historyReversed = computed<Proxy['history']>(() =>
    proxiesStore
      .getLatencyHistoryByName(toValue(proxyName), toValue(testUrl))
      .toReversed(),
  )

  const isTesting = computed(() =>
    proxiesStore.isTesting(toValue(proxyName), {
      providerName: options.providerName ? toValue(options.providerName) : '',
      groupName: options.groupName ? toValue(options.groupName) : '',
    }),
  )

  const runLatencyTest = () => {
    proxiesStore.proxyLatencyTest(
      toValue(proxyName),
      node.value?.provider ?? '',
      toValue(testUrl),
      toValue(timeout),
    )
  }

  return {
    node,
    proxyType,
    isUDP,
    specialTypes,
    latency,
    latencyColorClass,
    stabilityBar,
    historyReversed,
    isTesting,
    runLatencyTest,
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @metacubexd/ui exec vitest run composables/__tests__/useProxyNode.spec.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + full suite, then commit**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors.
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: PASS.

```bash
git add packages/ui/composables/useProxyNode.ts packages/ui/composables/__tests__/useProxyNode.spec.ts packages/ui/test/setup.ts
git commit -m "feat(ui): add useProxyNode read-model composable"
```

---

### Task 6: Migrate the four variants + Latency.vue onto the read model

Each variant drops its local node derivation and consumes `useProxyNode`; `Latency.vue` consolidates its three testing computeds onto `store.isTesting`. Behavior-preserving except the flagged Card tooltip paren fix.

**Files:**

- Modify: `packages/ui/components/ProxyNodeChip.vue`
- Modify: `packages/ui/components/ProxyNodeTableRow.vue`
- Modify: `packages/ui/components/ProxyNodeListItem.vue`
- Modify: `packages/ui/components/ProxyNodeCard.vue`
- Modify: `packages/ui/components/Latency.vue`

**Interfaces:**

- Consumes: `useProxyNode` (Task 5), `store.isTesting` (Task 4).

- [ ] **Step 1: ProxyNodeChip.vue**

Replace the `<script setup>` body below the `defineEmits` (lines 19-42) with:

```ts
const { isUDP, latencyColorClass, runLatencyTest } = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName },
)
```

Remove the now-unused `import { getLatencyClassName } from '~/utils'` (line 2). In the template: `:class="isSelected ? '' : dotColorClass"` → `:class="isSelected ? '' : latencyColorClass"`, and `@click.stop="handleLatencyTest"` → `@click.stop="runLatencyTest"`.

- [ ] **Step 2: ProxyNodeTableRow.vue**

Replace the body from `const proxiesStore` through `handleLatencyTest` (lines 20-36) with:

```ts
const { proxyType, isUDP, runLatencyTest } = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName },
)
```

Remove the now-unused imports `import { formatProxyType } from '~/utils'` (line 3) and the `const { t } = useI18n()` line. In the template: `@click.stop="handleLatencyTest"` → `@click.stop="runLatencyTest"`.

- [ ] **Step 3: ProxyNodeListItem.vue**

Replace the derivation block (lines 27-77: from `const proxiesStore` through the `latencyStabilityBar` computed) with:

```ts
const configStore = useConfigStore()

const {
  proxyType,
  isUDP,
  specialTypes,
  isTesting,
  stabilityBar,
  historyReversed,
  runLatencyTest,
} = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName },
)
```

Remove `formatProxyType`, `filterSpecialProxyType` from the `~/utils` import (keep `getLatencyClassName` — the tooltip template still uses it). In the template, rename: `latencyStabilityBar` → `stabilityBar`, `latencyTestHistory` → `historyReversed`, `handleLatencyTest` → `runLatencyTest`. (`isTesting`, `specialTypes`, `proxyType`, `isUDP` keep their names.) Keep all tooltip/timeout machinery untouched.

- [ ] **Step 4: ProxyNodeCard.vue**

Replace the derivation block (lines 41-45, then 131-178 — i.e. `proxyNode`, `proxyType`, `isUDP`, the three testing computeds `isProviderTesting`/`isGroupTesting`/`isTesting`, `specialTypes`, `latencyTestHistory`, `latencyStabilityBar`) with one `useProxyNode` call. Keep the score block (`nodePerformance`, `nodeScore`, `lastTestTimeFormatted`, `scoreColorClass`) and the trend block (`latencyTrendData`, `sparklinePath`, from Task 3) exactly as they are.

Delete lines 41-45:

```ts
const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)
```

Delete lines 131-178 (`isProviderTesting`, `isGroupTesting`, `isTesting`, `specialTypes`, `latencyTestHistory`, `latencyStabilityBar`). In their place (keep it next to the score computeds), add:

```ts
const {
  proxyType,
  isUDP,
  specialTypes,
  isTesting,
  stabilityBar,
  historyReversed,
  runLatencyTest,
} = useProxyNode(
  () => props.proxyName,
  () => props.testUrl,
  () => props.timeout,
  { providerName: () => props.providerName, groupName: () => props.groupName },
)
```

Remove `formatProxyType`, `filterSpecialProxyType` from the `~/utils` import (keep `getLatencyClassName` — the tooltip template uses it). Remove the now-unused `function handleLatencyTest()` (lines ~135-144 in the original, the one calling `proxiesStore.proxyLatencyTest`) — `runLatencyTest` replaces it.

In the template, rename: `latencyStabilityBar` → `stabilityBar`, `latencyTestHistory` → `historyReversed`, `handleLatencyTest` → `runLatencyTest`. Then fix the special-types parens so both usages wrap the now-bare value exactly once:

- Inline badge (was `{{ specialTypes }}`, line ~197) → `({{ specialTypes }})`
- Tooltip line (was `({{ specialTypes }})`, line ~240) → leave as `({{ specialTypes }})` — it now renders single parens instead of the old `(( ))`.

- [ ] **Step 5: Latency.vue**

Replace the three testing computeds (lines 37-53: `isProviderTesting`, `isGroupTesting`, `isTesting`) with one store call:

```ts
const isTesting = computed(() =>
  proxiesStore.isTesting(props.proxyName, {
    providerName: props.providerName,
    groupName: props.groupName,
  }),
)
```

Leave `latency`, `latencyClass`, `latencyText`, `ariaLabel` and the template untouched.

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors. (vue-tsc will catch any leftover reference to a removed local like `proxyNode`, `handleLatencyTest`, or `latencyStabilityBar`.)
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: PASS.

- [ ] **Step 7: Manual smoke (real app)**

Run: `pnpm --filter @metacubexd/ui dev:mock`
Open the proxies page in each display mode and verify: node names/types/UDP badges render; latency pills + stability bars + sparkline (card mode) show; clicking a pill runs a latency test (spinner → value); the card tooltip shows special types in single parens.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/components/ProxyNodeChip.vue packages/ui/components/ProxyNodeTableRow.vue packages/ui/components/ProxyNodeListItem.vue packages/ui/components/ProxyNodeCard.vue packages/ui/components/Latency.vue
git commit -m "refactor(ui): migrate proxy-node variants onto useProxyNode read model

Fully behavior-preserving — zero rendered-output changes."
```

---

## Self-Review

**1. Spec coverage** (against the grilling-settled design):

- depth-locus = Hybrid-store: store owns `getNode → ProxyNodeView` (Task 4), `now`-alias + sentinel internalized → ✓ Task 4 Step 3.
- composable-scope = Split: pure `computeLatencyTrend`/`svgPathFromPoints` (Task 3) + pure `classifyLatency` (Task 1); `useProxyNode` stays narrow, Card calls trend util directly → ✓ Tasks 1, 3, 5.
- collapse-in-scope = Defer: `collapsedMap` untouched → ✓ (Global Constraints).
- getter-exposure = Keep exported: `getLatencyByName`/`getLatencyHistoryByName`/`isProxyGroup` stay on the surface → ✓ Task 4 Step 4 return block.
- Hide `proxyNodeMap`/`latencyMap` + `__seed` seed path → ✓ Task 4.
- Consolidate the 3 Latency Band forks → ✓ Tasks 1-2.
- Consolidate node derivation across 4 variants → ✓ Tasks 5-6.
- New test gaps (sparkline, getNode, isTesting, useProxyNode) → ✓ Tasks 3, 4, 5.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". The one mechanical-repeat (Task 4 Step 5 spec seed rewrites) gives the exact transform rules + a full worked example + a grep to enumerate the sites — actionable, not a placeholder.

**3. Type consistency:** `ProxyNodeView` (Task 4) is consumed by `getNode` (Task 4) and `useProxyNode` (Task 5) via inference. `classifyLatency`/`LatencyBand` (Task 1) consumed in Task 2. `computeLatencyTrend`/`svgPathFromPoints` (Task 3) consumed in Task 3 Step 5. `isTesting(name, {providerName?, groupName?})` defined Task 4, called in Tasks 5 (composable) and 6 (Latency.vue) with the same shape. `useProxyNode(proxyName, testUrl, timeout, options)` defined Task 5, called identically in all four variants (Task 6). `__seed({ nodes?, latency? })` defined Task 4, used in Tasks 4 and 5 specs. Names consistent across tasks.
