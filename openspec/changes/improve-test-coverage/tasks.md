## 1. 测试基础设施

- [x] 1.1 配置 vitest.config.ts 添加覆盖率支持
- [x] 1.2 更新 package.json 添加测试脚本 (test:unit, test:coverage)
- [x] 1.3 创建测试工具文件 `test/setup.ts` 配置全局 mock

## 2. Utils 单元测试

- [x] 2.1 创建 `utils/__tests__/nodeScoring.spec.ts`
- [x] 2.2 测试 calculateNodeScore 函数
- [x] 2.3 测试 getScoreColorClass 函数
- [x] 2.4 测试 formatTimeSince 函数
- [x] 2.5 创建 `utils/__tests__/index.spec.ts`
- [x] 2.6 测试 formatProxyType 函数
- [x] 2.7 测试 getLatencyClassName 函数
- [x] 2.8 测试其他工具函数

## 3. Stores 单元测试

- [x] 3.1 创建 `stores/__tests__/nodeRecommendation.spec.ts`
- [x] 3.2 测试 recordTestResult 方法
- [x] 3.3 测试 recordBatchResults 方法
- [x] 3.4 测试 toggleExclusion 方法
- [x] 3.5 测试 localStorage 持久化
- [x] 3.6 创建 `stores/__tests__/shortcuts.spec.ts`
- [x] 3.7 测试 updateShortcut 方法
- [x] 3.8 测试 findConflict 方法
- [x] 3.9 测试 resetToDefaults 方法

## 4. Composables 单元测试

- [x] 4.1 创建 `composables/__tests__/useKeyboardShortcuts.spec.ts`
- [x] 4.2 测试导航快捷键 (g+p, g+c 等)
- [x] 4.3 测试输入框焦点时禁用快捷键
- [x] 4.4 测试帮助模态框快捷键 (?)
- [x] 4.5 创建 `composables/__tests__/useBatchLatencyTest.spec.ts`
- [x] 4.6 测试并发控制逻辑
- [x] 4.7 测试进度追踪

## 5. 覆盖率配置

- [x] 5.1 配置覆盖率阈值 (stores 80%, utils 90%)
- [x] 5.2 添加覆盖率报告到 CI 流程
- [x] 5.3 验证所有测试通过并生成覆盖率报告
