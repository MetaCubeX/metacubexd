# TUN 方案 B — Wave B-3 实现计划(逐 OS 安装 + 模式切换 + 断连联动)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 依据 spec §12。B-3 把 B-1 的注入桩(startPrivileged/stopKernel/injectTun)接到 B-2 的真实 helper client,并加**逐 OS 服务安装/卸载(提权命令生成)** + **看门狗/断连联动**。**真实安装/提权/真机 IPC 仍无法本机验证——只做命令生成 + 注入式状态机单测,真机验证留用户。**

**通用约束:** 同前(严格 TDD;`test`+`typecheck`;**不 `pnpm install`**;只改本任务文件;**真实提权/安装/spawn 经注入**,测试只断言命令/调用;不吞错误;conventional commit 小写主题)。

---

## Task 1 — desktop:逐 OS helper 安装/卸载(提权命令生成)

**Files:** 新 `apps/desktop/src/main/helper/installer.ts`;测试 `__tests__/helper-installer.spec.ts`。

- `createHelperInstaller({ platform, exec, elevate, paths })` →:
  - `install({ electronBin, helperEntry, socketPath, secret })`:**生成**特权服务定义,运行 `<electronBin> <helperEntry>`(env `ELECTRON_RUN_AS_NODE=1`、`MCXD_HELPER_SOCKET`、`MCXD_HELPER_SECRET`),以 root/admin 常驻;把 secret 写到 root 拥有、app 可读的路径;注册服务。逐 OS:
    - mac:写 LaunchDaemon plist(`/Library/LaunchDaemons/<label>.plist`)+ `launchctl bootstrap system <plist>`;整组写操作经**一次** `elevate`(osascript `do shell script ... with administrator privileges`)执行。
    - linux:写 systemd unit(`/etc/systemd/system/<name>.service`)+ `systemctl daemon-reload && systemctl enable --now <name>`,经 `pkexec`。
    - win:`sc create <name> binPath= "<electronBin> <helperEntry>" start= auto` + 设 env + `sc start`,经 UAC(`runas`);命名管道 ACL。
  - `uninstall()`:对称(`launchctl bootout` / `systemctl disable --now` + 删 unit / `sc stop && sc delete`),删 secret/plist/unit。
  - `isInstalled()` / `installedVersion()`(经 helper client `getVersion` 或读标记)。
- 全部经**注入 exec/elevate** → 测试断言**逐平台生成的命令/文件内容**;未知平台抛错;**不真正安装/提权**。

**验收:** 三平台 install/uninstall 命令与服务定义内容正确;secret 路径/权限合理;未知平台抛错。desktop `test`+`typecheck` 绿。**注明真机未验证。**

## Task 2 — desktop:supervisor 模式切换(tun-controller 接真实 helper)

**Files:** `apps/desktop/src/main/index.ts`、(按需小胶水 `apps/desktop/src/main/tun-runtime.ts`);测试。

- 构造**真实** tun-controller(B-1 的 `createTunController`),把它的注入依赖接到真实实现:
  - `injectTun(block)` = `profiles.setSection('tun', block)`;`removeTun()` = `profiles.setSection('tun', null)`(经 agent,Wave-7 原语)。
  - `startSidecar()` = `supervisor.start()`(app 内普通态,今天的路径);`stopKernel()` = 当前态对应的停(sidecar→`supervisor.stop()`;tun→helper client `stopKernel`)。
  - `startPrivileged()` = 确保 helper 已安装(否则触发 `installer.install`)→ 连 helper client → `client.startKernel({ binaryPath, homeDir, configPath })`(由 helper 特权 spawn mihomo)。
- `boot()`:构造 installer + helper client + tun-controller,`createAgent({ ..., tunController })`(能力 `'tun'` 上线);persist 跨会话记住 tun 态(冷启动若上次是 tun,提示/恢复)。
- 退出:`before-quit` 既停 sidecar 内核、也(若 tun 态)经 client/installer 停 helper 内核 + `recoverNetwork`。
- 测试:注入 installer/client/supervisor/setSection → 断言 enable 走 install?→client.startKernel、disable 走 client.stop→setSection(null)→supervisor.start、退出拆除。**不真正提权/spawn。**

**验收:** tun-controller 的真实接线正确(enable/disable 调对底层)、能力上线、退出拆除;现有 boot/退出行为不回归。desktop `test`+`typecheck` 绿。

## Task 3 — desktop:断连 / 看门狗联动

**Files:** `apps/desktop/src/main/tun-runtime.ts`(或 index.ts)、(按需 helper client 增断连事件);测试。

- **helper client 断连**:tun 态下若与 helper 的连接意外断开(helper 崩溃/被杀),app 检测到 → 触发 `recoverNetwork()`(回 sidecar、拆 TUN)+ 系统通知(Wave-5 notifier),避免"以为在 TUN 却裸奔/或残留劫持"。
- **崩溃看门狗(Wave-5)联动**:tun 态下内核经 helper 运行,app 内 supervisor 看门狗不直接管它;明确策略——helper 侧负责其 mihomo 子进程的存活(B-2 断连即 stop),app 检测 helper 连接健康;app 内 supervisor 看门狗仅管 sidecar 态。文档化这一归属,避免双重重启打架。
- 测试:注入断连事件 → tun 态触发 recoverNetwork + notify;sidecar 态不触发;看门狗不误管 helper 内核。

**验收:** helper 断连在 tun 态触发恢复 + 通知;归属清晰不打架;不回归。desktop `test`+`typecheck` 绿。

---

## 完成后

全包 gate(+ desktop build)。汇报。**注明:安装/提权/真机 TUN/断连恢复全部未真机验证。** 下一波 **B-4** = UI:现有 TUN 开关接 `/api/control/tun`(能力门控 + 安装引导提示)+ "恢复网络"按钮 + 模式/状态/错误反馈。然后 **B-5** = 打包(wintun.dll 随包 + plist/unit 模板入 resources + README TUN 章节)。
