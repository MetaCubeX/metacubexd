# Proxies 页「节点多时」便利操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 节点数很多时增强 proxies 页操作便利：工具栏快捷排序 + master-detail 详情面板的地区筛选 / 内置搜索 / 定位当前选中。

**Architecture:** 排序复用现有 `configStore.proxiesOrderingType`，新增一个紧凑原生 `<select>` 组件挂到工具栏（比浮层下拉更省代码、原生键盘 a11y）。地区识别为纯函数 util（启发式：国旗 emoji / ISO 二字码），先 TDD。地区筛选 / 内置搜索 / 定位选中三者集中在 master-detail 右侧详情面板，均为组件本地态、切组复位；筛选逻辑全走已测的纯 util，组件只做装配。

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup>` + Pinia + Tailwind/DaisyUI + `@tabler/icons-vue` + vitest。所有命令在 `packages/ui/` 目录下执行。

## Global Constraints

- 工作目录：`/Users/shikun/Developer/opensource/metacubexd`，UI 包在 `packages/ui/`，命令均在 `packages/ui/` 下跑。
- 分支：`feat/proxies-many-nodes-convenience`（已创建，spec 已提交其上）。
- 提交规范：Conventional Commits（commitlint 校验），统一 `feat(proxies): …` / `test(proxies): …`。
- Nuxt 自动导入：`ref`/`computed`/`watch`/`watchEffect`/`nextTick`/`useConfigStore`/`useProxiesStore`/`useI18n` 及 `~/components` 下组件无需手动 import；仅 `~/utils`、`~/constants`、`@tabler/icons-vue` 需显式 import。
- i18n locale 共 7 个：`en zh ru ja ko fr fa`，新 key 必须全部补齐。
- 提交时 lint-staged 会自动跑 prettier，无需手动格式化。
- 不改设置弹窗里既有的排序 `<select>`（spec 明确保留）；不影响 card/list/table/chips 模式。

---

## Task 1: 地区识别纯函数 util（TDD）

**Files:**

- Modify: `packages/ui/utils/index.ts`（在 `filterProxiesByName` 之后追加）
- Test: `packages/ui/utils/__tests__/index.spec.ts`（追加 describe 块 + 扩展顶部 import）

**Interfaces:**

- Produces:
  - `export const REGION_OTHER = '__other__'`
  - `export function codeToFlag(code: string): string` — alpha-2 → 国旗 emoji
  - `export function parseNodeRegion(name: string): string | null` — alpha-2 码或 null
  - `export interface RegionFacet { code: string; flag: string; count: number }`
  - `export function getRegionFacets(names: string[]): RegionFacet[]`
  - `export function filterNodesByRegion(names: string[], selected: Set<string>): string[]`

- [ ] **Step 1: 写失败测试**

在 `packages/ui/utils/__tests__/index.spec.ts` 顶部 import 块（`from '../index'`）追加 `codeToFlag, filterNodesByRegion, getRegionFacets, parseNodeRegion, REGION_OTHER`，并在文件末尾追加：

```ts
describe('parseNodeRegion', () => {
  it('decodes a leading flag emoji', () => {
    expect(parseNodeRegion('🇸🇬SG_新加坡|🟡42|机房IP 4')).toBe('SG')
    expect(parseNodeRegion('🇯🇵 日本 05')).toBe('JP')
  })

  it('reads a leading ISO alpha-2 token', () => {
    expect(parseNodeRegion('JP-Narita-09bac5443211911c07-czyc')).toBe('JP')
    expect(parseNodeRegion('US_美国|🟢24|原生IP')).toBe('US')
    expect(parseNodeRegion('DE-Dreieich-09bac52a921b4b2b87-cvfw')).toBe('DE')
    expect(parseNodeRegion('HK-Lai Tak Tsuen-h-15211021-czzm')).toBe('HK')
  })

  it('returns null for unrecognized names', () => {
    expect(parseNodeRegion('sg01-reality')).toBeNull()
    expect(parseNodeRegion('claw1-reality')).toBeNull()
    expect(parseNodeRegion('日本 05')).toBeNull()
  })
})

