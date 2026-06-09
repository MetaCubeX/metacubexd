# ConnectionsTable 信息密度提升设计

| Field    | Value                              |
| -------- | ---------------------------------- |
| Date     | 2026-05-09                         |
| Status   | Draft (awaiting user review)       |
| Scope    | `/connections` 页 ConnectionsTable |
| Approach | 复合列（双轨制）+ 主辅双行排版     |

## 1. 背景

`metacubexd` 近期在演进一套 motion design system（spring 缓动 / lift 阴影 / light catch / press 反馈）。在此基础上提出"提升信息密度"的设计目标：让单个组件携带更多信息而不增加组件本身占用的空间。

经讨论将范围聚焦到 ConnectionsTable，因为：

- **价值最高**：调试代理时一行连接信息的密度直接决定排错效率。
- **数据完备**：mihomo 后端已返回 connection 元数据的全部字段，`Connection` 类型已包含所有需要的 sub-field，无需 API/store 改动。
- **结构允许**：列定义为 `ConnectionColumn` 数组、`render()` 返回 VNode，主辅双行可在 render 函数内组装而不动渲染骨架。

## 2. 现状

`pages/connections.vue:104` 定义了 `allColumns`（15 个原子列）。`constants/index.ts:109` 设置默认开启 8 列：Details / Close / Host / Rule / Chains / DlSpeed / UlSpeed / SourceIP。每列 cell 单行 nowrap 显示一个字段。

## 3. 设计目标

把同一行（约 40px）的信息量提升约 2 倍，方法：

1. **同一 cell 内做主辅双行排版**（强信号在上 / 辅信号在下）
2. **合并相关字段为复合列**（Host+Process / Rule+Chains / DlSpeed+UlSpeed+Download+Upload / SourceIP+Destination）
3. **统一 typography**（tabular-nums、辅行 58% 不透明、字号梯度）

## 4. 范围与非范围

**在范围内**：

- ConnectionsTable 默认列结构调整（双轨制：新增复合列、保留原子列）
- 主辅双行 cell 渲染规格
- 行高、字号、padding、tabular-nums 规格
- 与 motion system 的协调（沿用背景色 hover、不为数据行加 lift）

**不在范围内（明确推迟）**：

- ProxyNodeCard / ProxyNodeListItem / TrafficWidget 的密度提升（后续作为独立 spec）
- 提供 "compact mode toggle" 之类的全局开关
- 新增 connection 字段或后端 API 改动
- ConnectionsSettingsModal 的 UI 重构（仅做兼容性核查）

## 5. 默认 6 列结构

| #   | 列               | 主行（13px / 500 / 100% opacity） | 辅行（11px / 400 / 58% opacity）                 | sortId        | groupable |
| --- | ---------------- | --------------------------------- | ------------------------------------------------ | ------------- | --------- |
| 1   | **Action**       | `[👁] [✕]`（垂直居中）            | —（cell 不分主辅）                               | —             | no        |
| 2   | **Host/Process** | `getHost(conn)`                   | `process` · `processPath`（`'-'` 时退化为 nbsp） | `Host`        | yes       |
| 3   | **Rule/Chains**  | `getRule(conn)`                   | `chains.reverse().join(' → ')`                   | `Rule`        | yes       |
| 4   | **Traffic**      | `↓ DlSpeed/s · ↑ UlSpeed/s`       | `∑ ↓Download · ↑Upload`                          | `DlSpeed`     | no        |
| 5   | **Flow**         | `getSourceIP(conn):sourcePort`    | `→ getDestination(conn)`                         | `SourceIP`    | yes       |
| 6   | **Time**         | 相对持续时间（`mm:ss`/`Xh`）      | 绝对开始时间（`HH:mm:ss`）                       | `ConnectTime` | no        |

**辅行字段为空时**：渲染 `' '` 占位以维持等高（用户已确认强制等高优于"凹凸感"）。

**排序语义**：每列只有 1 个 sortId，沿用现有 sortId 字符串以保持 localStorage 兼容。辅行字段可显示但不可作为排序键。需要按 process / destinationIP 排序的高级用户：通过 ConnectionsSettingsModal 启用对应原子列。

**Group by 语义**：复合列的 `groupValue` 按主行字段（如 HostProcess 按 host 分组）。需要按 process / chains 分组的用户：通过 Settings Modal 启用对应原子列。

## 6. Typography 与行高规格

**行高（强制等高）**：`52px`（双行内容 + 上下 8px 纵向 padding）

| 层   | font-size          | line-height | font-weight | color                                                             |
| ---- | ------------------ | ----------- | ----------- | ----------------------------------------------------------------- |
| 主行 | `13px` / 0.8125rem | `1.4`       | `500`       | `var(--color-base-content)`                                       |
| 辅行 | `11px` / 0.6875rem | `1.35`      | `400`       | `color-mix(in oklch, var(--color-base-content) 58%, transparent)` |

**全表样式**：

- `font-variant-numeric: tabular-nums` 加在 `.conn-table-container` — 数字列对齐的硬性前提。
- 主辅之间 gap `2px`。
- 辅行 `text-overflow: ellipsis; white-space: nowrap`，禁止换行（保等高）。

**Cell padding**：

| 部位      | 当前       | 调整       | 原因                           |
| --------- | ---------- | ---------- | ------------------------------ |
| `td` 横向 | `0.875rem` | `0.625rem` | 让 6 列在 1280px 视口不挤压    |
| `td` 纵向 | `0.75rem`  | `0.5rem`   | 双行内容主导高度，padding 让位 |

**与 motion system 的协调**：

