# TUN 方案 B — Wave B-2 实现计划(特权 helper + IPC)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 依据 spec §12。B-2 做 **helper 进程 + 本地 IPC(协议/鉴权/版本)+ 特权 spawn mihomo 的注入式骨架 + electron-vite helper 打包入口**。**真实服务安装/特权运行/真机 IPC 在 B-3 + 真机验证;本波只做可单测部分**:协议、socket 往返、注入 spawn 的 server 状态机、build 入口可构建。

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck`;**不 `pnpm install`**;只改本任务文件;**真实 mihomo spawn / 提权经注入**;不吞错误;conventional commit 小写主题)。Windows named pipe 本机无法跑——其分支只做命令/逻辑级单测并标注。

---

## Task 1 — desktop:IPC 协议模块(消息/鉴权/版本握手)

**Files:** 新 `apps/desktop/src/main/helper/protocol.ts`;测试 `__tests__/helper-protocol.spec.ts`。

- 定义请求/响应消息类型:`ping`、`getVersion`、`startKernel({ binaryPath, homeDir, configPath })`、`stopKernel`、`status`。
- 帧格式:**换行分隔 JSON**(NDJSON)over socket。`encodeMessage(msg)` / `parseMessages(buffer)`(处理粘包/半包,返回完整消息 + 余量)。
- 鉴权:每条请求带 `secret` 字段;`HELPER_PROTOCOL_VERSION` 常量;响应带 `version`。helper/client 共用本模块。
- 纯函数,无 IO。

**验收:** encode/parse 往返、粘包/半包正确切分、版本常量存在、消息类型完整。desktop `test`+`typecheck` 绿。

## Task 2 — desktop:helper IPC server + 入口 + 特权 spawn(注入)

**Files:** 新 `apps/desktop/src/main/helper/server.ts`、`apps/desktop/src/helper/index.ts`(helper 入口)、`electron.vite.config.ts`(加 helper build 入口);测试 `__tests__/helper-server.spec.ts`。

- `createHelperServer({ socketPath, secret, kernel })`:用 `node:net` 在 unix socket(mac/linux)/ named pipe(win,路径形如 `\\\\.\\pipe\\...`)监听;对每条消息:校验 secret(失败→拒绝)+ 版本;按类型派发到注入的 `kernel`(`{ start(opts), stop(), status(), version() }`,真实实现 = 特权 spawn mihomo,**本波注入桩**)。`start()/stop()` 返回结果经协议回。退出/断连时 `kernel.stop()`(防残留)。
- `apps/desktop/src/helper/index.ts`:helper 进程入口——读环境(socketPath/secret 由父进程经 env 传入)、构造真实 kernel(特权 spawn 随包 mihomo,注入 spawn 便于以后测)、起 server。设计为由 `ELECTRON_RUN_AS_NODE=1` 的 Electron 运行。
- `electron.vite.config.ts`:增第三个 build 入口把 `src/helper/index.ts` 打到 `out/helper/index.js`(与 main/preload 并列;沿用现有 ssr.external electron 等设置)。
- 测试:对 server 用**真实 unix socket(tmp 目录)** + 注入 kernel 跑往返(ping/version/start/stop/status、错误 secret 被拒、断连触发 stop);Windows 分支只逻辑级。**不真正 spawn mihomo**。`electron-vite build` 能产出 `out/helper/index.js`。

**验收:** server 在真实 socket 上鉴权+派发正确;断连/错误 secret 处理正确;helper 入口构建产物存在;注入 spawn 不触发真实进程。desktop `test`+`typecheck` 绿 + `pnpm --filter @metacubexd/desktop build` 产出 helper。

## Task 3 — desktop:app 侧 IPC client(与 server 往返)

**Files:** 新 `apps/desktop/src/main/helper/client.ts`;测试 `__tests__/helper-client.spec.ts`。

- `createHelperClient({ socketPath, secret })`:连接 socket/pipe;`request(msg)` 发带 secret 的请求、收响应(超时 + 错误传播,不吞);`ping()`/`getVersion()`/`startKernel(opts)`/`stopKernel()`/`status()` 封装;**版本不匹配**时 `getVersion`/握手抛清晰错误(供 B-3 触发重装)。
- 测试:对**真实 T2 server(同进程,tmp socket)+ 注入 kernel** 跑端到端往返;版本不匹配路径;超时路径。

**验收:** client↔server 真实 socket 往返通过;鉴权/版本/超时正确;错误不吞。desktop `test`+`typecheck` 绿。

---

## 完成后

全包 gate(含 desktop build 验证 helper 产物)。汇报。**注明:真实特权运行/服务安装/Windows pipe/真机 IPC 未验证。** 下一波 **B-3** = app 侧逐 OS 安装/卸载(提权命令)+ supervisor 模式切换(把 B-1 的 startPrivileged/stopKernel 注入桩接到 helper client)+ 看门狗/断连联动。
