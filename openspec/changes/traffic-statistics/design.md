## Context

MetaCubeXD 的 Overview 页面使用 RealtimeLineChart 组件展示实时流量曲线，数据来自 WebSocket 的 traffic 事件。Mihomo 的 `uploadTotal`/`downloadTotal` 仅为当前运行时累计，重启后归零。

**关键限制**: 纯前端方案只能在标签页打开期间统计，无法实现完整的历史统计。

## Goals / Non-Goals

**Goals:**

- 复用 connection-history 的配套服务，共享基础设施
- 持久化存储流量统计数据
- 提供按日/周/月的统计视图
- 展示流量趋势图表和导出功能

**Non-Goals:**

- 不提供精确到秒级的历史数据（存储成本过高）
- 不实现带宽预测功能
- 不支持多 Mihomo 实例数据汇总

## Decisions

### 1. 复用配套服务

**决定**: 在 connection-history 的采集服务中同时采集流量数据

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Mihomo Core   │ ◄────────────────► │  Data Collector │
│                 │   /traffic         │    (Go/Rust)    │
│                 │   /connections     └────────┬────────┘
└─────────────────┘                             │
                                       ┌────────▼────────┐
                                       │   data.db       │
                                       │  - connections  │
                                       │  - traffic_raw  │
                                       │  - traffic_hour │
                                       │  - traffic_day  │
                                       └─────────────────┘
```

**理由**:

- 减少用户部署负担
- 共享 SQLite 数据库
- 统一配置和认证

### 2. 数据采样与聚合策略

**决定**:

- 原始数据：每秒采样，保留 1 小时
- 小时数据：每分钟聚合，保留 7 天
- 日数据：每小时聚合，保留 365 天

**理由**:

- 服务端聚合，减少存储和查询压力
- 近期数据精度高，远期数据适度模糊
- 平衡存储空间和历史深度

### 3. 聚合时机

**决定**: 服务端定时任务执行聚合（每分钟检查一次）

**理由**:

- 不依赖前端触发
- 保证数据连续性

### 4. 图表展示

**决定**: 使用 Highcharts 柱状图展示日/周/月统计，折线图展示趋势

**理由**:

- 复用现有 Highcharts 依赖
- 柱状图适合离散时间段对比

### 5. 前端降级策略

**决定**:

- 采集服务可用：显示完整历史统计
- 采集服务不可用：仅显示当前会话统计（使用 Mihomo 的 uploadTotal/downloadTotal）

**理由**:

- 保证基础功能可用
- 渐进增强体验

## Risks / Trade-offs

| 风险           | 缓解措施                          |
| -------------- | --------------------------------- |
| 采集服务未部署 | 降级到会话级统计，显示部署引导    |
| 历史数据量过大 | 定时聚合 + 自动清理策略           |
| 时区问题       | 服务端使用 UTC 存储，前端转换显示 |

## API 设计草案

```
GET  /api/traffic/realtime?duration=5m
GET  /api/traffic/hourly?from=&to=
GET  /api/traffic/daily?from=&to=
GET  /api/traffic/monthly?year=
GET  /api/traffic/summary?period=today|week|month|year
POST /api/traffic/cleanup
```

## 数据库 Schema 草案

```sql
-- 原始流量数据（保留1小时）
CREATE TABLE traffic_raw (
  timestamp INTEGER PRIMARY KEY,
  upload INTEGER,
  download INTEGER
);

-- 小时聚合（保留7天）
CREATE TABLE traffic_hourly (
  hour INTEGER PRIMARY KEY,  -- Unix timestamp of hour start
  upload INTEGER,
  download INTEGER
);

-- 日聚合（保留365天）
CREATE TABLE traffic_daily (
  date TEXT PRIMARY KEY,  -- YYYY-MM-DD
  upload INTEGER,
  download INTEGER
);
```
