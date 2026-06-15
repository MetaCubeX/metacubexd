# Desktop Parity — Wave 5 实现计划(桌面 UX 组 + 代理体验组)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> P2 高价值项,均 S/M、无新依赖。Wave 6 续做「备份/可观测 + 多语言」。

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;注入依赖可测;不吞错误;conventional commit)。UI 单测在 `test/setup.ts` 注册新 auto-import 依赖([[test-setup-auto-import-stubs]])。

---

## Task 1 — desktop:全局热键(globalShortcut)

**Files:** 新 `apps/desktop/src/main/hotkeys.ts`、`index.ts`;测试。

- 纯函数/可测注册器 `registerHotkeys({ globalShortcut, bindings, actions })`:把绑定映射到动作:`toggleSystemProxy` / `cycleProxyMode`(rule→global→direct→rule)/ `toggleWindow`(show/hide)。默认绑定(如 `CommandOrControl+Shift+P` 等,合理且不易冲突),可后续持久化到 `userData/hotkeys.json`(读不到用默认)。
- `index.ts`:app ready 后注册(动作接到 systemProxy 控制器 / Clash API mode / window);`will-quit` 时 `globalShortcut.unregisterAll()`。
- 注入 `globalShortcut` 以便测试断言注册的 accelerator→action 映射;不触发真实快捷键。

**验收:** 注册器把默认/自定义绑定正确映射到三类动作;quit 时注销。desktop `test`+`typecheck` 绿。

## Task 2 — desktop:窗口尺寸/位置持久化

**Files:** 新 `apps/desktop/src/main/window-state.ts`、`index.ts`;测试。

- `loadWindowState(fs, path, defaults)` / `saveWindowState(fs, path, bounds)`:读/写 `userData/window-state.json`;`sanitizeBounds(bounds, defaults)` 对非法/越界值回退默认(注入 fs 可测)。
- `createWindow`:用 loadWindowState 的 bounds 初始化 BrowserWindow;监听 `resize`/`move`/`close`(防抖)保存 bounds。保持现有 show/ready-to-show、silent-start 行为。

**验收:** 加载/保存往返、非法 bounds 回退默认;createWindow 用持久化 bounds。desktop `test`+`typecheck` 绿。

## Task 3 — desktop:原生应用菜单

**Files:** 新 `apps/desktop/src/main/app-menu.ts`、`index.ts`;测试。

- `buildAppMenu({ platform, actions })` 返回 Electron MenuItemConstructorOptions[]:macOS 加 app 菜单(about/quit role 等);Edit 菜单(undo/redo/cut/copy/paste/selectAll role)——**修复目前 Cmd+C/V 在输入框/Monaco 不可用**;View(reload/toggledevtools/zoom)、Window role。可挂少量自定义项(Show、Start/Stop kernel)。
- `index.ts`:`Menu.setApplicationMenu(Menu.buildFromTemplate(buildAppMenu(...)))`。
- 纯模板构建器可测(断言含 edit roles、mac 分支差异)。

**验收:** 模板含标准编辑 role(copy/paste/selectAll),mac/非 mac 分支正确。desktop `test`+`typecheck` 绿。

## Task 4 — desktop:系统通知(内核崩溃 / 订阅更新)

**Files:** 新 `apps/desktop/src/main/notifier.ts`、`index.ts`;`packages/agent/src/scheduler.ts`(加可选 `onResult` 回调);测试两侧。

- `createNotifier({ Notification })`(注入 Electron Notification 构造器):`notify(title, body)`。
- 内核崩溃:`agent.supervisor.on('state', s => { if (s.status==='errored') notifier.notify('Kernel stopped', s.lastError ?? '...') })`(防抖/去重,避免重复)。
- 订阅更新:`createProfileScheduler` 加可选 `onResult?: (r: { id; ok; error? }) => void`,每次 refresh 后回调;桌面传入 → 成功/失败 notify。**不破坏现有 scheduler 测试**(回调可选)。
- 注入 Notification 断言被调用;不弹真实通知。

**验收:** errored 状态触发崩溃通知;scheduler refresh 触发更新通知(注入);scheduler 现有测试不破。desktop + agent `test`+`typecheck` 绿。

## Task 5 — desktop:sysproxy guard(防外部改动)

**Files:** 新 `apps/desktop/src/main/sysproxy-guard.ts`、`index.ts`;测试。

- `createSysproxyGuard({ controller, intervalMs?, setTimer?, clearTimer? })` → `{ start(), stop() }`:周期性在「我们认为系统代理应启用」时 `controller.isEnabled()`,若为 false(被外部关掉)则 `controller.enable()` 重新断言;仅在 guard 激活(用户开了系统代理)时生效。注入 timer 可测。
- `index.ts`:用户启用系统代理时 `guard.start()`,禁用时 `guard.stop()`;退出 stop。

**验收:** 注入 timer + fake controller:启用态下检测到被关→重新 enable;禁用态不动作;stop 后不再 tick。desktop `test`+`typecheck` 绿。

## Task 6 — desktop UI:全 provider 一键健康检查

**Files:** `packages/ui/`(proxies 页/providers 区;复用现有 per-provider / test-all-groups 模式);测试。

- 加一个「Health-check all providers」按钮:对所有 proxy providers 触发延迟测试(复用现有 provider 延迟测试 API,批量、限并发,沿用现有 useBatchLatencyTest 风格);进度/结果反馈,失败 toast。
- 与现有「test all groups」「update all providers」区分开。

**验收:** 按钮对所有 providers 触发健康检查(批量);不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 7 — desktop UI:切换时断连(扩展 autoCloseConns)

**Files:** `packages/ui/`(connections/proxies store + 触发点);测试。

- 现 `autoCloseConns` 仅在**选节点**时关连接。扩展:在 **profile 切换** 与 **运行模式切换**(rule/global/direct)时,若 `autoCloseConns` 开启,则关闭(全部或受影响)连接,使切换即时生效。沿用现有关连接 API。
- 配置项可保持单一 `autoCloseConns`(扩展其触发面),或加一个粒度选项(none/select/all)——择简,默认行为安全。

**验收:** 开启 autoCloseConns 时,profile/模式切换会触发关连接;关闭时不触发;不回归现有 proxies/connections 测试。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

---

## 完成后

全包 gate。汇报。**Wave 6** = WebDAV 备份还原(agent fetch 手写 + UI)+ 连接表导出 CSV/JSON + 运行时配置查看器(GET /api/control/config/runtime)+ 多语言 ja/ko/fr/fa。
