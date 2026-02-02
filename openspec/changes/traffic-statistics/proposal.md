## Why

目前 Overview 页面只显示实时流量数据，用户无法了解历史流量使用情况。添加流量统计功能可以帮助用户追踪流量消耗趋势，更好地管理网络使用。

## What Changes

- 持久化存储流量使用数据（上传/下载量）
- 添加按日/周/月的流量统计视图
- 实现流量趋势图表（柱状图/折线图）
- 支持导出统计数据为 CSV 格式
- 添加流量统计仪表盘小部件

## Capabilities

### New Capabilities

- `traffic-statistics`: 流量历史统计功能，包括数据持久化、多维度统计视图、趋势图表、数据导出

### Modified Capabilities

（无）

## Impact

- **Store**: 新增 `stores/trafficStats.ts` 管理统计数据
- **存储**: 使用 IndexedDB 存储历史流量数据
- **页面**: 修改 `pages/overview.vue` 添加统计区域
- **组件**: 新增流量统计图表组件（使用 Highcharts）
- **Composable**: 新增 `composables/useTrafficStats.ts` 处理数据聚合
