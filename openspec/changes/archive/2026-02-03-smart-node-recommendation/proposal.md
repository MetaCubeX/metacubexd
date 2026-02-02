## Why

用户面对大量代理节点时，难以快速选择最佳节点。智能节点推荐功能可以根据延迟、稳定性等指标自动分析并推荐最优节点，同时提供批量延迟测试能力，提升用户体验。

## What Changes

- 实现一键批量延迟测试所有节点
- 添加智能节点评分算法（综合延迟、稳定性、历史表现）
- 在代理组显示推荐节点标记
- 支持自动切换到推荐节点（可选）
- 添加节点性能历史追踪

## Capabilities

### New Capabilities

- `smart-node-recommendation`: 智能节点推荐系统，包括批量延迟测试、节点评分算法、推荐展示、自动切换、性能追踪

### Modified Capabilities

（无）

## Impact

- **Store**: 新增 `stores/nodeRecommendation.ts` 管理评分和推荐数据
- **Composable**: 扩展 `composables/useLatencyTest.ts` 支持批量测试
- **页面**: 修改 `pages/proxies.vue` 添加推荐标记和批量测试按钮
- **组件**: 修改 `ProxyNodeCard.vue` 显示评分和推荐状态
- **存储**: 使用 localStorage 存储节点历史性能数据
