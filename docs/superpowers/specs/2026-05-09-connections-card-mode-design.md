# ConnectionsTable 卡片模式设计

| Field    | Value                                                   |
| -------- | ------------------------------------------------------- |
| Date     | 2026-05-09                                              |
| Status   | Draft (awaiting user review)                            |
| Scope    | `/connections` 页 ConnectionsTable 新增卡片渲染模式     |
| Approach | 三态 displayMode（auto/table/card）+ 双行扁平卡片 ~52px |

## 1. 背景

紧接 `2026-05-09-connections-table-density-design.md`（composite columns 已落地）。该轮把 6 列 composite columns 设计为 table 行的"主辅双行"结构，密度提升约 2x。本轮在此基础上提供另一种视觉范式：**卡片渲染**，让每个 connection 视觉上独立成块，便于扫读与导航。

## 2. 现状

- 桌面端（≥768px）：原生 `<table>` 渲染。
- 移动端（<768px）：仍是 `<table>` 元素，但通过 CSS `display: flex; flex-wrap: wrap` 让行变成卡片样式，每个 `<td>` 占 50% (xs) / 33% (sm) 宽度。
- `useMobileConnectionsTable` 开关控制移动端是否强制 table（`force-table` class）。

桌面端没有"卡片"路径。

## 3. 设计目标

提供一种渲染模式，让每条 connection 在桌面端视觉上独立成块（紧凑、扁平、双行），同时保留 table 模式作为可选项（响应式 / 强制 table / 强制 card 三态）。

## 4. 范围与非范围

**在范围内**：

- 新增 `connectionsDisplayMode: 'auto' | 'table' | 'card'` 三态配置，替代旧的 `useMobileConnectionsTable` 布尔开关
- 一次性 localStorage 迁移：旧 key `useMobileConnectionsTable` → 新 key `connectionsDisplayMode`（true→`table`，false→`auto`）
- 卡片渲染分支：双行扁平 ~52px 卡片，紧凑布局
- ConnectionsToolbar 在 card 模式下出现 sort / group dropdown 控件
- ConnectionsSettingsModal 替换原 mobile-table toggle 为三态 radio group

**不在范围内（明确推迟）**：

- 卡片字段独立配置（卡片字段沿用现有列 visibility，不引入第二套配置）
- 卡片网格化（多列并排）— 当前是单列纵向滚动
- 卡片折叠/展开交互
- composite columns 的字段映射或内容修改
- 列宽拖拽调整（不在 card 模式下出现）

## 5. 三态枚举定义与迁移

### 枚举语义

| 值      | 桌面 (≥768px)  | 移动 (<768px)                                  |
| ------- | -------------- | ---------------------------------------------- |
| `auto`  | `<table>` 表格 | `<table>` flex-wrap 卡片样式（即现状响应式）   |
| `table` | `<table>` 表格 | `<table>` 表格（与桌面一致；force-table 行为） |
| `card`  | 新卡片渲染分支 | 新卡片渲染分支（与桌面一致）                   |

**默认值**：`auto`（保持现有用户体验）

### localStorage 迁移

`stores/config.ts` 在初始化 `connectionsDisplayMode` 时执行一次性迁移：

```ts
const connectionsDisplayMode = useLocalStorage<'auto' | 'table' | 'card'>(
  'connectionsDisplayMode',
  () => {
    // One-time migration from useMobileConnectionsTable
    const legacyRaw = localStorage.getItem('useMobileConnectionsTable')
    if (legacyRaw !== null) {
      const legacy = JSON.parse(legacyRaw) as boolean
      localStorage.removeItem('useMobileConnectionsTable')
      return legacy ? 'table' : 'auto'
    }
    return 'auto'
  },
)
```

旧 `useMobileConnectionsTable` 写出 / 引用全部移除（包括 `stores/config.ts` 的导出、ConnectionsTable.vue / ConnectionsSettingsModal.vue 的使用、`stores/config.ts:166` 的 reset 逻辑）。

## 6. 卡片视觉规格

### 6.1 卡片形态：扁平双行 ~52px

