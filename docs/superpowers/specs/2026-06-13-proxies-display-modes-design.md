# Proxies 页多展示模式设计

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Date     | 2026-06-13                                                   |
| Status   | Draft (awaiting user review)                                 |
| Scope    | `/proxies` 页新增 Table / Chips / Master-detail 三种展示模式 |
| Approach | 单一互斥模式列表（5 种）+ 工具栏图标分段控件切换             |

## 1. 背景

当前 proxies 页用「卡片网格」展示分组与节点,信息密度高但占空间、分组多时需要长距离滚动。用户希望提供更多展示形态,且明确表示「全都要」——把多种形态都做成可切换的展示模式。

## 2. 现状

- **页面结构**(`pages/proxies.vue`):顶部工具栏(Tabs + Collapse All + Test All + 设置齿轮)→ 滚动容器 → `ProxiesRenderWrapper`(按 `renderProxiesInTwoColumns` 做单/双列)→ 每个分组一个 `Collapse` 面板。
- **分组面板**(`components/Collapse.vue`):标题 + body。body 容器按 `isListMode` 切换:
  - List → `flex flex-col gap-3`(渲染 `ProxyNodeListItem`,紧凑单行)
  - 否则 Card → `grid` + `cardGridStyle`(auto-fill minmax,渲染 `ProxyNodeCard`)
- **节点渲染**:`ProxyNodes` 组件返回节点子数组,带渐进渲染(renderCount 窗口 + IntersectionObserver sentinel),Card/List 二选一由 `configStore.proxiesDisplayMode` 决定。
- **枚举**(`constants/index.ts`):`PROXIES_DISPLAY_MODE = { CARD='cardMode', LIST='listMode' }`。
- **配置**(`stores/config.ts`):`proxiesDisplayMode` localStorage,默认 `CARD`,reset 回 `CARD`。
- **切换入口**:目前在设置抽屉里一个 `<select>`(proxies.vue ~1091-1101)。
- **Provider tab**:`ProviderProxyNodes` + provider 的 `Collapse`,与 proxies 共用同一套 display mode。

## 3. 设计目标

在现有「每组一面板」结构上,新增 Table、Chips 两种**组内节点渲染**模式,以及 Master-detail 一种**页面级布局**模式,与已有 Card、List 一起组成 5 种互斥模式,通过工具栏图标分段控件一键切换。

## 4. 范围与非范围

**在范围内**:

- `PROXIES_DISPLAY_MODE` 枚举扩展:新增 `TABLE='tableMode'`、`CHIPS='chipsMode'`、`MASTER='masterDetailMode'`(LIST 已有)
- 新增组件 `ProxyNodeTableRow.vue`(表格行)、`ProxyNodeChip.vue`(药丸)
- 新增页面级组件 `ProxyMasterDetail.vue`(左分组导航 + 右详情)
- `Collapse.vue` body 容器按 5 种 mode 切换布局;table 模式额外渲染表头行
- `pages/proxies.vue` 工具栏新增 5 图标分段控件(绑 `proxiesDisplayMode`);mode==master 时 Proxies tab 走 `ProxyMasterDetail`
- 删除设置抽屉里旧的 Display Mode `<select>`(切换入口统一到工具栏)
- i18n `{en,zh,ru}.json` 新增 `tableMode`/`chipsMode`/`masterDetailMode` 词条

**不在范围内(明确推迟)**:

- **Provider tab 的 Master-detail**:provider tab 在 master 模式下退化为「堆叠 + List 行渲染」,不做 provider 的主从布局
- Table 列的可拖拽排序 / 可配置列(列固定:选中态 · 名称 · 类型 · 延迟 · UDP)
- Master-detail 详情区的多种节点渲染切换(详情区固定用 List 行)
- 新模式下的额外排序/筛选 UI(沿用现有 `proxiesOrderingType` 等)
- Chips / Table 的独立密度配置(Card 的 `proxiesCardSize` 不影响它们)

## 5. 枚举与配置

### 枚举(`constants/index.ts`)

```ts
export enum PROXIES_DISPLAY_MODE {
  CARD = 'cardMode',
  LIST = 'listMode',
  TABLE = 'tableMode',
  CHIPS = 'chipsMode',
  MASTER = 'masterDetailMode',
}
```