- **不**给 `.conn-data-row` 加 `:hover { transform: translateY(-Npx) }`。表格行 lift 会让上下相邻行视觉重叠 — 沿用现有"背景色 hover"。
- 保留现有 `.conn-data-row` 的 fadeIn 入场动画。`animationDelay` 步长由 `15ms` 改为 `12ms`。
- **不**引入"主先辅后"的双层入场动画（防止快速滚动时整张表"翻涌"）。

## 7. 实现路径

**策略**：双轨制 — 新增 4 个复合列，原子列全部保留。已有用户的 localStorage 列偏好继续生效；新用户/重置默认者获得新 6 列默认。

### 文件改动清单

| 文件                                                            | 改动                                                                                                                                                       | 行数估算 |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `constants/index.ts`                                            | `CONNECTIONS_TABLE_ACCESSOR_KEY` 加 `HostProcess` / `RuleChains` / `Traffic` / `Flow` 4 值；改 `CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY` 默认开启 6 列 | ~10      |
| `pages/connections.vue`                                         | `allColumns` 数组新增 4 个 ConnectionColumn 定义，每个 render 返回主辅双行 VNode                                                                           | ~120     |
| `components/connections/ConnectionsTable.vue`                   | `.conn-td` 纵向 padding 调小；新增 `.conn-cell-stack` (主辅 flex-col)、`.conn-aux` (辅行 opacity/font-size/min-height)；fadeIn delay 调整                  | ~30      |
| `assets/css/main.css`                                           | `.conn-table-container { font-variant-numeric: tabular-nums }`                                                                                             | ~3       |
| `i18n/locales/en.json` / `zh.json` / `ru.json`                  | 加 4 个翻译键 (`hostProcess` / `ruleChains` / `traffic` / `flow`)                                                                                          | ~12      |
| `types/index.ts` / `stores/connections.ts` / `stores/config.ts` | **不改**                                                                                                                                                   | 0        |

### 复合列 render 草图（HostProcess 列）

```ts
{
  id: CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess,
  key: 'hostProcess',
  groupable: true,
  sortable: true,
  sortId: 'Host',
  render: (conn: Connection) => h('div', { class: 'conn-cell-stack' }, [
    h('div', { class: 'conn-primary' }, getHost(conn)),
    h('div', { class: 'conn-aux' },
      [getProcess(conn), conn.metadata.processPath].filter(Boolean).join(' · ')
        || ' '),
  ]),
  groupValue: (conn: Connection) => getHost(conn),
}
```

### CSS 草图

```css
.conn-cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: calc(18.2px + 14.85px + 2px); /* 主行 + 辅行 + gap */
}
.conn-primary {
  font-size: 0.8125rem;
  line-height: 1.4;
  font-weight: 500;
}
.conn-aux {
  font-size: 0.6875rem;
  line-height: 1.35;
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 58%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

## 8. i18n 翻译键

```json
{
  "hostProcess": {
    "en": "Host / Process",
    "zh": "主机 / 进程",
    "ru": "Хост / Процесс"
  },
  "ruleChains": {
    "en": "Rule / Chains",
    "zh": "规则 / 链路",
    "ru": "Правило / Цепочки"
  },
  "traffic": {
    "en": "Traffic",
    "zh": "流量",
    "ru": "Трафик"
  },
  "flow": {
    "en": "Flow",
    "zh": "流向",
    "ru": "Поток"
  }
}
```

实现时按 `i18n/locales/` 现有 JSON 结构同步。

## 9. 验证

1. `pnpm dev:mock` → `/connections` → 触发 mock 连接 → 确认 6 列默认显示、行高 ~52px、辅行 58% 不透明。
2. 切换至少 3 个 daisyUI 主题（light / dark / 一个高对比），确认辅行可读。
3. 真后端连接 1 分钟以上，确认速率刷新不引起列宽抖动（tabular-nums 验证）。
4. Settings Modal → 关闭 HostProcess、开启原子 Host → 确认双轨制工作。
5. 移动卡片模式：复合列变为"label + 主行 + 辅行"三行，确认不破版。
6. `pnpm screenshot` 重新生成 `/connections` 截图。
7. localStorage 已有列偏好的用户（手动构造）刷新后列开关行为符合预期。

## 10. 风险与边界

| 风险                                                 | 缓解                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 极长 IPv6 + 端口组合在 Flow 列溢出                   | 主行 `text-overflow: ellipsis`；列宽 min 280px                                                     |
| 用户同时开启复合列与对应原子列（HostProcess + Host） | 允许（冗余但不报错），不做拦截                                                                     |
| 强制等高在简单连接上视觉浪费                         | 用户已知会权衡选择此项                                                                             |
| 旧 localStorage 中保存的 sortId 是原子列的           | 复合列继承相同 sortId 字符串（`Host` / `Rule` / `DlSpeed` / `SourceIP` / `ConnectTime`）→ 自动兼容 |
| 移动 force-table 模式列过密                          | force-table 是用户主动启用的"高级"模式，由用户负担                                                 |

## 11. 推迟项（明确不做）

- ProxyNodeCard / ProxyNodeListItem / TrafficWidget 的密度提升 → 后续 spec
- Compact mode 全局开关
- 新连接进入时的"高亮闪烁"提示
- 列宽用户可拖拽调整（已支持 resize-x，不动）
- 复合列内字段的可见性微调（如"我只想 HostProcess 但不要 path"）

## 12. 完成标准

- 默认 6 列在所有 daisyUI 主题下视觉合规。
- localStorage 兼容：旧用户列偏好不丢失，新用户得到新默认。
- `pnpm typecheck` / `pnpm lint` / `pnpm test:e2e` 全部通过。
- `/connections` 截图脚本重新生成无视觉回归（除预期的密度变化）。
