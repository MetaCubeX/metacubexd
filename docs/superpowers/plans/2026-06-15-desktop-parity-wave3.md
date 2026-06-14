# Desktop Parity — Wave 3 实现计划(内核版本管理 + Geo 资产 + DNS 设置 UI)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> **范围调整:** 原 Wave 3 含 Merge profile,但 Merge 需要真正的 YAML 解析合并(agent 现仅用正则,无 yaml 依赖)→ 为避免本波 `pnpm install` 引入 lockfile churn,**Merge profile 挪到单独一波**。本波 = 内核版本管理 + Geo 资产下载更新 + DNS 设置 UI,**均无新依赖**。

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;注入 fetch/exec 可测;conventional commit)。
**设计:** 复用注入式控制器模式 —— OS/Electron 相关代码在桌面端,agent 持通用接口 + 能力门控路由;UI 走统一 `/api/control` + 现有能力门控。

---

## Task 1 — agent:`fetchKernel(version)` 参数化 + `listMihomoVersions`

**Files:** `packages/agent/src/kernel/fetch-kernel.ts`、`assets.ts`(如需)、`index.ts`(导出);测试 `kernel/*.test.ts`。

- `fetchKernel(os, arch, destDir, deps)`:`deps` 增 `version?: string`(默认 `MIHOMO_VERSION`),传给 `mihomoAsset(os, arch, version)`。外部行为对默认调用不变。
- 新 `listMihomoVersions(deps?: { fetch?: typeof fetch }): Promise<string[]>`:GET `https://api.github.com/repos/MetaCubeX/mihomo/releases`(UA header),返回 `tag_name` 列表,**过滤掉 prerelease/rolling "Prerelease-Alpha"** 等非常规 tag(只保留 `v*` 语义版本),按版本倒序。注入 fetch 测试。
- `index.ts` 导出 `listMihomoVersions`。

**验收:** `fetchKernel` 带 version 走对应 URL、默认仍是 MIHOMO_VERSION;`listMihomoVersions` 解析 releases JSON、过滤、排序正确(注入 fetch)。agent `test`+`typecheck` 绿。

## Task 2 — agent:`supervisor.setBinaryPath` + `KernelManager` 接口 + 能力门控路由

**Files:** `packages/agent/src/supervisor.ts`、`types.ts`、`index.ts`、`http.ts`;测试 `supervisor.test.ts`、`http.test.ts`。

- `supervisor`:把 `binaryPath` 从常量改为可变(`let binaryPath = opts.binaryPath`),`doStart`/`validate` 用该变量;新增 `setBinaryPath(path: string): void`(下次 start 生效)。加到 `MihomoSupervisor` 类型。
- `types.ts` 新接口:
  ```ts
  export interface KernelManager {
    listVersions: () => Promise<{
      versions: string[]
      current?: string
      bundled: string
    }>
    switch: (version: string) => Promise<void> // download + persist + restart kernel on new binary
  }
  ```
- `createAgent` 增可选 `kernelManager?: KernelManager`,放进返回对象 + 传给 router;`info().features` 在其存在时加 `'kernel-version'`。
- `http.ts`(仅 controller 存在时):`GET /api/control/kernel/versions` → `listVersions()`;`POST /api/control/kernel/switch`(body `{ version }`)→ `switch(version)` 返回 `{ ok: true }`;不存在 → 404 `{ error: 'kernel-version unavailable' }`。

**验收:** `setBinaryPath` 后下次 start 用新路径(注入 spawn 断言);有 manager → 路由/feature 正常;无 → 404 + feature 不含。agent `test`+`typecheck` 绿。既有 supervisor 测试不破。

## Task 3 — desktop:`KernelManager` 实现 + 接线

**Files:** 新 `apps/desktop/src/main/kernel-manager.ts`、`index.ts`;测试 `kernel-manager` spec。

- `createKernelManager({ supervisor, os, arch, kernelsDir, overridePath, fetchKernel?, listVersions?, writeOverride?, fetchImpl? })` 实现接口:
  - `listVersions()`:`listMihomoVersions()` 拿列表;`current` = `supervisor.getState().version`;`bundled` = `MIHOMO_VERSION`。
  - `switch(version)`:`fetchKernel(os, arch, join(kernelsDir, version), { version })` → 写 override 文件(`userData/mihomo-bin-override.txt` = 新 binPath,供下次冷启动)→ `supervisor.setBinaryPath(binPath)` → `await supervisor.restart()`。全部依赖注入(fetchKernel/listVersions/writeFile)以便测试**不触发真实下载**。
