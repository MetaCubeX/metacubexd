# TUN 方案 B — Wave B-1 实现计划(纯逻辑地基)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 依据 spec `docs/superpowers/specs/2026-06-15-desktop-tun-design.md` §12(方案 B)。**B-1 只做可单测的纯逻辑**:配置注入 + tun 状态机 + 能力门控 + 拆除骨架。提权 / helper IPC 以**注入接口桩**留给 B-2/B-3。**无真机验证(B 的固有代价)。**

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;**所有 OS/提权/进程副作用经注入接口**,测试只断言逻辑与调用,绝不真正建 TUN/提权;不吞错误;conventional commit;commit 主题小写;UI 略)。

---

## Task 1 — agent:`TunController` 接口 + `buildTunConfig` + 能力门控路由

**Files:** `packages/agent/src/types.ts`、新 `packages/agent/src/tun.ts`、`http.ts`、`index.ts`;测试 `tun.test.ts`、`http.test.ts`。

- `types.ts` 新接口(注入式控制器,镜像 SystemProxyController/KernelManager):
  ```ts
  export interface TunController {
    enable: (opts: { stack: string }) => Promise<void>
    disable: () => Promise<void>
    status: () => Promise<{
      enabled: boolean
      mode: 'sidecar' | 'tun'
      stack?: string
    }>
  }
  ```
- `tun.ts`:`buildTunConfig({ stack, device? }): Record<string, unknown>` 返回 mihomo `tun` 块:`{ enable:true, stack, 'auto-route':true, 'auto-detect-interface':true, 'dns-hijack':['any:53'], 'strict-route':true }`(device 提供则带上)。纯函数。
- `createAgent` 增可选 `tunController?: TunController`,放进返回对象 + 传给 router;`info().features` 在其存在时加 `'tun'`。
- `http.ts`(仅 controller 存在时):`GET /api/control/tun` → `status()`;`POST /api/control/tun`(body `{ enabled: boolean; stack?: string }`)→ `enabled ? enable({stack}) : disable()` 返回最新 `status()`;不存在 → 404 `{ error: 'tun unavailable' }`。

**验收:** buildTunConfig 字段正确;有 controller → 路由/feature 正常、enable/disable 被正确调用;无 → 404 + feature 不含。agent `test`+`typecheck` 绿。

## Task 2 — desktop:`createTunController` 状态机(注入提权/启动桩)

**Files:** 新 `apps/desktop/src/main/tun-controller.ts`;测试 `__tests__/tun-controller.spec.ts`。

- `createTunController({ injectTun, removeTun, startSidecar, startPrivileged, stopKernel, persist?, now? })` 实现 agent 的 `TunController`:
  - `injectTun(block)` / `removeTun()`:注入/移除 active config 的 `tun` 块(注入依赖;真实实现 B-3 接 setSection / supervisor)。
  - `startSidecar()` / `startPrivileged()`:两种内核启动后端(注入;真实 privileged 实现 = B-2/B-3 的 helper IPC)。`stopKernel()` 停当前。
  - `enable({stack})`:`stopKernel()` → `injectTun(buildTunConfig({stack}))` → `startPrivileged()` → 状态 `mode='tun'`、`enabled=true`、记 stack;持久化(注入 persist)。
  - `disable()`:`stopKernel()` → `removeTun()` → `startSidecar()` → 状态 `mode='sidecar'`、`enabled=false`。
  - `status()` 返回当前状态;幂等(已在目标态则不重复切)。错误**不吞**(抛/记录)。
- 全部注入 → 测试断言**状态转移 + 调用顺序 + 用哪个 launcher**,绝不真正提权/建网。

**验收:** enable 走 stop→inject→startPrivileged 且置 tun 态;disable 走 stop→remove→startSidecar 且置 sidecar 态;幂等;状态/stack 正确。desktop `test`+`typecheck` 绿。

## Task 3 — desktop:安全拆除骨架(退出/崩溃防断网)

**Files:** 新 `apps/desktop/src/main/tun-teardown.ts`(或并入 tun-controller)、`index.ts`(接线骨架);测试。

- `createTunTeardown({ tunController })` 暴露 `recoverNetwork()`:若当前 `mode==='tun'` 则 `tunController.disable()`(强制回 sidecar、拆 TUN)——供 UI"恢复网络"与退出/崩溃路径调用。best-effort、不吞错误(记录)。
- `index.ts` 骨架接线:`before-quit` 与崩溃看门狗里,若 tun 激活则调用 `recoverNetwork()`(注入 tunController 可测;真实 helper 断连联动在 B-3)。**不破坏现有退出/看门狗行为**。
- 测试:tun 态下 recoverNetwork → disable 被调;sidecar 态 → 不动作。

**验收:** recoverNetwork 仅在 tun 态触发 disable;退出/崩溃骨架调用它;现有 desktop 测试不回归。desktop `test`+`typecheck` 绿。

---

## 完成后

全包 gate。汇报。**注明:B-1 全是注入桩的纯逻辑,无真机验证。** 下一波 **B-2** = helper 脚本(ELECTRON_RUN_AS_NODE)+ IPC server(socket/pipe + 密钥 + 版本握手)+ 特权 spawn mihomo + electron-vite helper 入口。
