# Desktop Parity — Wave 2 实现计划(原生系统代理)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 范围:**P0 系统代理开关**(逐 OS)+ **P1 bypass/LAN 白名单** + 托盘/UI 开关。无证书。

**设计(注入式控制器,镜像 supervisor 的注入方式):** OS 相关代码放桌面端 `main/sysproxy.ts`;agent 只持有一个通用 `SystemProxyController` 接口并据此暴露能力门控的 HTTP 路由,使 UI 走统一的 `/api/control` 传输并复用现有能力门控(`info.features` + `useControlInfo`)。控制器在桌面 `boot()` 里构造,指向 `127.0.0.1:${MCXD_MIXED_PORT}`(Wave 1 已注入受管 mixed-port)。

**安全(关键):** 退出(`before-quit`)与异常路径必须 `disable()` 系统代理,否则系统代理指向已停的 loopback 端口会导致**全机断网**。

**通用约束:** 同 Wave 1(严格 TDD;跑该包 `test`+`typecheck` 后再提交;不 `pnpm install`;只改本任务文件;conventional commit)。所有 OS 调用经**注入的 `exec`**,测试断言生成的命令而**不触碰真实系统**。

---

## Task 1 — agent:`SystemProxyController` 接口 + 能力门控路由

**Files:** `packages/agent/src/types.ts`、`index.ts`、`http.ts`;测试 `http.test.ts`(用 fake controller)。

- `types.ts` 新接口:
  ```ts
  export interface SystemProxyController {
    isEnabled: () => Promise<boolean>
    enable: (bypass?: string[]) => Promise<void> // 用构造时配置的 host:port
    disable: () => Promise<void>
    describe: () => { port: number; bypass: string[] } // 当前配置(同步)
  }
  ```
- `createAgent` 增可选 `systemProxy?: SystemProxyController`,放进返回对象;传给 `createControlRouter`。
- `http.ts`:仅当 `systemProxy` 存在时注册:
  - `GET /api/control/sysproxy` → `{ enabled: await isEnabled(), port, bypass }`
  - `POST /api/control/sysproxy`(body `{ enabled: boolean; bypass?: string[] }`)→ `enabled ? enable(bypass) : disable()`,返回最新 `{ enabled, port, bypass }`
  - 不存在时这两条返回 404 `{ error: 'system-proxy unavailable' }`。
- `info().features`:存在 controller 时追加 `'system-proxy'`。

**验收:** 有 controller → GET/POST 正常、info 含 `system-proxy`;无 controller → 路由 404、info 不含。fake controller 断言 enable/disable 被正确调用。agent `test`+`typecheck` 绿。

## Task 2 — desktop:`main/sysproxy.ts` 逐 OS 实现

**Files:** 新 `apps/desktop/src/main/sysproxy.ts`;测试 `sysproxy.test.ts`。

- `createSystemProxyController({ host, port, platform?, exec? })` 实现上面的接口。`exec` 注入(默认 promisify(child_process.exec)),`platform` 默认 `process.platform`。
- **macOS**:`networksetup -listallnetworkservices` 列服务(跳过首行说明与带 `*` 的禁用项);对每个服务设 `-setwebproxy`、`-setsecurewebproxy`、`-setsocksfirewallproxy` 为 `host port`,并 `-set{web,secureweb,socksfirewall}proxystate on`;`disable()` 把三个 state 设 `off`;bypass → `-setproxybypassdomains <服务> <list...>`。`isEnabled()` 解析 `-getwebproxy <首个服务>` 的 `Enabled: Yes`。
- **Windows**:`reg add "HKCU\\...\\Internet Settings" /v ProxyServer /t REG_SZ /d 127.0.0.1:port /f` + `ProxyEnable=1`;bypass → `ProxyOverride`(`;` 分隔,含 `<local>`);`disable()` → `ProxyEnable=0`;`isEnabled()` 读 `reg query ... /v ProxyEnable`。尽力广播 WININET 刷新(CLI 不便,接受"部分应用下次启动生效")。
- **Linux(GNOME)**:`gsettings set org.gnome.system.proxy mode 'manual'` + `.../proxy.http host/port`(https、socks 同);bypass → `org.gnome.system.proxy ignore-hosts`;`disable()` → `mode 'none'`;`isEnabled()` 读 `mode`。注释说明仅覆盖 GNOME/gsettings。
- 每个分支命令**幂等**、对未知 platform 抛清晰错误。

