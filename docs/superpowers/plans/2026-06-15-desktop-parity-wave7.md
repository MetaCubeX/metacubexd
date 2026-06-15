# Desktop Parity — Wave 7 实现计划(配置 GUI 编辑组 + 定制组)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 深 P2 第一批,**无新依赖**(用已装的 `yaml`)。Wave 8 续做诊断 + 脚本/QR/UWP。

**核心设计:** 一个 **config-section 编辑原语**(agent 用 yaml 读/写 active profile 的某个顶层段),GUI 规则编辑器与网络配置编辑器都建在它之上。
**通用约束:** 同前(严格 TDD;跑该包 `test`+`typecheck` 后再提交;**不 `pnpm install`**;只改本任务文件;注入依赖可测;不吞错误;conventional commit;UI 新 auto-import 依赖在 `test/setup.ts` 注册 [[test-setup-auto-import-stubs]])。

---

## Task 1 — agent:config-section 读/写原语

**Files:** `packages/agent/src/profiles.ts`(或新 `config-section.ts`)、`http.ts`、`index.ts`(feature)、`types.ts`;测试。

- 在 ProfileStore 加(或独立工具):`getSection(activeId, key)` 与 `setSection(activeId, key, value)`,用 `import { parse, stringify } from 'yaml'` 解析 active profile YAML,读/写某顶层段(rules/proxies/proxy-groups/tunnels/sniffer/dns/interface-name 等),写后保持其余内容。
- `http.ts`:`GET /api/control/config/section?key=<k>` → 返回 active profile 的该段(JSON,缺省 `null`);`PUT /api/control/config/section`(body `{ key, value }`)→ 写回该段到 active profile 内容,`setActive` 重新激活(重启内核应用)。无 active profile → 409。
- `info().features` 加 `'config-sections'`。

**验收:** get 返回正确段;put 改写该段且不破坏其余 YAML、触发 re-activate;无 active→409;feature 含 `config-sections`。agent `test`+`typecheck` 绿。

## Task 2 — desktop UI:GUI 规则编辑器

**Files:** `packages/ui/`(rules 页/新组件;复用 config-section 调用 + 现有 control 客户端);测试 + `test/setup.ts`。

- 能力门控 `config-sections`:在 rules 页加「编辑模式」——`GET …/section?key=rules` 取规则数组,支持**增/改/删/拖拽排序**单条规则(type + payload + policy 的表单),本地编辑后「保存」一次性 `PUT …/section { key:'rules', value }`(避免每改一条都重启内核)。
- 现有只读规则视图(命中统计等)保留;编辑器是叠加能力。校验:基本的规则类型/字段非空。失败 toast;i18n en/zh/ru。

**验收:** 能力存在时可增改删排序并保存(单次 PUT);缺失时不显示编辑器;不回归现有 rules 测试。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 3 — desktop UI:网络配置编辑器(tunnels/sniffer/网卡/external-controller)

**Files:** `packages/ui/`(config 页新增卡片;config-section 原语 + 适用处 PATCH /configs);测试。

- 能力门控 `config-sections`,config 页加:
  - **tunnels** 编辑器(数组:network/address/target 等条目增删)
  - **sniffer** 配置(enable + sniff 端口/协议 + override-destination 等常用项)
  - **outbound interface**(interface-name 字符串;可热改走 PATCH /configs)
  - **external-controller / secret**(只读展示当前 + 说明桌面端由 app 受管;非桌面后端可编辑)
- 经 `PUT …/section`(或 interface 走 PATCH /configs);失败 toast;i18n。

**验收:** 各编辑器读当前值、保存写对应段;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 4 — desktop UI:自定义 CSS 注入

**Files:** `packages/ui/`(设置项 + 注入逻辑);测试。

- 设置区加「Custom CSS」文本域,内容持久化(localStorage / 现有 settings)。应用时把内容注入到一个受管 `<style id="mcxd-custom-css">`(随内容变更更新;空则移除)。对 hosted + desktop 均生效(纯前端)。
- i18n en/zh/ru;说明这是给高级用户改外观的。

**验收:** 输入 CSS → 注入 `<style>` 且随更新/清空同步;持久化往返;不回归。`pnpm --filter @metacubexd/ui run test:unit` + `typecheck` 绿。

## Task 5 — desktop:PAC 模式(系统代理 auto-config 变体)

**Files:** `apps/desktop/src/main/sysproxy.ts`(扩展)、`index.ts`;测试 `sysproxy.spec.ts`。

- 给 `SystemProxyController`(或新增同模块函数)加 PAC 能力:`setAutoProxy(url)` / `disableAutoProxy()`,逐 OS:mac `networksetup -setautoproxyurl <svc> <url>` / `-setautoproxystate <svc> on|off`;win 注册表 `AutoConfigURL`;linux `gsettings org.gnome.system.proxy mode 'auto'` + `autoconfig-url`。注入 exec 可测,不碰真机。
- 暴露给桌面(可经 sysproxy 路由扩展 body `{ mode:'fixed'|'pac', pacUrl? }`,或单独路由)——择简:扩展现有 sysproxy 路由支持 pac 模式;退出时一并清除(防断网)。

**验收:** 注入 exec 断言三平台 PAC set/disable 命令正确;退出清除覆盖 PAC;未知平台抛错。desktop `test`+`typecheck` 绿(若改到 agent 路由则 agent 也绿)。

---

## 完成后

全包 gate。汇报。**Wave 8** = 流媒体/AI 解锁检测 + 多目标连通性看板 + JS/Lua 脚本 profile(worker 沙箱 + 超时,文档注明仅用可信脚本)+ 二维码分享(inline 引入轻量 qr 依赖)+ Windows UWP loopback(注入 exec、本机无法运行时验证)。
