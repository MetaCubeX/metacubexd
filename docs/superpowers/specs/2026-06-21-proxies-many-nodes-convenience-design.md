# Proxies 页「节点多时」便利操作增强设计

| Field    | Value                                                                                     |
| -------- | ----------------------------------------------------------------------------------------- |
| Date     | 2026-06-21                                                                                |
| Status   | Draft (awaiting user review)                                                              |
| Scope    | 工具栏快捷排序 + master-detail 详情面板「多节点工作台」（地区筛选 / 内置搜索 / 定位选中） |
| Approach | #1 全局工具栏；#2/#3/#4 集中在 master-detail 详情面板（单分组聚焦）                       |

## 1. 背景

单个分组节点数可达数百（截图中 `PROXY` 组 198/250）。当前要「找最快节点」需进设置弹窗改排序、要「找当前选中」需在数百项里滚动、要「只看某地区」只能用顶部全局过滤框手打。用户希望增强节点多时的便利操作，明确选择四项全做：

1. 工具栏快捷排序
2. 地区快捷筛选 chips
3. 定位当前选中节点
4. 详情面板内置搜索

## 2. 现状

- **工具栏**（`pages/proxies.vue`）：Tabs + 显示模式切换 + Collapse/Test All + 全局节点过滤框（绑 `configStore.proxiesGroupNameFilter`）+ Connectivity + 设置齿轮。
- **排序**：枚举 `PROXIES_ORDERING_TYPE`（自然/延迟↑↓/名称↑↓/质量↑↓，`constants/index.ts:69`），绑 `configStore.proxiesOrderingType`，**仅**出现在设置弹窗的 `<select>`（`proxies.vue` ~1169）。排序逻辑 `sortProxiesByOrderingType`（`utils/index.ts:231`）已完备。
- **过滤**：`filterProxiesByName`（`utils/index.ts:358`，大小写不敏感子串）。Faceted 筛选范式：`getRuleFacets` / `filterRules`（`utils/index.ts:372`+，Rules 页已用 chips OR/AND）。
- **master-detail**（`components/ProxyMasterDetail.vue`，~106 行）：左分组导航栏 + 右详情面板。右侧渲染 active 分组的 `activeNodes`（来自 `sortedNamesByGroup`，已含排序+全局过滤+可用性过滤），逐行 `ProxyNodeListItem`。
- **可复用下拉范式**：`components/LangSwitcher.vue`（floating-ui `useFloating` + `useMenuKeyboard` 键盘 a11y + Teleport + 点击外部关闭）；`components/connections/ConnectionsToolbar.vue` 亦有排序下拉。

## 3. 设计目标

- **#1** 把 `proxiesOrderingType` 从设置弹窗提到工具栏，一键切排序，零改排序逻辑。
- **#2/#3/#4** 把 master-detail 右侧详情面板做成「多节点工作台」：本地搜索 + 地区 chips + 定位选中，三者都依赖单分组聚焦，故集中于此。

## 4. 范围与非范围

**在范围内**：

- 新增 `components/ProxiesSortDropdown.vue`，挂到 `proxies.vue` 工具栏（proxies / proxyProviders 两 tab 都显示）。
- 新增 util `parseNodeRegion(name)` + `getRegionFacets(names)`（`utils/index.ts`）+ `__tests__/index.spec.ts` 自检。
- 改 `components/ProxyMasterDetail.vue`：详情面板顶部加「工作台条」（搜索框 + 地区 chips + 跳到当前按钮）+ 本地筛选态 + 切组/点按时 `scrollIntoView`。
- i18n `{en,zh,ru}.json` 新增 `sortBy` / `searchInGroup` / `jumpToCurrent` / `regionOther` 等词条（排序选项 label 复用既有 `order*` key）。
- 排序选项顺序常量 `PROXIES_ORDERING_TYPE_ORDER`（单一来源，避免下拉漏项；镜像既有 `RULES_ORDERING_TYPE_ORDER`）。

**不在范围内（明确推迟）**：

- **#2/#3/#4 只做 master-detail 模式**。card/list/table/chips 仍只有全局过滤框 + 新快捷排序。理由：地区 chips / 本地搜索 / 「跳到当前」都依赖单分组聚焦；card 模式多组同时展开时这些会很吵且「当前选中」有歧义。想用工作台 → 一键切到 master-detail。卡片模式的「跳到当前」留作后续。
- 设置弹窗里旧的排序 `<select>` 保留不删（与工具栏下拉同绑一个 state，冗余但无害；删它要动弹窗布局，YAGNI）。
- 地区识别用启发式，不引地理库；非标准前缀（`sg01-reality`、`claw1-reality`、`日本 05`）归「其他」。
- 地区 chips 暂不抽成独立组件（ProxyMasterDetail 仍在可控行数内；复用到 card 模式时再抽，YAGNI）。

## 5. 详细设计

### 5.1 #1 工具栏快捷排序 `ProxiesSortDropdown.vue`

镜像 `LangSwitcher.vue`：

