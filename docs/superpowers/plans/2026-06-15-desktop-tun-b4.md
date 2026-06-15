# TUN 方案 B — Wave B-4 实现计划(UI 接线 + 恢复网络)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 依据 spec §12。B-4 把现有 UI TUN 开关接到新的 `/api/control/tun`(能力门控),加恢复网络按钮 + 安装/提权提示 + 状态/错误反馈。**纯 UI 单测;真机交互(提权弹窗/真实建网)留用户。**

**通用约束:** 同前(严格 TDD;`pnpm --filter @metacubexd/ui run test:unit` + `typecheck`;**不 `pnpm install`**;只改本任务文件;不吞错误;conventional commit 小写主题;新 auto-import 依赖在 `test/setup.ts` 注册 [[test-setup-auto-import-stubs]])。

---

## Task 1 — ui:tun control client + `useTun` composable

**Files:** `packages/ui/composables/useControlApi.ts`、`types/control.ts`、新 `composables/useTun.ts`;测试。

- `types/control.ts`:`ControlFeature` 加 `'tun'`;tun 状态类型 `{ enabled: boolean; mode: 'sidecar' | 'tun'; stack?: string }`。
- `useControlApi`:`getTun()` → GET `/api/control/tun`;`setTun({ enabled, stack? })` → POST `/api/control/tun`。
- `useTun`:`available` = `hasFeature('tun')`;`status`(初值 GET)、`busy`、`enable(stack)`/`disable()`(= 恢复网络)封装 setTun;成功/失败 toast(不吞);切换中标 busy(提权/安装/重启需时间)。

**验收:** available 门控正确;getTun/setTun 调对端点;enable/disable 改状态 + busy + toast;失败有反馈。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 2 — ui:config 页 TUN 区接线 + 恢复网络按钮 + 提示

**Files:** `packages/ui/pages/config.vue`(现有 TUN 区)+ 必要组件;i18n;测试。

- **能力 `'tun'` 存在(桌面)时**:TUN enable 开关改走 `useTun.enable(stack)/disable()`(经 `/api/control/tun`,触发真实安装+特权启动),**而非**现在的 Clash API PATCH `tun`;stack 选择透传给 enable;显示当前 mode/状态。
  - **首次开启提示**:文案说明会**安装特权 helper 并弹管理员授权**(未签名会有"未知发布者"警告);失败 toast 给出原因。
- **能力不存在(远程后端)时**:保留现有 Clash API PATCH 行为(不回归)。
- **"恢复网络"按钮**(仅 tun 态显示):调 `useTun.disable()` 强制回 sidecar + 拆 TUN,救急。
- i18n en/zh/ru(安装提示、恢复网络、提权说明等);新依赖入 `test/setup.ts`。

**验收:** 能力存在时 TUN 开关走 /api/control/tun + 显示状态 + 安装提示;恢复网络按钮在 tun 态可用并调 disable;能力不存在时保留旧 PATCH 行为;现有 config 页测试不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

---

## 完成后

全包 gate。汇报。**注明:UI 逻辑单测通过,但真实提权/安装/建网交互未真机验证。** 最后一波 **B-5** = 打包:wintun.dll 随包(`apps/desktop/resources`,fetch 脚本或手放)+ plist/unit 模板入 resources(供 installer 读)+ electron-builder 确保 `out/helper` 与 wintun 进包 + README 增 TUN 章节(提权、未签名、恢复网络、逐 OS 注意)。