### 配置(`stores/config.ts`)

- `proxiesDisplayMode` 默认值与 reset 值保持 `CARD` 不变。
- 新枚举值是全新字符串,对旧 localStorage 向后兼容(老用户仍是 `cardMode`/`listMode`)。
- 无需迁移逻辑。

## 6. 组内渲染模式:Card / List / Table / Chips

这四种共用现有「每组一面板 + 渐进渲染」结构,差异只在 `Collapse.vue` body 容器布局与 `ProxyNodes` 渲染的子组件。

### 6.1 Collapse.vue body 容器

把现在的二元 `isListMode` 判断改为基于 `proxiesDisplayMode` 的多分支:

| Mode  | body 容器 class                     | 备注                     |
| ----- | ----------------------------------- | ------------------------ |
| Card  | `grid` + `cardGridStyle`(现状)      | 不变                     |
| List  | `flex flex-col gap-3`(现状)         | 不变                     |
| Chips | `flex flex-wrap gap-2`              | 药丸平铺                 |
| Table | `flex flex-col`(行容器)+ 顶部表头行 | 表头由 body 在节点前插入 |

Master 模式不经过 `Collapse`(见 §7),因此 Collapse 只需处理 Card/List/Chips/Table 四种。

### 6.2 ProxyNodes 渲染分支

`ProxyNodes`(及 provider 的 `ProviderProxyNodes`)的节点 `h()` 分支从二元扩展为四元:

```text
CHIPS  → h(ProxyNodeChip, {...})
TABLE  → h(ProxyNodeTableRow, {...})
LIST   → h(ProxyNodeListItem, {...})   // 现状
其他   → h(ProxyNodeCard, {...})       // 现状默认
```

渐进渲染窗口(renderCount / sentinel)逻辑不变,所有模式复用。

### 6.3 ProxyNodeTableRow.vue(新)

- 单行,固定列宽确保与表头对齐:**选中点(w-4) · 名称(flex-1, truncate) · 类型(w-16) · 延迟(w-14, 右对齐) · UDP(w-8)**。
- 复用现有 props 约定(`proxyName` / `testUrl` / `timeout` / `isSelected` / `providerName`)与 store 取数逻辑(参照 `ProxyNodeListItem.vue`)。
- 延迟数字用 `Latency` 组件 + `getLatencyClassName` 着色;点击延迟触发单点测速。
- 选中行高亮(`bg-primary/15` + 左边框),整行点击选择节点。
- 表头行由 `Collapse.vue` 在 table 模式下渲染(同样的固定列宽 + i18n 列名),不属于 `ProxyNodeTableRow`,避免每行重复表头。

### 6.4 ProxyNodeChip.vue(新)

- 行内药丸:**延迟色点 + 名称 + 延迟数字**,可选 UDP 角标。
- 延迟色点用 `getLatencyClassName` 着色;选中态 `bg-primary text-primary-content`。
- 整体点击选择节点;复用与 ListItem 相同的 store 取数。
- 比 List 行更紧凑,一屏显示节点最多。

## 7. 页面级模式:Master-detail

### 7.1 行为

- 仅作用于 **Proxies tab**。当 `proxiesDisplayMode === MASTER` 且 `activeTab === 'proxies'` 时,Proxies 内容区不渲染 `ProxiesRenderWrapper`/`Collapse` 堆叠,改渲染 `ProxyMasterDetail`。
- Provider tab 在 master 模式下退化:仍走现有堆叠,节点渲染回退到 List 行(避免 master 模式下 provider 无法显示)。

### 7.2 ProxyMasterDetail.vue(新)

- 布局:`flex`,左 rail(`w-48` 量级,可滚动)+ 右详情(`flex-1`,可滚动)。
- **左 rail**:列出所有非 hidden 分组,每项显示分组名 + `alive/total` 计数 + 当前选中节点的简短指示;高亮当前 active 分组。点击切换 active 分组。
- **右详情**:展示 active 分组的标题区(复用 `ProxyGroupTitle` 的关键信息:类型/now/测速按钮/推荐切换)+ 节点列表(用 `ProxyNodeListItem` 渲染,沿用 `getSortedProxyNames` 排序与渐进渲染)。
- **active 分组 state**:组件内 `ref`,默认取第一个分组;分组列表变化时若 active 失效则回退到第一个。
- **窄屏退化**(`< sm`):左 rail 收为顶部一个分组下拉/横向可滚 chips,详情占满宽度。

