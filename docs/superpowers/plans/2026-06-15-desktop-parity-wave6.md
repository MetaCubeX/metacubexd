# Desktop Parity — Wave 6 实现计划(备份/可观测 + 多语言)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> P2 第二批:WebDAV 备份还原(fetch 手写、**无新依赖**)+ 连接导出 + 运行时配置查看器 + 多语言 ja/ko/fr/fa。

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;注入 fetch 可测;不吞错误;conventional commit;UI 新 auto-import 依赖在 `test/setup.ts` 注册 [[test-setup-auto-import-stubs]])。

---

## Task 1 — agent:WebDAV 客户端 + 备份/还原路由

**Files:** 新 `packages/agent/src/webdav.ts`、`index.ts`、`http.ts`、`types.ts`;测试 `webdav.test.ts`、`http.test.ts`。

- `createWebdavClient({ url, username, password, fetch? })`:`put(path, body)` / `get(path)` / `mkcol(dir)`,fetch-based,Basic Auth(`Authorization: Basic base64(user:pass)`),非 2xx 抛清晰错误。注入 fetch 测试(断言 method/URL/auth header/body)。
- 备份 bundle = JSON `{ version, createdAt?, profiles: [{ meta, content }], uiSettings?: unknown }`(uiSettings 为 UI 透传的不透明对象)。
- `http.ts`(能力门控):
  - `POST /api/control/backup`(body `{ webdav: { url, username, password, dir? }, uiSettings? }`)→ 构造 bundle(读所有 profiles)→ `mkcol(dir)`(忽略已存在)→ `put(dir/metacubexd-backup.json, bundle)` → 返回 `{ ok, path }`。
  - `POST /api/control/restore`(body `{ webdav: {...} }`)→ `get` bundle → 重建 profiles(清理或合并——择简:按 bundle 重新 create,避免重复;返回 `uiSettings` 供 UI 应用)→ `{ ok, restored, uiSettings }`。
  - `info().features` 加 `'webdav-backup'`。
- 凭证仅在 loopback + token 的请求体里,不持久化在 agent。

**验收:** 注入 fetch:put/get/mkcol 的 method/URL/auth 正确;backup 上传 bundle、restore 重建 profiles 并回传 uiSettings;非 2xx 抛错;feature 含 `webdav-backup`。agent `test`+`typecheck` 绿。

## Task 2 — desktop UI:WebDAV 备份/还原界面

**Files:** `packages/ui/`(设置区新增 WebDAV 卡片;复用现有 `useSettingsBackup` 取/应用 UI 设置 + 现有 control 客户端);测试 + `test/setup.ts`。

- 能力门控 `hasFeature('webdav-backup')`:WebDAV 配置表单(url/user/pass/dir,持久化到 UI 设置/localStorage)+「Backup now」「Restore」按钮。
- Backup:把 `useSettingsBackup` 导出的 UI 设置作为 `uiSettings` 一并 `POST /api/control/backup`;Restore:`POST /api/control/restore` 后用返回的 `uiSettings` 调 `useSettingsBackup` 的导入逻辑应用,并刷新 profiles 列表。
- 成功/失败 toast(不吞错误);i18n en/zh/ru。

**验收:** 能力存在时渲染表单+按钮并正确调备份/还原端点、携带/应用 uiSettings;缺失时不渲染。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 3 — agent:运行时配置查看器路由

**Files:** `packages/agent/src/http.ts`、`index.ts`(feature);测试 `http.test.ts`。

- `GET /api/control/config/runtime`:读取 `activeConfigPath`(即内核实际 `-f` 的文件;运行时其内容含 supervisor 注入的 external-controller/secret/mixed-port)→ 以 `text/yaml` 返回;文件不存在返回空串。
- `info().features` 加 `'runtime-config'`。
- 只读,不改动。

**验收:** 路由返回 activeConfigPath 内容;不存在→空;feature 含 `runtime-config`。agent `test`+`typecheck` 绿。

## Task 4 — desktop UI:运行时配置查看器 + 连接表导出

**Files:** `packages/ui/`(config 页只读查看器 + connections 页导出);测试 + `test/setup.ts`。

- **运行时查看器**(能力门控 `runtime-config`):一个只读展示(Monaco read-only 或 `<pre>`)`GET /api/control/config/runtime` 的内容,带刷新按钮。说明这是内核实际运行的最终配置。
- **连接导出**:connections 页加「Export」→ 把当前(尊重过滤/排序)连接导出为 **CSV** 与 **JSON** 下载(参照现有 logs 下载实现)。
- i18n en/zh/ru;不吞错误。

**验收:** 查看器渲染运行时配置(能力存在时);连接导出生成 CSV/JSON 下载且尊重过滤;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 5 — desktop UI:多语言 ja / ko / fr / fa

**Files:** `packages/ui/locales/`(新增 `ja.json`/`ko.json`/`fr.json`/`fa.json`)、`nuxt.config.ts`(i18n locales 注册);测试。

- 以 `en.json` 为基准**完整复制键结构**,翻译各值(机翻初稿,质量后续人校;**保证键与 en 完全对齐**,缺键会回退)。fa 为 RTL —— 若现有布局有 `dir` 处理则标注,否则仅加 locale(RTL 布局优化留后续)。
- `nuxt.config.ts` i18n.locales 增四项(code/name/file);LangSwitcher 自动列出。
- 测试:四个 locale 文件可加载且键集与 en 一致(可写一个键-parity 测试)。

**验收:** 四语言注册、可切换、键与 en 对齐(parity 测试);不回归现有 i18n 测试。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

---

## 完成后

全包 gate。汇报。至此你勾选的 4 组 P2 全部完成;剩更长尾的 P2(JS 脚本/Sub-Store/GUI 编辑器等,多为 L 或需依赖)与 TUN(单独 spec)。然后可走收尾(本地合并回 main)。
