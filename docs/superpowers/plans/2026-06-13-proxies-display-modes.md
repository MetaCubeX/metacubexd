# Proxies 页多展示模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/proxies` 页新增 Table / Chips / Master-detail 三种展示模式,与已有 Card / List 一起组成 5 种互斥模式,用工具栏图标分段控件一键切换。

**Architecture:** Card/List/Table/Chips 是「组内节点渲染」,共用现有「每组一面板(`Collapse`)+ 渐进渲染」结构,差异在 `Collapse.vue` body 容器布局与 `ProxyNodes` 渲染的子组件。Master-detail 是「页面级布局」,在 Proxies tab 用一个新的 `ProxyMasterDetail` 组件替代面板堆叠;Provider tab 在 master 模式下退化为堆叠 + List 行。

**Tech Stack:** Nuxt 3 / Vue 3 (`<script setup lang="ts">`)、Tailwind v4 + daisyUI、Pinia、`@tabler/icons-vue`、Vitest(仅 stores/composables/utils/constants 有单测;`.vue` 组件无单测 harness,靠 `pnpm typecheck` + `pnpm dev:mock` 视觉验证 + e2e)。

**测试约定(重要):** 本仓库**没有组件测试库**。可 TDD 的单元是 **constants 枚举、config store、纯函数 utils**——这些写真实 vitest 测试(`**/__tests__/**/*.spec.ts`)。`.vue` 组件的验证步骤是 `pnpm typecheck`(vue-tsc)+ 在 `pnpm dev:mock` 起的本地 app 里目视确认,**不要**为组件编造无法运行的渲染测试。

---

## 文件结构

**新建:**

- `components/ProxyNodeChip.vue` — Chips 模式单个药丸节点
- `components/ProxyNodeTableRow.vue` — Table 模式单行节点
- `components/ProxiesDisplayModeSwitcher.vue` — 工具栏 5 图标分段控件
- `components/ProxyMasterDetail.vue` — Master-detail 页面级布局(左 rail + 右详情)
- `constants/__tests__/proxiesDisplayMode.spec.ts` — 枚举 + 顺序数组测试
- `utils/__tests__/resolveActiveGroup.spec.ts` — master-detail active 分组回退纯函数测试

**修改:**

- `constants/index.ts` — 扩展 `PROXIES_DISPLAY_MODE` 枚举 + 新增 `PROXIES_DISPLAY_MODE_ORDER`
- `utils/index.ts` — 新增 `resolveActiveGroup` 纯函数
- `components/Collapse.vue` — body 容器按 mode 多分支 + table 表头行
- `pages/proxies.vue` — `ProxyNodes`/`ProviderProxyNodes` 渲染分支扩展;工具栏接入 switcher;master 模式分支;删除设置抽屉旧 `<select>`
- `i18n/locales/{en,zh,ru}.json` — 新增 `tableMode`/`chipsMode`/`masterDetailMode`

---

# Phase 1 — 切换链路 + Chips

打通「切换即生效」链路,Chips 最简单,先验证整条链路。

## Task 1: 扩展 PROXIES_DISPLAY_MODE 枚举 + 顺序数组

**Files:**

- Modify: `constants/index.ts`(`PROXIES_DISPLAY_MODE` 枚举,约 79-82 行)
- Test: `constants/__tests__/proxiesDisplayMode.spec.ts`(新建)

- [ ] **Step 1: 写失败测试**

`constants/__tests__/proxiesDisplayMode.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PROXIES_DISPLAY_MODE, PROXIES_DISPLAY_MODE_ORDER } from '../index'

describe('PROXIES_DISPLAY_MODE enum', () => {
  it('keeps existing card/list values', () => {
    expect(PROXIES_DISPLAY_MODE.CARD).toBe('cardMode')
    expect(PROXIES_DISPLAY_MODE.LIST).toBe('listMode')
  })

  it('adds table/chips/master values', () => {
    expect(PROXIES_DISPLAY_MODE.TABLE).toBe('tableMode')
    expect(PROXIES_DISPLAY_MODE.CHIPS).toBe('chipsMode')
    expect(PROXIES_DISPLAY_MODE.MASTER).toBe('masterDetailMode')
  })
})

describe('PROXIES_DISPLAY_MODE_ORDER', () => {
  it('lists all 5 modes in switcher order with no duplicates/omissions', () => {
    expect(PROXIES_DISPLAY_MODE_ORDER).toEqual([
      PROXIES_DISPLAY_MODE.CARD,
      PROXIES_DISPLAY_MODE.LIST,
      PROXIES_DISPLAY_MODE.TABLE,
      PROXIES_DISPLAY_MODE.CHIPS,
      PROXIES_DISPLAY_MODE.MASTER,
    ])
    const unique = new Set(PROXIES_DISPLAY_MODE_ORDER)
    expect(unique.size).toBe(Object.values(PROXIES_DISPLAY_MODE).length)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run constants/__tests__/proxiesDisplayMode.spec.ts`