- 触发按钮：`IconArrowsSort` + 当前排序名（`t(proxiesOrderingType)`），`aria-haspopup="menu"`。
- 弹层：`useFloating`（placement `bottom-end`）+ Teleport + `useMenuKeyboard`（上下键 / Esc / 点击外部关闭）。
- 菜单项遍历 `PROXIES_ORDERING_TYPE_ORDER`，点击写 `configStore.proxiesOrderingType`，当前项打勾。
- 挂载位置：`proxies.vue` 工具栏，显示模式切换器旁；两 tab 都显示（provider 排序也走同一 `proxiesOrderingType`）。

### 5.2 #2 地区识别 util

```ts
// ponytail: 启发式地区识别——开头国旗 emoji 或开头 ISO-3166 二字码 token。
// 两者都没有的归 null（→「其他」）。升级路径：providers 用非标准前缀时再扩 token 映射。
const ISO_CODES = new Set(['US','JP','SG','HK','DE','KR','TW','GB','CA','AU','NL','FR', ...])

// 两个 regional indicator（U+1F1E6..U+1F1FF）→ 二字母码
function flagToCode(name: string): string | null { ... }
// 二字母码 → 国旗 emoji（chip 始终可渲染国旗）
function codeToFlag(code: string): string { ... }

export function parseNodeRegion(name: string): string | null {
  // 1. 开头国旗 emoji → ISO 码
  // 2. /^([A-Z]{2})[_\-\s]/ 且 ∈ ISO_CODES
  // else null
}

export interface RegionFacet { code: string; flag: string; count: number }
// 按 count desc、code asc 排序；含「其他」（code='__other__'）当存在无法识别项
export function getRegionFacets(names: string[]): RegionFacet[] { ... }
```

自检（`utils/__tests__/index.spec.ts`）：`parseNodeRegion('🇸🇬SG_新加坡|🟡42|机房IP 4')==='SG'`、`'JP-Narita-09bac...'==='JP'`、`'DE-Dreieich-...'==='DE'`、`'sg01-reality'===null`、`'日本 05'===null`；`getRegionFacets` 计数与排序正确。

### 5.3 master-detail 工作台条（#2 #3 #4）

`ProxyMasterDetail.vue` 详情面板（`activeGroup` 存在时）头部下方新增一条 sticky 工作台条：

- **搜索框（#4）**：本地 `localKeyword` ref（**不**碰全局 `proxiesGroupNameFilter`），`IconSearch` + 清除按钮，右侧显示 `命中 / 总数`。
- **地区 chips（#2）**：`getRegionFacets(activeNodes)` 渲染国旗+计数 chip，本地 `selectedRegions: Set<string>`，点击 toggle，OR 筛选；「全部」chip 清空选择。切换 active 分组时清空 `selectedRegions` 与 `localKeyword`。
- **跳到当前（#3）**：`IconTarget` 按钮，仅当 `activeGroup.now` 在当前可见列表时可点；点击把选中项 `scrollIntoView({ block: 'center' })`。

**显示列表派生**：

```
displayNodes = activeNodes
  → 若 selectedRegions 非空：filter(parseNodeRegion(n)∈selectedRegions，含「其他」)
  → 若 localKeyword 非空：filterProxiesByName(_, localKeyword)
```

地区 chip 计数基于 `activeNodes`（地区/搜索筛选前），保持稳定。

**滚动定位**：选中项根元素用函数 ref 捕获（组件实例 `$el`）。`watch(activeName)` 切组后 `nextTick` → 若选中项在 `displayNodes` 内则 `scrollIntoView`。「跳到当前」按钮复用同一函数。

## 6. 文件改动清单

| 文件                                 | 改动                                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| `constants/index.ts`                 | 新增 `PROXIES_ORDERING_TYPE_ORDER`                           |
| `utils/index.ts`                     | 新增 `parseNodeRegion` / `getRegionFacets` / 旗码互转        |
| `utils/__tests__/index.spec.ts`      | 地区 util 自检                                               |
| `components/ProxiesSortDropdown.vue` | 新增（镜像 LangSwitcher）                                    |
| `components/ProxyMasterDetail.vue`   | 工作台条 + 本地筛选态 + scrollIntoView                       |
| `pages/proxies.vue`                  | 工具栏挂载 `ProxiesSortDropdown`                             |
| `i18n/locales/{en,zh,ru}.json`       | `sortBy` / `searchInGroup` / `jumpToCurrent` / `regionOther` |

## 7. 验证

- 单测：`parseNodeRegion` / `getRegionFacets` 覆盖国旗、二字码、无法识别三类。
- 手测（master-detail，大组）：切排序即时重排；切地区 chip 列表收窄且计数稳定；搜索显示命中数；切组自动滚到选中；「跳到当前」生效；地区/搜索切组后复位。
- 回归：card/list/table/chips 模式不受影响；全局过滤框与工具栏排序仍工作；设置弹窗排序 select 与工具栏下拉同步。
