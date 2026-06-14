# Desktop Parity — Wave 1 实现计划

> 执行:superpowers:subagent-driven-development(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 范围:已验证 bug + P0/P1 **纯软件**项(无原生 OS shell-out、无证书)。系统代理(原生)= Wave 2;签名/自更新 = Wave 3;TUN 单独 spec。

**架构:** Electron 主进程 + 进程内 control server(同源 renderer + `/api/control` h3 router)+ `packages/agent`(supervisor/profiles)+ mihomo Clash API(独立 loopback 端口,主进程经 `MCXD_CLASH_URL`/`MCXD_CLASH_SECRET` 可达)。

**通用约束:** 严格 TDD(先写失败测试);每任务跑该包 `test` + `typecheck` 并确认通过后再提交;**不要 `pnpm install`**(本波无新依赖,若确需则报 blocked);只改本任务相关文件;沿用周边代码风格;conventional commit。

---

## Task 1 — agent:订阅就地刷新 + `updateInterval` 字段(修 bug)

**Files:** `packages/agent/src/types.ts`、`profiles.ts`、`http.ts`;测试 `profiles.test.ts`、`http.test.ts`。

- `ProfileMeta` 增 `updateInterval?: number`(分钟,仅 remote 有意义)。
- `ProfileStore` 增 `refresh: (id: string) => Promise<ProfileMeta>`。
- `profiles.refresh(id)`:读 meta;若非 `remote` 或无 `url` → throw;用同样的 UA `clash.meta` + 存的 `userAgent` 重新 fetch;**就地**覆盖 `${id}.yaml`,更新 `subscriptionInfo`(复用 `parseSubscriptionUserinfo`)+ `updatedAt`,**保持同一 id**;写回 index。若该 id 是 active,刷新后内容已更新(是否重启由调用方/路由决定——本任务不重启)。
- `http.ts` 增 `POST /api/control/profiles/:id/refresh` → `profiles.refresh(id)` 返回更新后的 meta。
- 重构:`importFromUrl` 的 fetch+parse 逻辑抽成内部 `doFetch helper` 供 refresh 复用(DRY)。

**验收:** refresh 更新原 id 不新增;local/无 url 抛错;route 返回新 meta;`importFromUrl` 行为不变。agent `test`+`typecheck` 绿。

## Task 2 — agent:订阅定时自动更新调度器

**Files:** 新 `packages/agent/src/scheduler.ts`;`index.ts`(createAgent 返回 scheduler);测试 `scheduler.test.ts`。

- `createProfileScheduler({ profiles, tickMs?, now?, setTimer?, clearTimer? })` → `{ start(), stop() }`。注入 timer/now 以便测试。
- 每 tick:`profiles.list()`,对每个 `type==='remote' && updateInterval>0 && (now-updatedAt) >= updateInterval*60000` 的项调用 `profiles.refresh(id)`,**best-effort**(单项失败 catch + 继续,不影响其他)。
- `createAgent` 实例化并 `return { ..., scheduler }`(不自动 start;由桌面 boot 决定何时 start)。

**验收:** 到期项触发 refresh、未到期/local/无 interval 跳过、refresh 抛错不影响其余、stop 后不再 tick。agent `test`+`typecheck` 绿。

## Task 3 — agent:supervisor 崩溃自愈看门狗

**Files:** `packages/agent/src/supervisor.ts`、`types.ts`(SupervisorOptions);测试 `supervisor.test.ts`。

- 新增 opt:`autoRestart?: boolean`(默认 true)、`maxRestarts?: number`(默认 3)、`restartBackoffMs?: number`(默认 1000)。
- `doStop()` 设置一个 `intentionalStop` 标志(用户/调用方主动停)。`proc.on('exit')` 里:若状态曾是 running 且 **非** intentionalStop 且 autoRestart 且未超 maxRestarts → 退避后 `run(doStart)` 重启,递增计数;成功 ready 后重置计数。`restart()`/`stop()` 不触发看门狗误判。
- 注入 timer 以便测试(沿用 `deps`/`now` 风格,backoff 用可注入的 setTimeout)。

**验收:** 意外退出自动重启;主动 stop 不重启;超过 maxRestarts 停在 errored;`autoRestart:false` 禁用。agent `test`+`typecheck` 绿。

## Task 4 — desktop:`boot()` 注入受管 mixed-port

**Files:** `apps/desktop/src/main/index.ts`;测试(desktop 现有测试范式)。

- `pickFreePorts(3)` → `[controlPort, clashPort, mixedPort]`;`createAgent({ ..., mixedPort })`;`process.env.MCXD_MIXED_PORT = String(mixedPort)`(供 Wave 2 sysproxy)。
- supervisor 已支持 `mixedPort` 注入(无需改 agent)。

**验收:** createAgent 收到 mixedPort;env 暴露;injectClashConfig 写入受管 mixed-port(可经 agent 既有测试佐证)。desktop `typecheck`+`test` 绿。**这是 Wave 2 系统代理的前置。**

## Task 5 — desktop:托盘代理模式切换(rule/global/direct)

**Files:** `apps/desktop/src/main/tray.ts`、`index.ts`;测试 `tray.test.ts`。

- `TrayDeps` 增 `clash: { url: string; secret: string }` 与可注入 `fetchImpl?: typeof fetch`。
- 菜单加 "Proxy mode" 子菜单(radio:Rule/Global/Direct)。点击 → `PATCH ${clash.url}/configs`,body `{ mode }`,`Authorization: Bearer ${secret}`;成功后 rebuild。
- rebuild 时异步 `GET ${clash.url}/configs` 取当前 `mode` 标记 radio(取不到则不勾;缓存上次已知 mode,避免闪烁)。
- `index.ts`:从 `process.env.MCXD_CLASH_URL`/`MCXD_CLASH_SECRET`(boot 已设)读出传入 `createTray`。

**验收:** 点击模式 PATCH /configs 正确 body+鉴权;当前模式勾选;注入 fetch 的测试覆盖。desktop `typecheck`+`test` 绿。

## Task 6 — desktop:deep-link 自定义 URL scheme 导入订阅

**Files:** 新 `apps/desktop/src/main/deep-link.ts`、`index.ts`;测试 `deep-link.test.ts`。

- 纯函数 `parseSubscriptionDeepLink(raw): { url: string; name?: string } | null`:支持 `clash://install-config?url=<enc>&name=<n>` 与 `clashmeta://install-config?...`(解码 `url`,缺失/非法返回 null)。
- `index.ts`:`app.setAsDefaultProtocolClient('clash')` + `'clashmeta'`;mac 监听 `open-url`;win/linux 从 `second-instance` 的 argv 与首次 `process.argv` 解析;命中 → `agent.profiles.importFromUrl(url, name)` → `setActive` → `supervisor.restart()` → 聚焦窗口 + 系统通知。
- 单实例锁已存在;deep-link 复用其 `second-instance`。

**验收:** parser 处理合法/非法/两种 scheme;集成已接线。parser 测试 + desktop `typecheck`+`test` 绿。

## Task 7 — desktop:开机静默/最小化启动

**Files:** 新 `apps/desktop/src/main/startup.ts`、`index.ts`、`tray.ts`;测试 `startup.test.ts`。

- 纯函数 `shouldStartHidden(argv: string[], loginSettings: { wasOpenedAtLogin?: boolean }): boolean` → argv 含 `--hidden` 或 `wasOpenedAtLogin` 为真。
- `tray.ts` 的 "Open at login" 改为 `setLoginItemSettings({ openAtLogin, args: ['--hidden'] })`(随登录项隐藏启动)。
- `index.ts` whenReady:算 `startHidden`,传入 `createWindow(startHidden)`;隐藏启动时 `ready-to-show` 不 `win.show()`(内核仍照常 boot,托盘可唤出)。

**验收:** helper 正确;登录项启动隐藏窗口、普通启动正常显示。startup 测试 + desktop `typecheck`+`test` 绿。

---

## 完成后(本波结束)

全包 gate:`pnpm --filter @metacubexd/agent test && pnpm --filter @metacubexd/agent typecheck`、`pnpm --filter @metacubexd/desktop test && pnpm --filter @metacubexd/desktop typecheck`、`pnpm --filter @metacubexd/ui run test:unit`。汇报给用户,再决定 Wave 2(系统代理)。