Expected: FAIL —`PROXIES_DISPLAY_MODE.TABLE` 为 undefined / `PROXIES_DISPLAY_MODE_ORDER` 未导出。

- [ ] **Step 3: 实现**

`constants/index.ts`,替换 `PROXIES_DISPLAY_MODE` 枚举并在其后新增顺序数组:

```ts
export enum PROXIES_DISPLAY_MODE {
  CARD = 'cardMode',
  LIST = 'listMode',
  TABLE = 'tableMode',
  CHIPS = 'chipsMode',
  MASTER = 'masterDetailMode',
}

// Order of modes in the toolbar segmented switcher. Single source of truth so a
// new mode can never be silently missing from the switcher.
export const PROXIES_DISPLAY_MODE_ORDER: PROXIES_DISPLAY_MODE[] = [
  PROXIES_DISPLAY_MODE.CARD,
  PROXIES_DISPLAY_MODE.LIST,
  PROXIES_DISPLAY_MODE.TABLE,
  PROXIES_DISPLAY_MODE.CHIPS,
  PROXIES_DISPLAY_MODE.MASTER,
]
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run constants/__tests__/proxiesDisplayMode.spec.ts`
Expected: PASS(2 个 describe 全绿)。

- [ ] **Step 5: 提交**

```bash
git add constants/index.ts constants/__tests__/proxiesDisplayMode.spec.ts
git commit -m "feat(proxies): extend display mode enum with table/chips/master"
```

## Task 2: i18n 词条

**Files:**

- Modify: `i18n/locales/en.json`、`i18n/locales/zh.json`、`i18n/locales/ru.json`

> 本仓库无 i18n 单测 harness,验证靠 typecheck + 人工核对 JSON。

- [ ] **Step 1: 加 en 词条**

`i18n/locales/en.json`,在 `"listMode"` 行之后插入:

```json
  "tableMode": "Table",
  "chipsMode": "Chips",
  "masterDetailMode": "Master-detail",
```

- [ ] **Step 2: 加 zh 词条**

`i18n/locales/zh.json`,在对应 `listMode` 行之后插入:

```json
  "tableMode": "表格",
  "chipsMode": "药丸",
  "masterDetailMode": "主从",
```

- [ ] **Step 3: 加 ru 词条**

`i18n/locales/ru.json`,在对应 `listMode` 行之后插入:

```json
  "tableMode": "Таблица",
  "chipsMode": "Чипы",
  "masterDetailMode": "Мастер-деталь",
```

- [ ] **Step 4: 校验 JSON 合法 + 键齐全**

Run: `node -e "for (const l of ['en','zh','ru']) { const j=require('./i18n/locales/'+l+'.json'); ['tableMode','chipsMode','masterDetailMode'].forEach(k=>{ if(!(k in j)) throw new Error(l+' missing '+k) }); } console.log('i18n keys ok')"`
Expected: 输出 `i18n keys ok`,无报错。

- [ ] **Step 5: 提交**

```bash
git add i18n/locales/en.json i18n/locales/zh.json i18n/locales/ru.json
git commit -m "feat(proxies): add i18n for table/chips/master display modes"
```

## Task 3: ProxyNodeChip 组件

**Files:**

- Create: `components/ProxyNodeChip.vue`

> 参照 `components/ProxyNodeListItem.vue` 的 props 约定与 store 取数。`Latency` 是 Nuxt 自动导入组件,无需手动 import。

- [ ] **Step 1: 写组件**

`components/ProxyNodeChip.vue`:

```vue
<script setup lang="ts">
import { getLatencyClassName } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  providerName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  providerName: '',
})

const emit = defineEmits<{ click: [] }>()

const proxiesStore = useProxiesStore()
const configStore = useConfigStore()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)

// Latency-quality colored dot (mirrors the stability-bar coloring in ListItem)
const latency = computed(() =>
  proxiesStore.getLatencyByName(props.proxyName, props.testUrl),
)
const dotColorClass = computed(() =>
  latency.value
    ? getLatencyClassName(latency.value, configStore.latencyQualityMap)
    : 'text-neutral-content/30',
)

function handleLatencyTest() {
  proxiesStore.proxyLatencyTest(
    props.proxyName,
    proxyNode.value?.provider || '',
    props.testUrl,
    props.timeout,
  )
}
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-all duration-200"
    :class="
      isSelected
        ? 'bg-primary text-primary-content shadow-sm'
        : 'bg-neutral text-neutral-content hover:shadow-md'
    "
    @click="emit('click')"
  >
    <span
      class="size-2 shrink-0 rounded-full bg-current"
      :class="isSelected ? '' : dotColorClass"
    />
    <span class="max-w-[12rem] truncate font-medium">{{ proxyName }}</span>
    <span v-if="isUDP" class="text-[0.625rem] font-semibold opacity-70">U</span>
    <Latency
      :proxy-name="proxyName"
      :test-url="testUrl"
      :provider-name="providerName"
      @click.stop="handleLatencyTest"
    />
  </button>
</template>
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无新增类型错误(关注 `ProxyNodeChip.vue` 相关报错)。

- [ ] **Step 3: 提交**

```bash
git add components/ProxyNodeChip.vue
git commit -m "feat(proxies): add ProxyNodeChip component for chips display mode"
```

## Task 4: Collapse chips 分支 + ProxyNodes/ProviderProxyNodes 接 Chips

**Files:**

- Modify: `components/Collapse.vue`(body 容器,约 80-91 行;script,约 1-30 行)
- Modify: `pages/proxies.vue`(`ProxyNodes` 渲染分支约 408-431 行;`ProviderProxyNodes` 同构分支约 600-630 行;import 约 21-23 行)

- [ ] **Step 1: Collapse.vue 改 body 容器为多模式**

把 `components/Collapse.vue` `<script setup>` 里的 `isListMode` 计算替换为统一的 `displayMode` + 布局 class:

```ts
const displayMode = computed(() => configStore.proxiesDisplayMode)

const isCardMode = computed(
  () => displayMode.value === PROXIES_DISPLAY_MODE.CARD,
)

// body 容器布局:card=grid,其余按 flex 变体
const bodyLayoutClass = computed(() => {
  switch (displayMode.value) {
    case PROXIES_DISPLAY_MODE.CARD:
      return 'grid'
    case PROXIES_DISPLAY_MODE.CHIPS:
      return 'flex flex-wrap gap-2'
    default:
      // List(现状)与后续 Table 都用纵向 flex
      return 'flex flex-col gap-3'
  }
})
```

把 body 容器 `<div>`(原 `:class="[isOpen ? ... , isListMode ? 'flex flex-col gap-3' : 'grid']" :style="isListMode ? undefined : cardGridStyle"`)改为:

```vue
<div
  class="px-4 pt-2 pb-4 transition-opacity duration-300 ease-out"
  :class="[isOpen ? 'opacity-100' : 'hidden opacity-0', bodyLayoutClass]"
  :style="isCardMode ? cardGridStyle : undefined"
>
  <template v-if="isOpen">
    <slot />
  </template>
