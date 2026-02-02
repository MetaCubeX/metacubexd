## 1. 配套服务开发

- [ ] 1.1 创建 `metacubexd-collector` Go 项目
- [ ] 1.2 实现 Mihomo WebSocket 连接管理（自动重连）
- [ ] 1.3 订阅 `/connections` WebSocket 监听连接变化
- [ ] 1.4 实现连接关闭检测逻辑（对比前后连接列表）
- [ ] 1.5 初始化 SQLite 数据库和表结构

## 2. 数据存储层

- [ ] 2.1 设计连接历史表 schema
- [ ] 2.2 实现连接记录写入（批量写入优化）
- [ ] 2.3 实现 WAL 模式配置
- [ ] 2.4 实现数据保留策略（定时清理）

## 3. 查询 API

- [ ] 3.1 实现 REST API 框架（Gin/Echo）
- [ ] 3.2 实现 `GET /api/connections/history` 分页查询
- [ ] 3.3 实现时间范围、主机名、网络类型筛选
- [ ] 3.4 实现 `GET /api/connections/stats` 统计接口
- [ ] 3.5 实现 `POST /api/connections/cleanup` 手动清理
- [ ] 3.6 实现 `GET /api/health` 健康检查
- [ ] 3.7 添加 API Token 认证支持

## 4. 部署支持

- [ ] 4.1 编写 Dockerfile
- [ ] 4.2 编写 docker-compose.yml（与 Mihomo 集成）
- [ ] 4.3 编写配置文件示例
- [ ] 4.4 编写部署文档

## 5. 前端集成

- [ ] 5.1 创建 `composables/useCollectorApi.ts` 封装采集服务 API
- [ ] 5.2 实现服务可用性检测
- [ ] 5.3 修改 `pages/connections.vue` 添加 Active/History 标签页
- [ ] 5.4 创建 `components/connections/HistoryTable.vue` 历史记录表格
- [ ] 5.5 实现分页加载历史记录

## 6. 前端筛选与导出

- [ ] 6.1 创建 `components/connections/HistoryFilter.vue` 筛选组件
- [ ] 6.2 实现时间范围筛选 UI
- [ ] 6.3 实现主机名搜索和网络类型筛选
- [ ] 6.4 实现 CSV/JSON 格式导出
- [ ] 6.5 添加服务不可用时的部署引导提示

## 7. 国际化与测试

- [ ] 7.1 添加国际化文本
- [ ] 7.2 编写采集服务单元测试
- [ ] 7.3 编写前端组件测试