describe('codeToFlag', () => {
  it('maps alpha-2 to flag emoji', () => {
    expect(codeToFlag('JP')).toBe('🇯🇵')
    expect(codeToFlag('SG')).toBe('🇸🇬')
  })
})

describe('getRegionFacets', () => {
  it('counts regions, sorts by count desc, Other last', () => {
    const facets = getRegionFacets(['🇸🇬SG a', '🇸🇬SG b', 'JP-x', 'sg01-reality'])
    expect(facets.map((f) => [f.code, f.count])).toEqual([
      ['SG', 2],
      ['JP', 1],
      [REGION_OTHER, 1],
    ])
    expect(facets[0].flag).toBe('🇸🇬')
    expect(facets[2].flag).toBe('')
  })
})

describe('filterNodesByRegion', () => {
  const names = ['🇸🇬SG a', 'JP-x', 'sg01-reality']

  it('passes through on an empty set', () => {
    expect(filterNodesByRegion(names, new Set())).toBe(names)
  })

  it('keeps only selected regions', () => {
    expect(filterNodesByRegion(names, new Set(['JP']))).toEqual(['JP-x'])
    expect(filterNodesByRegion(names, new Set([REGION_OTHER]))).toEqual([
      'sg01-reality',
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run utils/__tests__/index.spec.ts`
Expected: FAIL —「parseNodeRegion is not a function」之类（导出尚不存在）。

- [ ] **Step 3: 实现**

在 `packages/ui/utils/index.ts` 的 `filterProxiesByName`（约 358–362 行）之后追加：

```ts
// ponytail: heuristic region detection — a leading flag emoji or a leading
// ISO-3166 alpha-2 code token. Names with neither fall to REGION_OTHER.
// Upgrade path: extend ISO_CODES / add a provider-prefix map if real configs
// use non-standard region tokens.
export const REGION_OTHER = '__other__'

const FLAG_OFFSET = 0x1f1e6 // regional indicator 'A'
const A_CHARCODE = 0x41 // 'A'

// Common proxy-region ISO codes accepted as a *leading text token* (e.g.
// "JP-Narita…"). Gating the text path to a known set avoids matching random
// two-letter prefixes ("AI-…"). Flag emoji are decoded unconditionally.
const ISO_CODES = new Set([
  'US',
  'JP',
  'SG',
  'HK',
  'TW',
  'KR',
  'DE',
  'GB',
  'UK',
  'FR',
  'NL',
  'CA',
  'AU',
  'RU',
  'IN',
  'BR',
  'IT',
  'ES',
  'CH',
  'SE',
  'TR',
  'VN',
  'TH',
  'MY',
  'PH',
  'ID',
  'AR',
  'MX',
  'ZA',
  'AE',
  'IE',
  'PL',
  'FI',
  'NO',
  'DK',
  'AT',
])

// Two leading regional-indicator code points → alpha-2 code, else null.
function leadingFlagToCode(name: string): string | null {
  const cps = [...name]
  const first = cps[0]?.codePointAt(0) ?? 0
  const second = cps[1]?.codePointAt(0) ?? 0
  const inRange = (c: number) => c >= FLAG_OFFSET && c <= FLAG_OFFSET + 25
  if (inRange(first) && inRange(second)) {
    return (
      String.fromCharCode(A_CHARCODE + (first - FLAG_OFFSET)) +
      String.fromCharCode(A_CHARCODE + (second - FLAG_OFFSET))
    )
  }
  return null
}

// alpha-2 code → flag emoji (always renderable in a chip).
export function codeToFlag(code: string): string {
  if (code.length !== 2) return ''
  return [...code.toUpperCase()]
    .map((c) =>
      String.fromCodePoint(FLAG_OFFSET + (c.charCodeAt(0) - A_CHARCODE)),
    )
    .join('')
}

// Region of a node name (alpha-2 code), or null when unrecognized.
export function parseNodeRegion(name: string): string | null {
  const flagCode = leadingFlagToCode(name)
  if (flagCode) return flagCode

  const match = name.match(/^([A-Za-z]{2})[_\-\s]/)
  if (match) {
    const code = match[1].toUpperCase()
    if (ISO_CODES.has(code)) return code
  }
  return null
}

export interface RegionFacet {
  code: string // alpha-2 code, or REGION_OTHER
  flag: string // emoji for real codes, '' for REGION_OTHER
  count: number
}

// Region facets for a node-name list, sorted by count desc then code asc.
// Unrecognized names collapse into a single REGION_OTHER facet, kept last.
export function getRegionFacets(names: string[]): RegionFacet[] {
  const counts = new Map<string, number>()
  for (const name of names) {
    const code = parseNodeRegion(name) ?? REGION_OTHER
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      flag: code === REGION_OTHER ? '' : codeToFlag(code),
      count,
    }))
    .sort((a, b) => {
      if (a.code === REGION_OTHER) return 1
      if (b.code === REGION_OTHER) return -1
      return b.count - a.count || a.code.localeCompare(b.code)
    })
}

// Keep only nodes whose region is in `selected` (alpha-2 codes and/or
// REGION_OTHER). Empty set imposes no constraint (returns the input ref).
export function filterNodesByRegion(
  names: string[],
  selected: Set<string>,
): string[] {
  if (selected.size === 0) return names
  return names.filter((n) => selected.has(parseNodeRegion(n) ?? REGION_OTHER))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run utils/__tests__/index.spec.ts`
Expected: PASS（新增 5 个 describe 全绿，原有用例不受影响）。

- [ ] **Step 5: 提交**

```bash
git add packages/ui/utils/index.ts packages/ui/utils/__tests__/index.spec.ts
git commit -m "feat(proxies): add heuristic node-region parsing utils"
```

---

## Task 2: `PROXIES_ORDERING_TYPE_ORDER` 常量（TDD）

**Files:**

- Modify: `packages/ui/constants/index.ts`（紧接 `PROXIES_ORDERING_TYPE` enum，约 77 行之后）
- Test: `packages/ui/constants/__tests__/proxiesOrdering.spec.ts`（新建）

**Interfaces:**

- Consumes: `PROXIES_ORDERING_TYPE`（已存在，`constants/index.ts:69`）
- Produces: `export const PROXIES_ORDERING_TYPE_ORDER: PROXIES_ORDERING_TYPE[]`

- [ ] **Step 1: 写失败测试**

新建 `packages/ui/constants/__tests__/proxiesOrdering.spec.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { PROXIES_ORDERING_TYPE, PROXIES_ORDERING_TYPE_ORDER } from '../index'

describe('pROXIES_ORDERING_TYPE_ORDER', () => {
  it('lists every ordering once, no duplicates/omissions', () => {
    expect(PROXIES_ORDERING_TYPE_ORDER).toEqual([
      PROXIES_ORDERING_TYPE.NATURAL,
      PROXIES_ORDERING_TYPE.LATENCY_ASC,
      PROXIES_ORDERING_TYPE.LATENCY_DESC,
      PROXIES_ORDERING_TYPE.QUALITY_ASC,
      PROXIES_ORDERING_TYPE.QUALITY_DESC,
      PROXIES_ORDERING_TYPE.NAME_ASC,
      PROXIES_ORDERING_TYPE.NAME_DESC,
    ])
    const unique = new Set(PROXIES_ORDERING_TYPE_ORDER)
    expect(unique.size).toBe(Object.values(PROXIES_ORDERING_TYPE).length)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run constants/__tests__/proxiesOrdering.spec.ts`
Expected: FAIL —「PROXIES_ORDERING_TYPE_ORDER」未导出。

- [ ] **Step 3: 实现**

在 `packages/ui/constants/index.ts` 的 `PROXIES_ORDERING_TYPE` enum 结束（`}` 约 77 行）之后追加：

```ts
// Order of options in the proxies-page sort control. Single source of truth so
// a new ordering can never be silently missing from the dropdown (mirrors
// RULES_ORDERING_TYPE_ORDER).
export const PROXIES_ORDERING_TYPE_ORDER: PROXIES_ORDERING_TYPE[] = [
  PROXIES_ORDERING_TYPE.NATURAL,
  PROXIES_ORDERING_TYPE.LATENCY_ASC,
  PROXIES_ORDERING_TYPE.LATENCY_DESC,
  PROXIES_ORDERING_TYPE.QUALITY_ASC,
  PROXIES_ORDERING_TYPE.QUALITY_DESC,
  PROXIES_ORDERING_TYPE.NAME_ASC,
  PROXIES_ORDERING_TYPE.NAME_DESC,
]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run constants/__tests__/proxiesOrdering.spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add packages/ui/constants/index.ts packages/ui/constants/__tests__/proxiesOrdering.spec.ts
git commit -m "feat(proxies): add PROXIES_ORDERING_TYPE_ORDER constant"
```

---

## Task 3: 工具栏快捷排序组件 `ProxiesSortSelect.vue`

**Files:**

- Create: `packages/ui/components/ProxiesSortSelect.vue`
- Modify: `packages/ui/pages/proxies.vue`（工具栏，约 743 行 `<ProxiesDisplayModeSwitcher />` 之后挂载）

**Interfaces:**

- Consumes: `PROXIES_ORDERING_TYPE_ORDER`（Task 2）、`configStore.proxiesOrderingType`（已存在）
- Produces: 自动导入组件 `<ProxiesSortSelect />`（无 props）

> 说明：用原生 `<select>`（非浮层下拉），比 spec 里「镜像 LangSwitcher」更省代码且原生键盘 a11y，沿用 ConnectionsToolbar 的 sort `<select>` 范式。选项标签复用既有 `order*` i18n key，故本 Task 无新 i18n key。

- [ ] **Step 1: 新建组件**

新建 `packages/ui/components/ProxiesSortSelect.vue`：

```vue
<script setup lang="ts">
import { IconArrowsSort } from '@tabler/icons-vue'
import { PROXIES_ORDERING_TYPE_ORDER } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()
</script>

<template>
  <label
    class="flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 px-2.5 text-base-content/70 transition-all duration-200 focus-within:border-primary/40 hover:border-primary/30 hover:text-primary"
    :title="t('sortBy')"
  >
    <IconArrowsSort :size="16" class="shrink-0 opacity-60" />
    <select
      v-model="configStore.proxiesOrderingType"
      class="max-w-32 cursor-pointer appearance-none bg-transparent text-sm outline-none sm:max-w-44"
      :aria-label="t('sortBy')"
    >
      <option
        v-for="type in PROXIES_ORDERING_TYPE_ORDER"
        :key="type"
        :value="type"
      >
        {{ t(type) }}
      </option>
    </select>
  </label>
</template>
```

- [ ] **Step 2: 挂载到工具栏**

在 `packages/ui/pages/proxies.vue` 工具栏「Action Buttons」区，`<ProxiesDisplayModeSwitcher />`（约 743 行）紧下一行插入：

```html
<ProxiesSortSelect />
```

（无 `v-if`：两个 tab 都显示，provider 排序也走同一 `proxiesOrderingType`。）

- [ ] **Step 3: 跑整套单测 + lint 确认不回归**

Run: `pnpm test:unit && pnpm lint`
Expected: 全绿、无 ESLint 报错。

- [ ] **Step 4: 手动验证**

启动 dev（`pnpm dev`），打开 `/proxies`：

- 工具栏出现排序下拉，默认选中「按质量从高到低」（`QUALITY_DESC`）。
- 切到「按延迟从低到高」→ 各组节点立即按延迟升序重排。
- 切到 proxyProviders tab，下拉仍在且生效。
- 打开设置弹窗，原排序 `<select>` 与工具栏下拉值同步（双向）。

- [ ] **Step 5: 提交**

```bash
git add packages/ui/components/ProxiesSortSelect.vue packages/ui/pages/proxies.vue
git commit -m "feat(proxies): surface quick sort control in the toolbar"
```

---

## Task 4: master-detail 详情面板「多节点工作台」

**Files:**

- Modify (整文件替换): `packages/ui/components/ProxyMasterDetail.vue`
- Modify: `packages/ui/i18n/locales/{en,zh,ru,ja,ko,fr,fa}.json`（各加 2 个 key）

**Interfaces:**

- Consumes: `getRegionFacets` / `filterNodesByRegion` / `REGION_OTHER`（Task 1）、`filterProxiesByName` / `formatProxyType` / `resolveActiveGroup`（已存在）、`proxiesStore`、`ProxyNodeListItem`（自动导入）
- Produces: 无对外接口（页面级布局组件）

- [ ] **Step 1: 加 i18n key（7 个 locale）**

每个 `packages/ui/i18n/locales/<lang>.json` 在既有 `"clear"` 键所在对象内追加下面两个键（lint-staged 的 prettier 会处理格式/逗号）：

| lang | 追加内容                                                            |
| ---- | ------------------------------------------------------------------- |
| en   | `"jumpToCurrent": "Jump to current",` 和 `"regionOther": "Other",`  |
| zh   | `"jumpToCurrent": "跳到当前",` 和 `"regionOther": "其他",`          |
| ru   | `"jumpToCurrent": "К текущему",` 和 `"regionOther": "Другое",`      |
| ja   | `"jumpToCurrent": "現在のノードへ",` 和 `"regionOther": "その他",`  |
| ko   | `"jumpToCurrent": "현재 노드로",` 和 `"regionOther": "기타",`       |
| fr   | `"jumpToCurrent": "Aller à l'actuel",` 和 `"regionOther": "Autre",` |
| fa   | `"jumpToCurrent": "رفتن به فعلی",` 和 `"regionOther": "سایر",`      |

- [ ] **Step 2: 整文件替换 `ProxyMasterDetail.vue`**

把 `packages/ui/components/ProxyMasterDetail.vue` 全文替换为：

```vue
<script setup lang="ts">
import type { Proxy as ProxyType } from '~/types'
import {
  IconChevronRight,
  IconSearch,
  IconTarget,
  IconX,
} from '@tabler/icons-vue'
import {
  filterNodesByRegion,
  filterProxiesByName,
  formatProxyType,
  getRegionFacets,
  resolveActiveGroup,
} from '~/utils'

interface Props {
  groups: ProxyType[]
  sortedNamesByGroup: Record<string, string[]>
}

const props = defineProps<Props>()

const proxiesStore = useProxiesStore()
const { t } = useI18n()

const groupNames = computed(() => props.groups.map((g) => g.name))

const activeName = ref<string | null>(null)
// Keep active valid as the group list changes (e.g. on refetch).
watchEffect(() => {
  activeName.value = resolveActiveGroup(groupNames.value, activeName.value)
})

const activeGroup = computed(
  () => props.groups.find((g) => g.name === activeName.value) ?? null,
)
const activeNodes = computed(() =>
  activeGroup.value
    ? props.sortedNamesByGroup[activeGroup.value.name] || []
    : [],
)

// --- Local workbench state (scoped to the active group; reset on switch) ---
const localKeyword = ref('')
const selectedRegions = ref<Set<string>>(new Set())

// Region facets derived from the (sorted/globally-filtered) group node list, so
// chip counts stay stable as region/keyword filters narrow the displayed list.
const regionFacets = computed(() => getRegionFacets(activeNodes.value))

const displayNodes = computed(() =>
  filterProxiesByName(
    filterNodesByRegion(activeNodes.value, selectedRegions.value),
    localKeyword.value,
  ),
)

const selectedVisible = computed(
  () =>
    !!activeGroup.value?.now &&
    displayNodes.value.includes(activeGroup.value.now),
)

function toggleRegion(code: string) {
  const next = new Set(selectedRegions.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  selectedRegions.value = next
}

// Scroll container for the right detail; the selected row carries
// data-selected="true" (a fallthrough attr on ProxyNodeListItem's root).
const detailEl = ref<HTMLElement | null>(null)
function scrollSelectedIntoView(behavior: ScrollBehavior = 'smooth') {
  detailEl.value
    ?.querySelector('[data-selected="true"]')
    ?.scrollIntoView({ block: 'center', behavior })
}

// On group switch: reset local filters and reveal the selected node.
watch(activeName, () => {
  localKeyword.value = ''
  selectedRegions.value = new Set()
  nextTick(() => scrollSelectedIntoView('auto'))
})

function aliveCount(group: ProxyType) {
  return (
    group.all?.filter((n) => proxiesStore.proxyNodeMap[n]?.alive === true)
      .length ?? 0
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 sm:flex-row">
    <!-- Group navigation: horizontal strip on mobile, left rail on >=sm -->
    <div
      class="flex shrink-0 gap-1 overflow-x-auto pb-1 sm:w-48 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pb-0"
    >
      <button
        v-for="group in groups"
        :key="group.name"
        type="button"
        class="flex w-36 shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200 sm:w-auto sm:shrink"
        :class="
          group.name === activeName
            ? 'border-primary/55 bg-primary/12 text-base-content'
            : 'border-base-content/8 bg-base-200/60 text-base-content/70 hover:border-primary/30 hover:bg-primary/8'
        "
        @click="activeName = group.name"
      >
        <span class="flex items-center justify-between gap-2">
          <span class="truncate text-sm font-semibold">{{ group.name }}</span>
          <span class="shrink-0 text-[0.7rem] text-base-content/50">
            {{ aliveCount(group) }}/{{ group.all?.length ?? 0 }}
          </span>
        </span>
        <span class="hidden truncate text-xs text-base-content/45 sm:block">{{
          group.now
        }}</span>
      </button>
    </div>

    <!-- Right detail: active group's nodes + workbench bar -->
    <div
      v-if="activeGroup"
      ref="detailEl"
      class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-base-content/8 bg-base-200/40 p-3"
    >
      <!-- Sticky header: title + search + jump + region chips -->
      <div
        class="sticky top-0 z-10 -mx-3 -mt-3 mb-1 flex flex-col gap-2 border-b border-base-content/8 bg-base-200/95 px-3 pt-3 pb-2 backdrop-blur-sm"
      >
        <div class="flex items-center gap-2">
          <span class="text-lg font-semibold text-base-content">{{
            activeGroup.name
          }}</span>
          <span
            class="badge inline-flex items-center gap-1 badge-sm badge-primary"
          >
            <span class="font-bold">{{
              formatProxyType(activeGroup.type, t)
            }}</span>
            <template v-if="activeGroup.now?.length">
              <IconChevronRight :size="16" />
              <span class="whitespace-nowrap">{{ activeGroup.now }}</span>
            </template>
          </span>
        </div>

        <!-- Inline search (local to this group) + jump-to-current -->
        <div class="flex items-center gap-2">
          <div
            class="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-base-content/10 bg-base-100/60 px-2.5 transition-all duration-200 focus-within:border-primary/40"
          >
            <IconSearch :size="15" class="shrink-0 opacity-50" />
            <input
              v-model="localKeyword"
              type="search"
              class="w-full bg-transparent text-sm outline-none placeholder:opacity-50"
              :placeholder="t('search')"
            />
            <span class="shrink-0 text-xs text-base-content/45">
              {{ displayNodes.length }}/{{ activeNodes.length }}
            </span>
            <button
              v-if="localKeyword"
              type="button"
              class="shrink-0 text-base-content/45 transition-colors hover:text-base-content"
              :title="t('clear')"
              @click="localKeyword = ''"
            >
              <IconX :size="14" />
            </button>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-base-content/10 bg-base-100/60 text-base-content/70 transition-all duration-200 hover:border-primary/30 hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!selectedVisible"
            :title="t('jumpToCurrent')"
            @click="scrollSelectedIntoView()"
          >
            <IconTarget :size="18" />
          </button>
        </div>

        <!-- Region quick-filter chips (only when >1 region present) -->
        <div v-if="regionFacets.length > 1" class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150"
            :class="
              selectedRegions.size === 0
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-base-content/10 bg-base-100/60 text-base-content/60 hover:border-primary/30'
            "
            @click="selectedRegions = new Set()"
          >
            {{ t('all') }}
            <span class="opacity-60">{{ activeNodes.length }}</span>
          </button>
          <button
            v-for="facet in regionFacets"
            :key="facet.code"
            type="button"
            class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150"
            :class="
              selectedRegions.has(facet.code)
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-base-content/10 bg-base-100/60 text-base-content/60 hover:border-primary/30'
            "
            @click="toggleRegion(facet.code)"
          >
            <span>{{ facet.flag || t('regionOther') }}</span>
            <span class="opacity-60">{{ facet.count }}</span>
          </button>
        </div>
      </div>

      <!-- Node list -->
      <div class="flex flex-col gap-2">
        <ProxyNodeListItem
          v-for="name in displayNodes"
          :key="name"
          :proxy-name="name"
          :test-url="activeGroup.testUrl || null"
          :timeout="activeGroup.timeout ?? null"
          :is-selected="activeGroup.now === name"
          :data-selected="activeGroup.now === name ? 'true' : undefined"
          @click="proxiesStore.selectProxyInGroup(activeGroup, name)"
        />
        <div
          v-if="displayNodes.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          {{ t('noData') }}
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 跑整套单测 + lint 确认不回归**

Run: `pnpm test:unit && pnpm lint`
Expected: 全绿、无 ESLint 报错。

- [ ] **Step 4: 手动验证（master-detail 模式，大组）**

`pnpm dev` → `/proxies` → 工具栏切到 master-detail（最右图标）→ 选一个数百节点的组：

- 详情面板顶部出现：搜索框（带 `命中/总数`）、跳到当前按钮、地区 chips（国旗 + 计数，「全部」+ 各地区 + 可能的「其他」）。
- 点某地区 chip → 列表只剩该地区，计数稳定；可多选（OR）；点「全部」清空。
- 搜索框输入 → 列表收窄，`命中/总数` 实时更新；清除按钮复位。
- 「跳到当前」→ 滚动到选中节点居中；当选中被筛掉时按钮置灰。
- 切换左侧分组 → 搜索/地区复位，且自动滚到该组选中节点。
- 切回 card 模式 → 不受影响，无工作台条。

- [ ] **Step 5: 提交**

```bash
git add packages/ui/components/ProxyMasterDetail.vue packages/ui/i18n/locales
git commit -m "feat(proxies): add region/search/jump workbench to master-detail"
```

---

## Self-Review

**Spec coverage:**

- #1 工具栏快捷排序 → Task 2（const）+ Task 3（组件 + 挂载）。✔
- #2 地区 chips → Task 1（`getRegionFacets`/`filterNodesByRegion`/`parseNodeRegion`）+ Task 4（chips UI）。✔
- #3 定位当前选中 → Task 4（`data-selected` + `scrollSelectedIntoView` + 切组 watch + 跳到当前按钮）。✔
- #4 内置搜索 → Task 4（`localKeyword` + `filterProxiesByName` + 命中计数）。✔
- 启发式 + 自检 → Task 1 测试覆盖国旗/二字码/无法识别三类。✔
- 「仅 master-detail，不影响其他模式 / 不删弹窗 select」→ 仅改 ProxyMasterDetail + 新增工具栏组件，未动其他模式与弹窗。✔
- i18n 7 locale 全补 → Task 4 Step 1。✔（排序选项标签复用既有 `order*` key，无需新增。）

**Placeholder scan:** 无 TBD/TODO；每个改动步骤含完整代码或精确编辑位置。

**Type consistency:** `parseNodeRegion`/`getRegionFacets`/`filterNodesByRegion`/`codeToFlag`/`REGION_OTHER` 在 Task 1 定义，Task 4 同名消费；`PROXIES_ORDERING_TYPE_ORDER` Task 2 定义、Task 3 消费；`data-selected` 写入（Task 4 模板）与读取（`scrollSelectedIntoView` 的 querySelector）一致；`displayNodes`/`activeNodes`/`selectedVisible` 命名贯穿一致。