</div>
```

(`PROXIES_DISPLAY_MODE` 已在 Collapse.vue 顶部 import,保留。)

- [ ] **Step 2: proxies.vue 的 ProxyNodes 分支接 Chips**

`pages/proxies.vue` 顶部 import 增加(约 21-23 行附近):

```ts
import ProxyNodeChip from '~/components/ProxyNodeChip.vue'
```

把 `ProxyNodes` 的 `setup` 返回函数里(约 409-431 行)那段 `configStore.proxiesDisplayMode === 'listMode' ? h(ProxyNodeListItem, {...}) : h(ProxyNodeCard, {...})` 替换为按模式选组件的 helper。在 `<script setup>` 顶层(组件定义前)新增:

```ts
// Pick the node component for the current display mode (card is the default).
// Table/master handled separately (master bypasses Collapse; table added in Phase 2).
function nodeComponentFor(mode: string) {
  if (mode === PROXIES_DISPLAY_MODE.LIST) return ProxyNodeListItem
  if (mode === PROXIES_DISPLAY_MODE.CHIPS) return ProxyNodeChip
  return ProxyNodeCard
}
```

> 需要在 proxies.vue import `PROXIES_DISPLAY_MODE`(若未 import):`import { PROXIES_DISPLAY_MODE } from '~/constants'`。

把 `ProxyNodes` 里 names.slice(...).map 的 body 改为:

```ts
const Comp = nodeComponentFor(configStore.proxiesDisplayMode)
const children = names.slice(0, renderCount.value).map((proxyName) =>
  h(Comp, {
    key: proxyName,
    proxyName,
    testUrl: props.proxyGroup.testUrl || null,
    timeout: props.proxyGroup.timeout ?? null,
    isSelected: props.proxyGroup.now === proxyName,
    // 仅 card 用到的额外 props,其它组件忽略多余 props(Vue 允许)
    isRecommended: recommendedNode.value === proxyName,
    groupName: props.proxyGroup.name,
    onClick: () => proxiesStore.selectProxyInGroup(props.proxyGroup, proxyName),
  }),
)
```

- [ ] **Step 3: ProviderProxyNodes 分支同步**

对 `ProviderProxyNodes`(约 600-630 行)做同样替换:用 `nodeComponentFor(configStore.proxiesDisplayMode)` 选组件,props 透传 `proxyName/testUrl/timeout/isSelected/providerName`(provider 节点用 `providerName`,不传 `groupName/isRecommended` 或传了被忽略均可),`onClick` 复用该处原有的 select 逻辑。保持与原分支一致的 props,仅把组件选择改为 helper。

- [ ] **Step 4: typecheck**

Run: `pnpm typecheck`
Expected: 无新增类型错误。

- [ ] **Step 5: 视觉验证(mock 模式)**

Run: `pnpm dev:mock`,浏览器开 `http://localhost:3000/#/proxies`。临时把 localStorage `proxiesDisplayMode` 设为 `chipsMode`(devtools console:`localStorage.setItem('proxiesDisplayMode','chipsMode'); location.reload()`)。
Expected: 每个分组 body 变成药丸平铺;选中节点高亮 primary;点药丸切换节点;点延迟数字触发测速。切回 `cardMode`/`listMode` 仍正常。

- [ ] **Step 6: 提交**

```bash
git add components/Collapse.vue pages/proxies.vue
git commit -m "feat(proxies): render chips mode in group panels"
```

## Task 5: ProxiesDisplayModeSwitcher + 工具栏接入 + 删旧 select

**Files:**

- Create: `components/ProxiesDisplayModeSwitcher.vue`
- Modify: `pages/proxies.vue`(工具栏 action 区,约 678-751 行;设置抽屉旧 select,约 1091-1101 行)

- [ ] **Step 1: 写 switcher 组件**

`components/ProxiesDisplayModeSwitcher.vue`:

```vue
<script setup lang="ts">
import {
  IconLayoutGrid,
  IconLayoutSidebar,
  IconList,
  IconTable,
  IconTags,
} from '@tabler/icons-vue'
import { PROXIES_DISPLAY_MODE, PROXIES_DISPLAY_MODE_ORDER } from '~/constants'

const configStore = useConfigStore()
const { t } = useI18n()

// mode → icon + i18n label key
const META: Record<
  PROXIES_DISPLAY_MODE,
  { icon: Component; labelKey: string }
> = {
  [PROXIES_DISPLAY_MODE.CARD]: { icon: IconLayoutGrid, labelKey: 'cardMode' },
  [PROXIES_DISPLAY_MODE.LIST]: { icon: IconList, labelKey: 'listMode' },
  [PROXIES_DISPLAY_MODE.TABLE]: { icon: IconTable, labelKey: 'tableMode' },
  [PROXIES_DISPLAY_MODE.CHIPS]: { icon: IconTags, labelKey: 'chipsMode' },
  [PROXIES_DISPLAY_MODE.MASTER]: {
    icon: IconLayoutSidebar,
    labelKey: 'masterDetailMode',
  },
}

const items = computed(() =>
  PROXIES_DISPLAY_MODE_ORDER.map((mode) => ({
    mode,
    icon: META[mode].icon,
    label: t(META[mode].labelKey),
  })),
)
</script>

<template>
  <div
    class="flex items-center gap-1 rounded-[0.625rem] border border-base-content/10 bg-base-200/80 p-1"
  >
    <button
      v-for="item in items"
      :key="item.mode"
      type="button"
      class="flex h-7 w-7 items-center justify-center rounded-md transition-all duration-200"
      :class="
        configStore.proxiesDisplayMode === item.mode
          ? 'bg-primary text-primary-content shadow-sm'
          : 'text-base-content/60 hover:bg-primary/15 hover:text-primary'
      "
      :title="item.label"
      @click="configStore.proxiesDisplayMode = item.mode"
    >
      <component :is="item.icon" :size="16" />
    </button>
  </div>
</template>
```

