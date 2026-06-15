# Desktop Parity — Wave 8 实现计划(诊断组 + 高级/有风险组)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 深 P2 最后一批。`uqr`(二维码)依赖已 inline 装好(commit 164b989)。其余无新依赖。

**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**——uqr 已装;只改本任务文件;注入依赖可测;不吞错误;conventional commit;UI 新 auto-import 依赖在 `test/setup.ts` 注册 [[test-setup-auto-import-stubs]])。

---

## Task 1 — agent:JS 脚本 runner(worker 沙箱)+ script profile 合成

**Files:** 新 `packages/agent/src/script.ts`、`types.ts`、`profiles.ts`(setActive 合成管线)、`index.ts`;测试 `script.test.ts`、`profiles.test.ts`。

- `createScriptRunner({ run? })`:`run(code, input): Promise<object>`。默认实现用 `node:worker_threads` 起 worker,把用户代码当作导出 `(config) => config` 的模块执行,传入 config 对象、返回转换后的对象;**超时**(默认 ~5s)则 terminate worker 并抛错;worker 内**不暴露** require/fetch/fs(尽力最小面)。注释明确:执行用户 JS,**仅用可信脚本**(node:vm/worker 非硬安全边界)。
- `ProfileType` 加 `'script'`(Wave 4 已加 `'merge'` + `enabled`)。
- `setActive(base)` 合成管线扩展:base → `mergeConfigs`(启用的 merge)→ **再依次跑启用的 script profile**:`parse` 当前 YAML 为对象 → 对每个启用 script `run(code, obj)` 得到新 obj → `stringify` 回 YAML → 写 activeConfigPath。无 merge/script 时保持现状(base 逐字节)。
- 测试:合成集成用**注入的 fake run**(不起 worker);worker 默认实现单独测两例(简单脚本加键 + 超时抛错,真 worker 可在 vitest 跑)。

**验收:** script 能转换配置并进入 active;禁用的 script 跳过;超时抛错;merge+script 顺序正确;无 merge/script 时 base 不变。agent `test`+`typecheck` 绿。

## Task 2 — desktop UI:script profile 管理

**Files:** `packages/ui/`(profiles 页;复用 Wave 4 的 merge profile 管理 + Monaco);测试 + `test/setup.ts`。

- profiles 页(agent 门控)加「New script profile」(`POST /profiles { type:'script' }`);script 与 base/merge **分区展示**;enabled 开关(`PUT /profiles/:id { enabled }`);Monaco **JS** 编辑(language=javascript,非 yaml);删除。
- 说明文案:脚本接收 config 对象、返回修改后的 config,合成时在 merge 之后执行;**安全提示**:仅运行你信任的脚本。改动后若有 active base 则触发重新 activate。i18n en/zh/ru;不吞错误。

**验收:** 创建/编辑/启停/删除 script profile,JS 编辑,启停触发重算;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 3 — desktop UI:服务可达/解锁检测 + 多目标连通性看板

**Files:** `packages/ui/`(proxies/诊断区;复用现有 Clash API 延迟测试 `/proxies/:name/delay?url=&timeout=`);测试。

- **多目标连通性看板**:可配置的「命名目标」列表(name + url,带常用预设:Google/GitHub/Cloudflare 等),对选定节点/组用现有 delay-test(自定义 url)逐目标测延迟,网格展示可达/延迟。
- **流媒体/AI 解锁检测**:同一机制,预设一组服务 URL(YouTube/Netflix/OpenAI/Gemini 等),对节点测可达性 →「可达/不可达」。**说明局限**:基于经代理的可达性(delay-test),非完整区域解锁判定(区域级需响应体检测,超出本期)。
- 失败 toast;i18n en/zh/ru;`test/setup.ts` 注册新依赖。

**验收:** 看板对命名目标/服务逐一经选定节点 delay-test 并展示结果;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 4 — desktop UI:订阅二维码分享(uqr)

**Files:** `packages/ui/`(profiles 页 remote profile 操作;`import { encode } from 'uqr'` 生成 SVG/矩阵);测试 + `test/setup.ts`。

- 对 remote(订阅)profile 加「Share QR」→ 弹窗用 `uqr` 把订阅 url 渲染成二维码(SVG)。可复制 url。
- i18n en/zh/ru;`test/setup.ts` 注册 uqr/新依赖。

**验收:** 对 remote profile 生成其 url 的二维码并展示;local/merge/script 无该入口或禁用;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 5 — desktop:Windows UWP loopback 豁免

**Files:** 新 `apps/desktop/src/main/uwp-loopback.ts`、(按需 index.ts);测试 `uwp-loopback.spec.ts`。

- `createUwpLoopback({ exec, platform? })`:`list()`(`CheckNetIsolation LoopbackExempt -s`)、`exempt(packageSid|name)`(`-a -n=<pkg>`)、`remove(...)`(`-d -n=<pkg>`)。仅 win32 有意义;非 win32 调用抛清晰错误(或 no-op + 标注)。注入 exec 断言命令拼装。
- **本机为 macOS,运行时无法验证**——只做命令生成 + 单测;在代码/PR 注明仅 Windows 生效、未在真实 Windows 验证。
- (UI 枚举 UWP 应用较复杂,本期仅提供主进程能力 + 命令封装;完整选择器留后续。)

**验收:** 注入 exec 断言 list/exempt/remove 的 `CheckNetIsolation` 命令正确;非 win32 抛错/no-op 明确。desktop `test`+`typecheck` 绿。

---

## 完成后

全包 gate。汇报。至此你勾选的全部 P2(4+4 组)完成;仅余 Sub-Store/GUI proxy-group 编辑器等极长尾与 TUN(单独 spec)。然后走收尾(本地合并回 main)。