```
┌──────────────────────────────────────────────────────────────────────────┐
│ example.com:443         my-app · /usr/bin/curl                       [✕] │ ← 主行
│ ↓1.2MB/s · ↑800K/s · ∑25.3/8.1MB · DOMAIN→PROXY→JP-01 · 192→1.2.3.4 · 02:35 │ ← 辅行
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 主行结构

主行包含 3 个槽位（左 / 中 / 右）：

| 槽位 | 内容                          | 字号 | 字重 | 颜色             |
| ---- | ----------------------------- | ---- | ---- | ---------------- |
| 左   | host:port (`getHost(conn)`)   | 13px | 600  | base-content     |
| 中   | process · processPath（如有） | 12px | 400  | base-content 75% |
| 右   | Close 按钮 (Action)           | -    | -    | error-tint hover |

中槽用 `flex: 1` 填充，超出 ellipsis。Close 按钮固定在右侧，hover 时高亮 error-tint（沿用现有 `.conn-close-btn` 样式）。

### 6.3 辅行结构

辅行是**单行 nowrap ellipsis**，按以下顺序拼接所有可见字段，分隔符 `·`：

```
[Traffic 速率] · [Traffic 累计] · [Rule + Chains] · [Flow src→dest] · [Time]
```

**字段顺序规则**：

辅行按 §7.1 表格中"辅行"字段的列出顺序拼接。**未在表格中显式列出的列**（例如 SourcePort、InboundUser）若被设为可见，按它们在 `visibleColumns` 中的位置插入辅行尾部。

**字段省略规则**：

- 字段值为空（如无 chains、无 process）→ 整段连同前导分隔符省略
- 已配置为不可见的列（visibility = false）→ 整段省略
- 用户接受常态 ellipsis（不预期完整可见）

辅行字号 `11px`，行高 `1.35`，颜色 `color-mix(in oklch, base-content 58%, transparent)`，沿用 density 设计的辅行 token。

### 6.4 卡片容器规格

```css
.conn-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.75rem; /* 左右更宽，给主行换气感 */
  background: var(--color-base-100);
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
  border-radius: 0.5rem;
  margin: 4px 0; /* 卡片间隔 */
  cursor: pointer;
  transition:
    transform var(--dur-base) var(--ease-spring-soft),
    box-shadow var(--dur-base) var(--ease-soft),
    border-color var(--dur-fast) var(--ease-soft);
}

.conn-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--lift-1);
  border-color: color-mix(in oklch, var(--color-base-content) 15%, transparent);
}
```

**与 motion design system 协调**：

- 沿用现有的 `--ease-spring-soft` / `--lift-1` / `--dur-base` tokens（这些 tokens 是用户那批未提交的 motion-system 改动里定义的）
- **风险**：在用户的 motion-system 还没合并前，新代码引用 `--ease-spring-soft` / `--lift-1` 等变量会 fallback 为初始值（CSS 变量未定义时为空）。为了让卡片代码独立于 motion-system，**用 fallback 语法**：`transition-timing-function: var(--ease-spring-soft, cubic-bezier(0.5, 1.25, 0.5, 1))`，`box-shadow: var(--lift-1, 0 2px 6px rgba(0,0,0,0.08))`

## 7. 字段映射 — 复用列 visibility

卡片显示的字段集合 = 用户当前配置 visibility=true 的列集合（与 table 模式一致）。`pages/connections.vue` 的 `visibleColumns` computed 已是这套逻辑，**卡片渲染分支与 table 共用同一 `visibleColumns`**。

### 7.1 主行 vs 辅行的字段分配

固定逻辑（不需要用户配置，从 visibleColumns 自动推导）：

| 列 ID                                         | 卡片中位置        | 渲染规则                          |
| --------------------------------------------- | ----------------- | --------------------------------- |
| `Close` / `Details`                           | 主行右侧 [✕] 按钮 | 沿用 col.render() 的 IconX 输出   |
| `HostProcess`                                 | 主行左 + 中       | 主行左 = host:port，中 = process  |
| `Host`（atomic）                              | 主行左            | host:port，无中槽内容             |
| `Process`（atomic）                           | 主行中            | 仅当 HostProcess 不可见时占主行中 |
| `RuleChains` / `Rule`                         | 辅行              | 拼接 `·`                          |
| `Chains`                                      | 辅行              | 拼接 `·`（独立列时）              |
| `Traffic`                                     | 辅行              | 拼接 `·`                          |
| `DlSpeed` / `UlSpeed` / `Download` / `Upload` | 辅行              | 拼接 `·`（独立列时）              |
| `Flow`                                        | 辅行              | 拼接 `·`                          |
| `SourceIP` / `Destination` 等                 | 辅行              | 拼接 `·`（独立列时）              |
| `ConnectTime`                                 | 辅行              | 拼接 `·`                          |
| `Type` / `SniffHost` / `InboundUser` 等       | 辅行              | 拼接 `·`                          |

**主行降级**：当 `HostProcess` 与 `Host` 同时不可见时，主行左槽显示 `getDestination(conn)`（来自 Flow 列的 destination 部分作为兜底）；若 `Process` 也不可见，主行中槽留空。这是个边缘 case（用户显式隐藏所有 host 类列），不让卡片整行空白。

### 7.2 字段渲染策略

每个字段从对应列定义的 `col.render(conn)` 取得 VNode 或 string。卡片渲染时调用 `col.render(conn)` 得到内容（VNode 或 string），辅行字段如果 render() 返回 VNode（如 chains 列含 IconChevronRight 图标），需要降级为纯文本以适配 `·` 拼接和 nowrap ellipsis。

**降级策略**：在 `pages/connections.vue` 给每个 ConnectionColumn 增加一个**可选** `renderText: (conn) => string` 字段，仅卡片辅行使用。无 `renderText` 时回退到 `String(col.render(conn))`（VNode 直接 toString 会输出 `[object Object]`，需要用 fallback 字符串拼接）。

更干净的方案：**每个 column 增加 `renderText`**（必选 only for cards-supported columns），返回纯字符串，卡片辅行专用。Composite columns 已有 primary/aux 字符串组装逻辑，重构成可复用函数即可。

## 8. 排序与分组 UI（卡片模式）

### 8.1 ConnectionsToolbar 新增控件

card 模式（`displayMode === 'card'`）下，ConnectionsToolbar 显示两个紧凑 dropdown：

```
[ Sort by: Host ↓ ] [ Group by: None ▼ ]
```

- **Sort by**：列表来自 `sortableColumns`（即 `col.sortable === true` 的列），点击切换 asc/desc
- **Group by**：列表来自 `groupableColumns`，加 "None" 选项

dropdown 触发现有的 `headerClick` / `toggleGrouping` 等价 emit / store mutation —— **不重复实现排序逻辑**。

### 8.2 Group header 在卡片列表中的呈现

table 模式下分组 header 是 `<tr class="conn-group-row">`。卡片模式用 div 等价物：

```
┌─────────────────────────────────────┐
│ ▼ DOMAIN(host) (12)                │  ← 卡片组 header
└─────────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ example.com:443 ...           [✕] │
  │ ↓ 1.2 MB/s · ...                  │
  └──────────────────────────────────┘
  ┌──────────────────────────────────┐
  │ api.example.com:443 ...      [✕] │
  │ ↓ 800 K/s · ...                   │
  └──────────────────────────────────┘
