## Why

当前项目仅有 1 个 e2e 测试文件 (`e2e/pages.spec.ts`)，缺少单元测试覆盖。核心业务逻辑如 stores、composables、utils 没有测试保护，导致重构和功能迭代时容易引入回归问题。需要建立完善的单元测试体系，提高代码质量和可维护性。

## What Changes

- 添加 stores 单元测试（nodeRecommendation, shortcuts, config 等）
- 添加 composables 单元测试（useKeyboardShortcuts, useBatchLatencyTest, useLatencyTest 等）
- 添加 utils 单元测试（nodeScoring, index 工具函数）
- 配置测试覆盖率报告
- 建立测试最佳实践和规范

## Capabilities

### New Capabilities

- `unit-testing`: 单元测试基础设施和核心模块测试覆盖

### Modified Capabilities

<!-- 无需修改现有 specs -->

## Impact

- 新增测试文件：`stores/__tests__/`, `composables/__tests__/`, `utils/__tests__/`
- 修改 `vitest.config.ts` 添加覆盖率配置
- 修改 `package.json` 添加测试脚本
