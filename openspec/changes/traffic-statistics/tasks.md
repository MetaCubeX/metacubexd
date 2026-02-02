## 1. 采集服务扩展

- [ ] 1.1 在 `metacubexd-collector` 中添加流量采集模块
- [ ] 1.2 订阅 Mihomo `/traffic` WebSocket
- [ ] 1.3 实现每秒流量数据采样
- [ ] 1.4 设计流量统计表 schema（raw/hourly/daily）

## 2. 数据聚合

- [ ] 2.1 实现分钟级聚合任务（原始 → 小时表）
- [ ] 2.2 实现小时级聚合任务（小时 → 日表）
- [ ] 2.3 实现定时任务调度器
- [ ] 2.4 实现数据保留策略清理

## 3. 查询 API

- [ ] 3.1 实现 `GET /api/traffic/realtime` 实时数据
- [ ] 3.2 实现 `GET /api/traffic/hourly` 小时数据查询
- [ ] 3.3 实现 `GET /api/traffic/daily` 日数据查询
- [ ] 3.4 实现 `GET /api/traffic/monthly` 月数据查询
- [ ] 3.5 实现 `GET /api/traffic/summary` 汇总统计

## 4. 前端统计视图

- [ ] 4.1 创建 `composables/useTrafficStats.ts` 封装 API 调用
- [ ] 4.2 创建 `components/TrafficStatsCard.vue` 统计摘要卡片
- [ ] 4.3 创建 `components/TrafficStatsChart.vue` 统计图表组件
- [ ] 4.4 实现日视图柱状图（Highcharts）
- [ ] 4.5 实现周视图柱状图
- [ ] 4.6 实现月视图柱状图
- [ ] 4.7 添加趋势线叠加

## 5. Overview 页面集成

- [ ] 5.1 修改 `pages/overview.vue` 添加统计区域
- [ ] 5.2 添加今日/本月用量摘要卡片
- [ ] 5.3 添加视图切换（日/周/月）选项
- [ ] 5.4 实现降级显示（无服务时显示会话级统计）

## 6. 数据导出与管理

- [ ] 6.1 实现统计数据 CSV 导出
- [ ] 6.2 添加清空统计按钮和确认对话框
- [ ] 6.3 添加服务不可用时的部署引导

## 7. 国际化与测试

- [ ] 7.1 添加国际化文本
- [ ] 7.2 编写采集服务流量模块测试
- [ ] 7.3 编写前端图表组件测试