### 7.3 复用与取数

- 排序/筛选复用 `sortedNamesByGroup`(已在 proxies.vue 计算);可将其作为 prop 传入,或在组件内复用 store。优先**传入** `renderProxies` 与 `sortedNamesByGroup` 以避免重复计算。
- 选择节点复用 `proxiesStore.selectProxyInGroup`。

## 8. 切换入口:工具栏分段控件

- 位置:`pages/proxies.vue` 工具栏 Collapse All / Test All 旁(`activeTab === 'proxies'` 与 `'proxyProviders'` 都显示,因为前 4 种对 provider 也生效)。
- 形态:5 个图标按钮组成的分段控件,当前模式高亮(参照工具栏现有按钮样式 `bg-primary text-primary-content`)。
- 图标(`@tabler/icons-vue`):Card→`IconLayoutGrid`、List→`IconList`、Table→`IconTable`、Chips→`IconTags`、Master→`IconLayoutSidebar`。每个按钮 `title` 用 i18n 文案。
- 绑定 `configStore.proxiesDisplayMode`。
- 可抽成小组件 `ProxiesDisplayModeSwitcher.vue` 保持 proxies.vue 精简(推荐)。
- **删除**设置抽屉里旧的 Display Mode `<select>`(proxies.vue ~1091-1101)及其不再需要的相关行。

## 9. i18n 词条

`i18n/locales/{en,zh,ru}.json` 各新增:

| key                | en            | zh   | ru            |
| ------------------ | ------------- | ---- | ------------- |
| `tableMode`        | Table         | 表格 | Таблица       |
| `chipsMode`        | Chips         | 药丸 | Чипы          |
| `masterDetailMode` | Master-detail | 主从 | Мастер-деталь |

(现有 `cardMode`/`listMode`/`proxiesDisplayMode` 保留。)

## 10. 分阶段实现

每阶段独立可用、可单独 review。

- **Phase 1 — 切换链路 + Chips**:扩展枚举、加 i18n、工具栏分段控件(并删除旧 select)、`ProxyNodeChip` + Collapse chips 分支、`ProxyNodes` 分支接 Chips。打通「切换即生效」链路,Chips 最简单可先验证。
- **Phase 2 — Table**:`ProxyNodeTableRow` + Collapse table 分支(含表头行)+ `ProxyNodes` 接 Table。
- **Phase 3 — Master-detail**:`ProxyMasterDetail` 页面级组件 + proxies.vue 在 master 模式下的分支 + provider 退化逻辑 + 窄屏退化。

## 11. 测试

- 组件渲染单测:`ProxyNodeChip`、`ProxyNodeTableRow`、`ProxyMasterDetail`(渲染、选中态、点击选择)。
- 注意 `test/setup.ts` 的 auto-import stub:新增组件若用到尚未注册的 store / Vue API,需在 setup 里补 stub,否则报 "X is not defined"(见项目记忆)。
- 切换模式的集成层面:确认 `proxiesDisplayMode` 各值都能渲染对应布局且不报错;master 模式下 provider tab 正确退化。

## 12. 风险与注意

- **Table 列对齐**:采用固定列宽(Tailwind `w-*`)的 flex 行 + 同宽表头,避免引入 CSS grid `display:contents` 的复杂度;长名称 `truncate`。
- **双列布局**:Card/List/Table/Chips 继续兼容 `renderProxiesInTwoColumns`;Master 模式本身是全宽布局,忽略双列设置。
- **渐进渲染**:所有组内模式复用现有窗口逻辑,避免大分组一次性挂载导致卡顿。
- **stickyGroupHeader / proxiesCardSize 等现有配置**:仅 Card 模式相关的(如 card size)对新模式无效,符合预期,不需报错。
