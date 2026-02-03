## Context

MetaCubeXD 是一个 Mihomo/Clash 的 Web 控制面板，使用 Nuxt 3 + Vue 3 + Pinia 构建。当前仅有 e2e 测试（`e2e/pages.spec.ts`），缺少单元测试。核心模块包括：

- **Stores**: 9 个 Pinia stores（config, connections, endpoint, global, logs, nodeRecommendation, proxies, rules, shortcuts）
- **Composables**: 10 个组合式函数（useApi, useBatchLatencyTest, useKeyboardShortcuts 等）
- **Utils**: 2 个工具模块（index.ts, nodeScoring.ts）

测试框架已配置 Vitest，但未充分利用。

## Goals / Non-Goals

**Goals:**

- 为核心 stores 添加单元测试（优先级：nodeRecommendation, shortcuts, config）
- 为关键 composables 添加单元测试（优先级：useKeyboardShortcuts, useBatchLatencyTest, nodeScoring）
- 为 utils 工具函数添加单元测试
- 配置测试覆盖率报告（目标：核心模块 80%+）
- 建立测试文件组织规范

**Non-Goals:**

- 不增加组件级别的单元测试（组件测试复杂度高，已有 e2e 覆盖）
- 不追求 100% 覆盖率（关注核心逻辑）
- 不重写现有 e2e 测试

## Decisions

### 1. 测试文件组织

**决定**: 使用 `__tests__` 目录模式，测试文件与源文件同级

```
stores/
  __tests__/
    nodeRecommendation.spec.ts
    shortcuts.spec.ts
  nodeRecommendation.ts
  shortcuts.ts
```

**理由**: 便于定位，符合 Vue/Nuxt 社区惯例

### 2. Mock 策略

**决定**: 使用 Vitest 内置 mock，对 localStorage/sessionStorage 使用 vi.stubGlobal

**理由**:

- stores 使用 `useLocalStorage`，需要 mock 浏览器 API
- Vitest 原生支持，无需额外依赖

### 3. 测试优先级

**决定**: 按业务重要性排序

1. `utils/nodeScoring.ts` - 纯函数，最易测试
2. `stores/nodeRecommendation.ts` - 核心业务逻辑
3. `stores/shortcuts.ts` - 用户配置
4. `composables/useKeyboardShortcuts.ts` - 事件处理
5. `composables/useBatchLatencyTest.ts` - 异步逻辑

**理由**: 先易后难，快速建立测试基础

### 4. 覆盖率配置

**决定**: 使用 `@vitest/coverage-v8`，配置阈值警告

**理由**: V8 覆盖率更准确，与 Node.js 原生集成

## Risks / Trade-offs

| 风险                  | 缓解措施                           |
| --------------------- | ---------------------------------- |
| Mock 过多导致测试脆弱 | 优先测试纯函数，减少外部依赖       |
| 测试维护成本增加      | 遵循 AAA 模式，保持测试简洁        |
| 异步测试不稳定        | 使用 `vi.useFakeTimers()` 控制时间 |