- `index.ts` boot():构造 kernelManager(用已解析的 os/arch、`userData/kernels`、override 路径、`agent.supervisor`),`createAgent({ ..., kernelManager })`。
- 注意:与 Wave 2 退出清代理无冲突(switch 不退出 app)。

**验收:** 注入 mock,`switch` 调用 fetchKernel(对版本)、写 override、setBinaryPath、restart 的顺序正确;`listVersions` 合并 current/bundled。desktop `test`+`typecheck` 绿。

## Task 4 — agent:`fetchGeoAssets` + 更新路由

**Files:** 新 `packages/agent/src/kernel/geo.ts`、`index.ts`、`http.ts`;测试 `kernel/geo.test.ts`、`http.test.ts`。

- `fetchGeoAssets(destDir, deps?: { fetch?; which? })`:下载 mihomo 默认 geo 数据到 `destDir`(= homeDir):`geoip.dat`、`geosite.dat`、`country.mmdb`(URL 用 `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/<file>`;GeoLite mmdb 用 mihomo 文档默认源)。逐个 fetch→写文件;单个失败抛清晰错误。注入 fetch 测试。
- `createAgent`/`http.ts`:`POST /api/control/geo/update` → `fetchGeoAssets(homeDir)` 返回 `{ ok: true, files: [...] }`(agent 始终能做,因为有 homeDir;`info().features` 加 `'geo-assets'`)。
- `index.ts` 导出 `fetchGeoAssets`。

**验收:** 注入 fetch,`fetchGeoAssets` 下载三个文件到 destDir、命名正确、失败抛错;route 调用它;feature 含 `geo-assets`。agent `test`+`typecheck` 绿。

## Task 5 — desktop UI:内核版本管理面板 + Geo 更新按钮(能力门控)

**Files:** `packages/ui/`(参照 KernelControlPanel 的能力门控 + control 调用);测试 + `test/setup.ts`。

- 仅当 `hasFeature('kernel-version')`:面板显示 `GET /api/control/kernel/versions` 的 current/bundled + 版本下拉,选定后 `POST /api/control/kernel/switch { version }`(切换中显示进度/禁用,完成后内核重启)。
- 仅当 `hasFeature('geo-assets')`:一个 "Update GEO databases" 按钮 → `POST /api/control/geo/update`,成功/失败 toast(vue-sonner)。
- 走现有桌面 control 客户端(带 token);i18n en/zh/ru 加键;新 auto-import 依赖在 `test/setup.ts` 注册([[test-setup-auto-import-stubs]])。

**验收:** 能力存在时渲染并正确调用;缺失时不渲染。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿,不回归。

## Task 6 — desktop UI:DNS 设置表单(经 Clash API PATCH /configs)

**Files:** `packages/ui/`(config 页 DNS 卡片;复用 `useUpdateConfigMutation` 的 PATCH `/configs` 路径,与现有 tun/ports 设置一致);测试。

- config 页新增/扩展 DNS 卡片:`enhanced-mode`(fake-ip/redir-host)、`nameserver`(多行)、`fallback`(多行)、`fake-ip-range`、`use-hosts` 等常用项;保存 → `useUpdateConfigMutation` PATCH `/configs`(对所有 mihomo 后端通用,**非** agent 门控;mihomo 不能热改的字段在 UI 注明"需在配置编辑器修改")。
- 现有「DNS 查询工具」保留;本卡片是**编辑器**。i18n en/zh/ru;`test/setup.ts` 注册新依赖。

**验收:** DNS 表单读取当前 configs、保存 PATCH 正确字段;不回归现有 config 页测试。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

---

## 完成后

全包 gate(agent/desktop/server test+typecheck、ui test:unit+typecheck)。汇报。**下一波(Wave 4)= Merge profile**(需引入 `yaml` 依赖,单独处理 + lockfile prettier 收尾),以及 P2 长尾按需挑选。