**验收:** 注入 mock `exec`,对三平台分别断言 enable/disable/isEnabled/bypass 生成的命令序列正确;未知平台抛错。desktop `test`+`typecheck` 绿。

## Task 3 — desktop:`boot()` 接线 + 退出清除(防断网)

**Files:** `apps/desktop/src/main/index.ts`(+ 必要的小设置持久化);测试。

- `boot()`:构造 `createSystemProxyController({ host: '127.0.0.1', port: mixedPort })`(用 Wave 1 的 mixedPort),传入 `createAgent({ ..., systemProxy })`,存模块变量。
- bypass 默认值:合理 LAN 白名单(`localhost, 127.0.0.1, ::1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, <local>`);持久化到 `userData/sysproxy.json`(可选,读不到用默认)。
- **`before-quit`/`shutdownKernel`:`await systemProxy.disable()`**(best-effort,catch),确保退出不留死代理。崩溃看门狗重启失败到 errored 时也应 disable(尽力)。
- 暴露给托盘的句柄(Task 4 用)。

**验收:** createAgent 收到指向 mixedPort 的 controller;退出路径调用 `disable()`(可用注入/spy 断言)。desktop `test`+`typecheck` 绿。

## Task 4 — desktop:托盘"系统代理"开关

**Files:** `apps/desktop/src/main/tray.ts`、`index.ts`;测试 `tray.test.ts`。

- `TrayDeps` 增 `systemProxy?: { isEnabled(): Promise<boolean>; enable(): Promise<void>; disable(): Promise<void> }`(可选,缺省则不显示该项)。
- 菜单加 "System proxy" checkbox:`checked` 反映 `isEnabled()`(rebuild 时异步取,缓存上次值防闪烁);点击 → enable/disable 后 rebuild。
- `index.ts` 把 boot 构造的控制器传入 `createTray`。

**验收:** 注入 fake controller,点击切换调用 enable/disable 且勾选反映状态;controller 缺省时无该菜单项、其余菜单不受影响。desktop `test`+`typecheck` 绿。

## Task 5 — desktop UI:能力门控的系统代理开关 + bypass 编辑器

**Files:** `packages/ui/`(config 页新增卡片/区块 + 调 `/api/control/sysproxy` 的 composable;沿用现有 `useControlInfo`/KernelControlPanel/profiles 调 `/api/control` 的方式);测试。

- 仅当 `useControlInfo` 报 `hasFeature('system-proxy')` 时显示"System Proxy"卡片(参照 KernelControlPanel/profiles 的能力门控)。
- 控件:开关(GET 初值、POST `{ enabled }`)+ bypass/LAN 白名单文本域(每行一条;保存随 POST `{ enabled, bypass }`)。
- 调用走现有的桌面 control 客户端(同 KernelControl/profiles 的 fetch 封装,带 token)。i18n:en/zh/ru 加键(沿用现有 i18n 结构)。
- **测试注意**:单测用 `test/setup.ts` 伪造 Nuxt auto-imports —— 任何新用到的 Vue API / store / composable 依赖需在那里注册,否则 "X is not defined"(见记忆 [[test-setup-auto-import-stubs]])。

**验收:** 能力存在时渲染开关+bypass 并正确调用 `/api/control/sysproxy`;能力缺失时不渲染。`pnpm --filter @metacubexd/ui run test:unit` 绿(含新测试)+ `pnpm --filter @metacubexd/ui typecheck` 绿。

---

## 完成后(本波结束)

全包 gate:agent/desktop/server `test`+`typecheck`、`pnpm --filter @metacubexd/ui run test:unit` + `typecheck`。汇报,再开 Wave 3(内核版本管理 + Geo + DNS UI + Merge profile)。