```

组 header 用 `padding-left: 0.5rem` 和卡片本身用 `margin-left: 1rem` 表达层级，沿用现有 `.conn-group-row` 配色（primary 5% bg）。

## 9. 实现路径

### 9.1 改动清单

| 文件                                                  | 改动                                                                                                         | 行数估算 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| `stores/config.ts`                                    | 加 `connectionsDisplayMode` (含迁移)；移除 `useMobileConnectionsTable` 导出和 reset 引用                     | ~20      |
| `stores/__tests__/config.spec.ts`（新建）             | 加 3 个测试覆盖迁移：legacy true→table、legacy false→auto、无 legacy→auto                                    | ~50      |
| `components/connections/ConnectionsTable.vue`         | 拆出卡片渲染分支：`v-if="displayMode === 'card'"` 走新 div+card；保留 table 路径；新增 scoped CSS .conn-card | ~120     |
| `components/connections/ConnectionsToolbar.vue`       | card 模式下显示 sort / group dropdown；emit `headerClick` / `toggleGrouping`                                 | ~40      |
| `components/connections/ConnectionsSettingsModal.vue` | 替换 useMobileConnectionsTable toggle 为 displayMode 三态 radio group                                        | ~15      |
| `pages/connections.vue`                               | 给每个 ConnectionColumn 加 `renderText: (conn) => string`；引入字段拼接逻辑（卡片辅行专用）                  | ~80      |
| `i18n/locales/en.json` / `zh.json` / `ru.json`        | 新增 `displayMode` / `auto` / `tableMode` / `cardMode` / `sortBy` / `groupBy` / `none` 翻译键                | ~21      |

**不改**：列定义本身（render 逻辑）、composite columns 行为、Connection 类型、API、persistence 路径。

### 9.2 ConnectionColumn 类型扩展

`components/connections/ConnectionsTable.vue` 的 `ConnectionColumn` 接口增加可选字段：

```ts
export interface ConnectionColumn {
  id: CONNECTIONS_TABLE_ACCESSOR_KEY
  key: string
  groupable: boolean
  sortable: boolean
  sortId?: string
  render: (conn: Connection) => VNode | string
  renderText?: (conn: Connection) => string // 新增 — card 辅行用
  groupValue?: (conn: Connection) => string
}
```

`renderText` 仅在 card 模式辅行被调用。Table 模式行为不变。

### 9.3 卡片渲染骨架

ConnectionsTable.vue 在 card 模式下：

```vue
<div v-else class="conn-cards">
  <template v-for="row in rowModel" :key="...">
    <!-- Group header -->
    <div v-if="row.type === 'group'" class="conn-card-group" @click="...">
      <IconZoomOutFilled v-if="expandedGroups[row.key]" />
      <IconZoomInFilled v-else />
      <span>{{ row.key }}</span>
      <span class="conn-card-group-count">({{ row.subRows.length }})</span>
    </div>
    <!-- Card -->
    <div v-else class="conn-card" @click="emit('rowClick', row.original)">
      <div class="conn-card__main">
        <span class="conn-card__main-host">{{ getHost(row.original) }}</span>
        <span class="conn-card__main-process">{{ getProcess(row.original) }}</span>
        <component :is="closeButtonRender(row.original)" />
      </div>
      <div class="conn-card__aux">{{ buildAuxLine(row.original, visibleColumns) }}</div>
    </div>
  </template>