> `Component` 类型来自 Vue,Nuxt 自动导入类型可用;若 typecheck 报 `Component` 未定义,顶部加 `import type { Component } from 'vue'`。

- [ ] **Step 2: 工具栏接入 switcher**

`pages/proxies.vue` 工具栏 action 区(`<!-- Action Buttons -->` 那个 `<div class="flex items-center gap-2">` 内,Collapse All / Test All 按钮之后、Batch Test 指示器之前或之后均可)插入:

```vue
<ProxiesDisplayModeSwitcher />
```

(无需 import——Nuxt 自动导入 `components/` 下组件。)

- [ ] **Step 3: 删除设置抽屉旧 Display Mode select**

`pages/proxies.vue` 约 1091-1101 行,删除整段 Display Mode 的 label + `<select v-model="configStore.proxiesDisplayMode">...</select>`(含 `cardMode`/`listMode` 两个 option 与外层包裹行)。删除后确认该设置区其它项(如 renderInTwoColumns、proxiesCardSize)布局未被破坏。

- [ ] **Step 4: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 无新增错误;lint 自动 fix 后无遗留。

- [ ] **Step 5: 视觉验证**

Run: `pnpm dev:mock`,proxies 页工具栏出现 5 图标分段控件;逐个点击 Card/List/Chips 立即生效并高亮当前项;设置抽屉里旧的 Display Mode 下拉已消失。(Table/Master 此时点了会回退到默认 card 渲染,Phase 2/3 补齐。)
Expected: 切换流畅,当前模式高亮正确。

- [ ] **Step 6: Phase 1 回归 + 提交**

Run: `pnpm test:unit`
Expected: 全绿(含新 `proxiesDisplayMode.spec.ts`)。

```bash
git add components/ProxiesDisplayModeSwitcher.vue pages/proxies.vue
git commit -m "feat(proxies): toolbar segmented display-mode switcher, drop settings select"
```

---

# Phase 2 — Table

每组一个小表格,表头随组重复;固定列宽 flex 行确保与表头对齐。

## Task 6: ProxyNodeTableRow 组件

**Files:**

- Create: `components/ProxyNodeTableRow.vue`

> 列宽与 Collapse 表头必须一致:指示(w-4) · 名称(flex-1) · 类型(w-16) · UDP(w-8) · 延迟(w-14)。

- [ ] **Step 1: 写组件**

`components/ProxyNodeTableRow.vue`:

```vue
<script setup lang="ts">
import { IconCircleCheckFilled } from '@tabler/icons-vue'
import { formatProxyType } from '~/utils'

interface Props {
  proxyName: string
  testUrl: string | null
  timeout: number | null
  isSelected?: boolean
  providerName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  providerName: '',
})

const emit = defineEmits<{ click: [] }>()

const proxiesStore = useProxiesStore()
const { t } = useI18n()

const proxyNode = computed(() => proxiesStore.proxyNodeMap[props.proxyName])
const proxyType = computed(() =>
  formatProxyType(proxyNode.value?.type || '', t),
)
const isUDP = computed(() => proxyNode.value?.xudp || proxyNode.value?.udp)

function handleLatencyTest() {
  proxiesStore.proxyLatencyTest(
    props.proxyName,
    proxyNode.value?.provider || '',
    props.testUrl,
    props.timeout,
  )
}
</script>

<template>
  <div
    class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors"
    :class="
      isSelected
        ? 'bg-primary/15 text-base-content shadow-[inset_2px_0_var(--color-primary)]'
        : 'hover:bg-base-content/5'
    "
    @click="emit('click')"
  >
    <span class="flex w-4 shrink-0 justify-center">
      <IconCircleCheckFilled v-if="isSelected" class="size-4 text-primary" />
    </span>
    <span class="min-w-0 flex-1 truncate font-medium">{{ proxyName }}</span>
    <span
      class="w-16 shrink-0 truncate text-right text-xs uppercase opacity-60"
    >
      {{ proxyType }}
    </span>
    <span class="flex w-8 shrink-0 justify-center">
      <span
        v-if="isUDP"
        class="rounded bg-info px-1 py-0.5 text-[0.625rem] font-semibold text-info-content"
        >U</span
      >
    </span>
    <span class="flex w-14 shrink-0 justify-end">
      <Latency
        :proxy-name="proxyName"
        :test-url="testUrl"
        :provider-name="providerName"
        @click.stop="handleLatencyTest"
      />
    </span>
  </div>
</template>
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```bash
git add components/ProxyNodeTableRow.vue
git commit -m "feat(proxies): add ProxyNodeTableRow component for table display mode"
```

## Task 7: Collapse table 分支(表头)+ ProxyNodes 接 Table

**Files:**

- Modify: `components/Collapse.vue`(script + body 模板)
- Modify: `pages/proxies.vue`(`nodeComponentFor` helper + import)

- [ ] **Step 1: Collapse.vue 增加 table 布局与表头**

`<script setup>`:`bodyLayoutClass` 的 switch 增加 table 分支(与 list 一样纵向 flex,但更紧凑 `gap-1`),并新增 `isTableMode`,引入 `useI18n`:

```ts
const { t } = useI18n()

const isTableMode = computed(
  () => displayMode.value === PROXIES_DISPLAY_MODE.TABLE,
)
```

`bodyLayoutClass` switch 增加:

```ts
    case PROXIES_DISPLAY_MODE.TABLE:
      return 'flex flex-col gap-1'
```

body `<template v-if="isOpen">` 内、`<slot />` 之前插入表头行(列宽与 `ProxyNodeTableRow` 一致;label 用 `t(key, fallback)` 不必新增 i18n key):

```vue
<template v-if="isOpen">
  <div
    v-if="isTableMode"
    class="flex items-center gap-2 px-3 pb-1 text-[0.7rem] font-semibold tracking-wide text-base-content/40 uppercase"
  >
    <span class="w-4 shrink-0" />
    <span class="min-w-0 flex-1">{{ t('proxyName', 'Name') }}</span>
    <span class="w-16 shrink-0 text-right">{{ t('proxyType', 'Type') }}</span>
    <span class="w-8 shrink-0 text-center">{{ t('udp', 'UDP') }}</span>
    <span class="w-14 shrink-0 text-right">{{ t('latency', 'Latency') }}</span>
  </div>
  <slot />
</template>
```

> 表头行不参与 grid;table 模式 body 是 `flex flex-col`,表头是普通子项。

- [ ] **Step 2: proxies.vue helper 接 Table**

`pages/proxies.vue` import 增加:

```ts
import ProxyNodeTableRow from '~/components/ProxyNodeTableRow.vue'
```

`nodeComponentFor` 增加 table 分支:

```ts
function nodeComponentFor(mode: string) {
  if (mode === PROXIES_DISPLAY_MODE.LIST) return ProxyNodeListItem
  if (mode === PROXIES_DISPLAY_MODE.CHIPS) return ProxyNodeChip
  if (mode === PROXIES_DISPLAY_MODE.TABLE) return ProxyNodeTableRow
  return ProxyNodeCard
}
```

(`ProxyNodes` / `ProviderProxyNodes` 已用该 helper,无需再改。)

- [ ] **Step 3: typecheck**

Run: `pnpm typecheck`
Expected: 无新增类型错误。

- [ ] **Step 4: 视觉验证**

Run: `pnpm dev:mock`;console `localStorage.setItem('proxiesDisplayMode','tableMode'); location.reload()`。
Expected: 每组顶部出现表头(Name/Type/UDP/Latency),下方每节点一行且列与表头对齐;选中行左边框高亮;点行选节点、点延迟测速。双列布局下两侧各自成表。

- [ ] **Step 5: 提交**

```bash
git add components/Collapse.vue pages/proxies.vue
git commit -m "feat(proxies): render table mode with per-group header row"
```

---

# Phase 3 — Master-detail

页面级布局:左分组导航 + 右详情(List 行)。仅 Proxies tab;Provider tab 退化为堆叠 + List。

## Task 8: resolveActiveGroup 纯函数

**Files:**

- Modify: `utils/index.ts`(新增导出)
- Test: `utils/__tests__/resolveActiveGroup.spec.ts`(新建)

- [ ] **Step 1: 写失败测试**

`utils/__tests__/resolveActiveGroup.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveActiveGroup } from '../index'

