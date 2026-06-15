# Desktop Parity — Wave 4 实现计划(Merge profile + polish)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> **好消息:`yaml`(^2.9.0)已是 `packages/agent` 依赖且已安装**(parse/stringify 可用)→ 本波**无需 `pnpm install`**。

**范围:** Profile 合成 —— Merge(YAML 覆盖)类型 + 在 `setActive` 时把 base 与启用的 merge 叠加成最终 active config;UI 管理 merge profile;外加 polish 修系统代理面板吞错误。
**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;conventional commit)。

---

## Task 1 — agent:`mergeConfigs` YAML 深合并工具

**Files:** 新 `packages/agent/src/merge.ts`、`index.ts`(导出);测试 `merge.test.ts`。

- `mergeConfigs(base: string, overlays: string[]): string`:用 `import { parse, stringify } from 'yaml'` 解析,按顺序把每个 overlay 叠到 base 上,再 stringify 返回。
- 合并语义(文档化 + 测试):
  - 普通对象 → 深合并;标量/非指令数组 → overlay **覆盖** base。
  - **指令键**(消费后不写入输出):overlay 里的 `prepend-rules`/`append-rules`、`prepend-proxies`/`append-proxies`、`prepend-proxy-groups`/`append-proxy-groups` → 把数组**前插/追加**到 base 对应数组(base 无则视为空)。(对齐 Clash Verge merge 约定)
  - base 或某 overlay 解析为非对象 → 抛清晰错误。
- 纯函数,无 IO。

**验收:** 深合并对象、标量覆盖、prepend/append 指令前插/追加且不泄漏指令键、多 overlay 按序、非法 YAML 抛错。agent `test`+`typecheck` 绿。

## Task 2 — agent:Merge profile 模型 + `setActive` 合成

**Files:** `packages/agent/src/types.ts`、`profiles.ts`、`http.ts`;测试 `profiles.test.ts`、`http.test.ts`。

- `types.ts`:`ProfileType = 'local' | 'remote' | 'merge'`;`ProfileMeta` 增 `enabled?: boolean`(仅 merge 用,缺省视为 true);`ProfileStore.create` 签名加可选 `type?`、`update` 加可选 `enabled?`。
- `profiles.ts`:
  - `create({ name, content?, type? })`:type 缺省 'local';允许 'merge'/'local'。
  - `update(id, { name?, content?, enabled? })`:支持改 enabled。
  - `setActive(baseId)`:若该 id 是 'merge' 类型 → 抛错(merge 不能作为 base);否则读 base 内容,收集所有 `type==='merge' && enabled !== false` 的 profile(按 index 顺序)内容,**若有**则 `mergeConfigs(base, overlays)` 写入 activeConfigPath,**若无**则按原样写 base(保持现有行为、不无谓重排)。
- `http.ts`:`POST /profiles` 透传 `type`;`PUT /profiles/:id` 透传 `enabled`。

**验收:** 创建 merge profile;active base 自动叠加启用的 merge;禁用的 merge 不参与;无 merge 时 active 内容与 base 逐字节一致(回归现有 setActive 测试);merge 作 base 抛错。agent `test`+`typecheck` 绿。

## Task 3 — desktop UI:Merge profile 管理

**Files:** `packages/ui/`(pages/profiles.vue 等;沿用现有 create/edit/Monaco/delete 模式);测试 + `test/setup.ts`。

- profiles 页(已 agent 门控):加"New merge profile"入口(`POST /profiles { type:'merge' }`);merge 与普通 profile **分区展示**;每个 merge 有 enabled 开关(`PUT /profiles/:id { enabled }`);可用 Monaco 编辑 merge 内容、删除。
- 说明文案:merge 会叠加到当前 active base 上(i18n en/zh/ru)。
- 切换 enabled / 编辑 merge 后,若已有 active base,触发其重新 activate 以重算合成(调用现有 activate),或提示用户。择简:改动后调用 `POST /profiles/:activeBaseId/activate` 重算(若存在 active 且为非 merge)。
- 新 auto-import 依赖在 `test/setup.ts` 注册([[test-setup-auto-import-stubs]]);不吞错误(toast)。

**验收:** 能创建/编辑/启停/删除 merge profile;启停触发重新合成;不回归现有 profiles 测试。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 4 — polish:修系统代理面板吞错误(W2-T5 遗留)

**Files:** `packages/ui/`(`SystemProxyControlPanel.vue` 或对应文件);测试。

- 把 onMounted 加载 / 开关 / Apply 保存里的 `.catch(() => {})` 改为**向用户反馈**:失败时 `vue-sonner` toast 报错(沿用项目现有 toast 用法),并恢复开关到真实状态(失败不要让 UI 停留在乐观态)。
- 加/改测试:失败路径会触发 toast(可 spy toast)。

**验收:** 系统代理操作失败时有可见反馈、开关不卡在错误乐观态;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

---

## 完成后

全包 gate(agent/desktop/server test+typecheck、ui test:unit+typecheck)。汇报。至此 P0/P1 + 该 polish 收尾;剩 **P2 长尾**(按需)与 **TUN**(单独 spec)。