</div>
```

`buildAuxLine(conn, columns)` 是新工具函数：从 visible columns 中筛选出 aux 字段（排除 Action / HostProcess 主行字段），调用每个 column 的 `renderText(conn)`，过滤空值，`·` 拼接。

## 10. i18n 新键

```json
{
  "displayMode": {
    "en": "Display Mode",
    "zh": "显示模式",
    "ru": "Режим отображения"
  },
  "auto": { "en": "Auto", "zh": "自动", "ru": "Авто" },
  "tableMode": { "en": "Table", "zh": "表格", "ru": "Таблица" },
  "cardMode": { "en": "Card", "zh": "卡片", "ru": "Карточка" },
  "sortBy": { "en": "Sort by", "zh": "排序", "ru": "Сортировка" },
  "groupBy": { "en": "Group by", "zh": "分组", "ru": "Группировка" },
  "none": { "en": "None", "zh": "无", "ru": "Нет" }
}
```

## 11. 验证

1. `pnpm dev:mock` → `/connections` → 触发 mock 连接
2. 切换 displayMode：auto / table / card 三态都生效
3. card 模式下：
   - 每张卡片 ~52px 高度，hover 上抬 1px + lift-1 阴影
   - 主行 host:port 强调字重，process · path 中段，[✕] 按钮右侧
   - 辅行 `·` 分隔串，长行 ellipsis
   - 字段省略：找一条 mock connection 故意把 chains 设为空数组，验证辅行不出现连续 `· ·`
4. card 模式 toolbar：sort dropdown 切换列，group dropdown 切换分组；切换后卡片正确重排
5. table↔card 切换：visibility 配置共享（在 table 模式选 6 列，切到 card 仍是这 6 个字段）
6. localStorage 迁移：手动写入 `useMobileConnectionsTable: true` → 重载 → `connectionsDisplayMode: 'table'`，`useMobileConnectionsTable` 已被删除
7. 主题切换：3 种 daisyUI 主题下卡片背景/边框可读
8. `pnpm typecheck` / `pnpm lint` / `pnpm test:unit` / `pnpm test:e2e` 全过

## 12. 风险与边界

| 风险                                                                           | 缓解                                                                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 辅行 `·` 拼接多个字段后超出，ellipsis 截断使用户看不到关键字段                 | 默认 6 列辅行字段已经收敛；用户已确认接受 ellipsis 作为常态                                                               |
| motion-system 未合并时 `--ease-spring-soft` / `--lift-1` 变量未定义            | 使用 CSS var fallback 语法，提供等价的 inline fallback                                                                    |
| ConnectionColumn 的 `renderText` 是新增可选字段，旧列定义没有 → 卡片辅行不显示 | 在 cards 模式默认列（composite columns）全部加上 renderText；其它列若用户切到卡片用，回退到 String(render()) 但带 warning |
| 旧 useMobileConnectionsTable 持久化存在多 tab 场景下迁移竞态                   | `useLocalStorage` 的 init 函数同步执行，single tab 内幂等；多 tab 下首个 tab 迁移、其它 tab 读到新 key，无冲突            |
| 切换 displayMode 时滚动位置丢失                                                | 接受，因为 layout 完全不同；优先级低                                                                                      |

## 13. 推迟项（明确不做）

- 卡片字段单独配置（独立于列 visibility）
- 卡片网格化（多列并排）
- 卡片折叠/展开
- 卡片内字段位置可拖拽
- card 模式 sort/group UI 变成 sticky bar 而非 toolbar 内嵌
- 不同 displayMode 持久化各自独立的 group/sort 设置

## 14. 完成标准

- 三态在所有 daisyUI 主题下视觉合规
- localStorage 迁移：旧用户不丢配置，自动升级
- `pnpm typecheck` / `pnpm lint` / `pnpm test:unit` / `pnpm test:e2e` 全过
- 在用户没有 motion-system 改动的环境下，新卡片 CSS 仍能 fallback 渲染（CSS var fallback 语法生效）