describe('resolveActiveGroup', () => {
  it('keeps current when still present', () => {
    expect(resolveActiveGroup(['A', 'B', 'C'], 'B')).toBe('B')
  })

  it('falls back to first when current is gone', () => {
    expect(resolveActiveGroup(['A', 'B'], 'X')).toBe('A')
  })

  it('falls back to first when current is null', () => {
    expect(resolveActiveGroup(['A', 'B'], null)).toBe('A')
  })

  it('returns null when there are no groups', () => {
    expect(resolveActiveGroup([], 'A')).toBe(null)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run utils/__tests__/resolveActiveGroup.spec.ts`
Expected: FAIL — `resolveActiveGroup` 未导出。

- [ ] **Step 3: 实现**

`utils/index.ts` 末尾新增:

```ts
// Resolve the active group for master-detail: keep `current` if it still exists,
// otherwise fall back to the first group (or null when there are none).
export function resolveActiveGroup(
  groupNames: string[],
  current: string | null,
): string | null {
  if (current && groupNames.includes(current)) return current
  return groupNames[0] ?? null
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run utils/__tests__/resolveActiveGroup.spec.ts`
Expected: PASS(4 例全绿)。

- [ ] **Step 5: 提交**

```bash
git add utils/index.ts utils/__tests__/resolveActiveGroup.spec.ts
git commit -m "feat(proxies): add resolveActiveGroup helper for master-detail"
```

## Task 9: ProxyMasterDetail 组件

**Files:**

- Create: `components/ProxyMasterDetail.vue`

> 接收 `groups`(已过滤 hidden 的 proxy 数组)与 `sortedNamesByGroup`(name→已排序节点名)两个 prop,复用 proxies.vue 已算好的数据,避免重复排序。详情区节点用自动导入的 `ProxyNodeListItem`。

- [ ] **Step 1: 写组件**

`components/ProxyMasterDetail.vue`:

```vue
<script setup lang="ts">
import type { Proxy as ProxyType } from '~/types'
import { IconChevronRight } from '@tabler/icons-vue'
import { formatProxyType, resolveActiveGroup } from '~/utils'

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

function aliveCount(group: ProxyType) {
  return (
    group.all?.filter((n) => proxiesStore.proxyNodeMap[n]?.alive === true)
      .length ?? 0
  )
}
</script>

<template>
  <div class="flex h-full min-h-0 gap-3">
    <!-- Left rail: group navigation -->
    <div class="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto">
      <button
        v-for="group in groups"
        :key="group.name"
        type="button"
        class="flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-all duration-200"
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
        <span class="truncate text-xs text-base-content/45">{{
          group.now
        }}</span>
      </button>
    </div>

    <!-- Right detail: active group's nodes -->
    <div
      v-if="activeGroup"
      class="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-base-content/8 bg-base-200/40 p-3"
    >
      <div class="flex items-center gap-2 px-1">
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

      <div class="flex flex-col gap-2">
        <ProxyNodeListItem
          v-for="name in activeNodes"
          :key="name"
          :proxy-name="name"
          :test-url="activeGroup.testUrl || null"
          :timeout="activeGroup.timeout ?? null"
          :is-selected="activeGroup.now === name"
          @click="proxiesStore.selectProxyInGroup(activeGroup, name)"
        />
      </div>
    </div>
  </div>
</template>
```

> 窄屏退化(`< sm`)可在后续 polish:此版桌面优先,左 rail 固定 `w-48`。若需窄屏退化,把外层改为 `flex-col sm:flex-row` 并将左 rail 在窄屏改为横向滚动——本任务先不做,留待视觉验证后按需补。

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 无新增类型错误。

- [ ] **Step 3: 提交**

```bash
git add components/ProxyMasterDetail.vue
git commit -m "feat(proxies): add ProxyMasterDetail master-detail layout component"
```

## Task 10: proxies.vue master 分支 + provider 退化

**Files:**

- Modify: `pages/proxies.vue`(Proxies 内容区,约 764-847 行;`nodeComponentFor`)

- [ ] **Step 1: master 模式分支(Proxies tab)**

`pages/proxies.vue` 顶层新增:

```ts
const isMasterMode = computed(
  () => configStore.proxiesDisplayMode === PROXIES_DISPLAY_MODE.MASTER,
)
```

把 Proxies 内容区外层(`v-if="activeTab === 'proxies'"` 那个滚动容器)改为:master 模式渲染 `ProxyMasterDetail`,否则保留现有 `ProxiesRenderWrapper` 堆叠:

```vue
<!-- Proxy Groups Content -->
<div
  v-if="activeTab === 'proxies'"
  ref="proxiesScrollEl"
  class="min-h-0 flex-1 overflow-y-auto"
  :class="isMasterMode ? 'overflow-hidden' : ''"
>
  <ProxyMasterDetail
    v-if="isMasterMode"
    :groups="renderProxies"
    :sorted-names-by-group="sortedNamesByGroup"
  />
  <ProxiesRenderWrapper v-else ref="proxyGroupsWrapper">
    <!-- ...现有三个 template (even/odd/default) 原样保留... -->
  </ProxiesRenderWrapper>
</div>
```

> 注意:`ProxyMasterDetail` 自己内部滚动,故 master 时外层去掉纵向滚动(`overflow-hidden`),让左右两栏各自滚。

- [ ] **Step 2: provider 退化为 List**

`nodeComponentFor` 不变(provider 永不会传 MASTER 给它,因为 MASTER 不进 ProxyNodes;但 provider tab 在 master 模式下仍渲染堆叠)。为保证 provider 在 master 模式下用 List 行而非落到 card 默认,修改 provider 侧组件选择:在 `ProviderProxyNodes` 里把 `configStore.proxiesDisplayMode` 经一个归一化处理——master → list:

```ts
// Provider tab does not support master-detail; degrade master → list.
const providerMode =
  configStore.proxiesDisplayMode === PROXIES_DISPLAY_MODE.MASTER
    ? PROXIES_DISPLAY_MODE.LIST
    : configStore.proxiesDisplayMode
const Comp = nodeComponentFor(providerMode)
```

同理 Collapse.vue 的 `bodyLayoutClass`:provider tab 在 master 模式下应表现为 list 布局。由于 Collapse 直接读 `configStore.proxiesDisplayMode`,master 时会落到 `bodyLayoutClass` 的 `default`(flex-col)——即 list 布局,正好正确,无需额外改。验证时确认即可。

- [ ] **Step 3: typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: 无新增错误。

- [ ] **Step 4: 视觉验证**

Run: `pnpm dev:mock`;工具栏点 Master(IconLayoutSidebar)。
Expected: Proxies tab 变成左分组导航 + 右详情;点左侧分组切换右侧节点列表;点节点选中(now 更新、高亮);切到 Provider tab 时为堆叠 + List 行(不报错、可正常显示与选择)。切回其它模式恢复正常。

- [ ] **Step 5: 全量回归 + 提交**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: 单测全绿、typecheck 无错、lint 干净。

```bash
git add pages/proxies.vue
git commit -m "feat(proxies): master-detail layout on proxies tab, list fallback for providers"
```

---

## Self-Review(写完计划后核对)

- **Spec 覆盖**:§5 枚举→T1;§9 i18n→T2;§6.4 Chips→T3/T4;§8 工具栏+删 select→T5;§6.3 Table→T6/T7;§7 Master-detail→T8/T9/T10;Provider 退化(§4 非范围/§7.1)→T10 Step2。全覆盖。
- **占位符**:无 TBD/TODO;每个改代码步骤都给了完整代码或精确指令。窄屏退化在 T9 显式标注为「按需补」而非模糊占位(spec §7.2 列为可选 polish)。
- **类型/命名一致**:`nodeComponentFor` 在 T4 定义、T7/T10 扩展,签名一致;`PROXIES_DISPLAY_MODE_ORDER`、`resolveActiveGroup`、`ProxyNodeChip`/`ProxyNodeTableRow`/`ProxyMasterDetail`/`ProxiesDisplayModeSwitcher` 命名前后一致。
- **测试真实性**:仅对 constants/utils 写真实 vitest;组件用 typecheck + dev:mock 视觉验证,符合仓库无组件测试 harness 的现状。
