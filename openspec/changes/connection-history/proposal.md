## Why

当前 Connections 页面只显示活跃连接，连接关闭后数据即消失。用户在排查网络问题时，往往需要查看已关闭的连接历史，以分析连接模式、定位问题来源。

## What Changes

- 在本地存储保存已关闭的连接历史记录
- 添加连接历史查看页面/标签页
- 支持按时间、域名、应用等条件筛选历史记录
- 支持导出连接历史为 CSV/JSON 格式
- 添加历史记录容量限制和自动清理机制

## Capabilities

### New Capabilities

- `connection-history`: 连接历史记录功能，包括历史存储、查询筛选、数据导出、自动清理

### Modified Capabilities

（无）

## Impact

- **Store**: 新增 `stores/connectionHistory.ts` 管理历史数据
- **存储**: 使用 IndexedDB 存储大量历史记录
- **页面**: 修改 `pages/connections.vue` 添加历史标签页
- **组件**: 新增历史记录表格和筛选组件
- **工具**: 新增 CSV/JSON 导出工具函数
