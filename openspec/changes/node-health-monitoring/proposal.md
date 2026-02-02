## Why

用户无法及时感知节点掉线或性能下降的情况，往往在使用出现问题后才发现节点不可用。添加节点健康监控和告警功能可以主动发现问题，提升用户体验和网络可靠性。

## What Changes

- 实现后台定时节点健康检查
- 添加节点状态监控面板
- 支持浏览器通知推送（节点掉线、恢复）
- 添加健康检查配置（间隔、阈值）
- 实现节点可用性历史记录和统计

## Capabilities

### New Capabilities

- `node-health-monitoring`: 节点健康监控系统，包括定时检查、状态面板、通知告警、配置管理、可用性统计

### Modified Capabilities

（无）

## Impact

- **Store**: 新增 `stores/nodeHealth.ts` 管理健康状态数据
- **Composable**: 新增 `composables/useNodeHealthCheck.ts` 处理定时检查逻辑
- **页面**: 修改 `pages/proxies.vue` 添加健康状态指示
- **组件**: 新增节点健康监控面板组件
- **通知**: 使用 Web Notifications API 推送告警
- **Worker**: 可能需要 Service Worker 支持后台检查
