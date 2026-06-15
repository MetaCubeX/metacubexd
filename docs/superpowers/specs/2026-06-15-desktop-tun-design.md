# metacubexd 桌面端 TUN 模式 — 设计 spec(待用户过目)

> 状态:**设计待批准**。批准后再写实现计划、分波 TDD 实现。本文聚焦架构决策,不含实现代码。
> 关联:[[2026-06-15-desktop-competitor-gap-analysis]](TUN 在其中标为 P1 / L,原"硬依赖签名")。

## 1. 目标与范围

让桌面端能开启 **TUN(虚拟网卡)模式**:接管全机流量经 mihomo,无需逐应用设系统代理。覆盖 mac / Windows / Linux。**不含**分应用路由(依赖 TUN 之上,后续)。

## 2. TUN 与系统代理的本质差异(为什么难)

- 系统代理(已实现):我们 shell-out 改 OS 代理设置,mihomo 普通用户态即可。
- **TUN:虚拟网卡设备、修改路由表、DNS 劫持都需要管理员/root 权限。** mihomo **自带** TUN inbound(`tun:` 配置块 + `auto-route`/`auto-detect-interface`/`dns-hijack`),只要内核**有权限**就能自己建设备、配路由。所以我们要补的**不是** TUN 逻辑,而是:
  1. **给内核提权**(核心难点);
  2. 注入/移除 `tun:` 配置;
  3. **安全拆除**(防断网);
  4. 与现有 UI 开关集成 + 能力门控。

## 3. 现状(已核实)

- **UI 已有 TUN 开关**:`config.vue` 有 enable + stack(Mixed/gVisor/System/LWIP)+ device,经 Clash API `PATCH /configs` 写 `tun`。**但内核普通用户态运行,翻开开关设备建不起来**——这正是缺口。
- supervisor 用普通 `spawn` 启动 mihomo(无提权);`binaryPath` 可变(Wave 3 `setBinaryPath`)。
- 我们有 config-section 编辑原语(Wave 7)可注入 `tun:` 块。

## 4. 核心决策:提权策略(请你选)

未签名应用做 TUN 本就别扭(提权弹窗 + "未知开发者"警告)。三种策略:

### 方案 A — 按需提权(每会话弹窗,无安装器)【推荐起步】

开 TUN 时提权重启内核:mac `osascript ... with administrator privileges`、Windows UAC(ShellExecute `runas`)、Linux `pkexec`。

- ✅ 简单、无需安装系统服务、未签名也能跑;拆除直接。
- ❌ **每次会话开 TUN 要授权一次**;整个内核以高权限运行(权限面大);未签名警告。

### 方案 B — 特权 helper/daemon(一次性安装,之后顺滑)

装 launchd LaunchDaemon(mac)/ systemd unit(linux)/ Windows 服务,经 IPC(unix socket / 命名管道)代为建 TUN 或运行内核。Clash Verge 走这条。

- ✅ 一次 admin 安装后切换 TUN 免再提权;内核可保持低权、由 helper 提供能力。
- ❌ **工程量大数倍**(安装/卸载、IPC 协议+鉴权、生命周期、版本握手);**未签名 helper 安装更扎眼**、易被拦;维护成本高。

### 方案 C — 混合(Linux setcap + 其余按需提权)【推荐增强】

Linux 用 `setcap cap_net_admin,cap_net_bind_service+ep mihomo`(一次 pkexec 授权后,内核免提权即可 TUN);mac/Windows 仍用方案 A。

- ✅ Linux 体验最佳(免重复弹窗);其余平台保持简单。
- ❌ setcap 仅 Linux;mac/win 仍每会话提权。

**我的建议:先做 A(+ Linux 用 C 的 setcap),把 B 留作未来"若以后签名"的增强。** 这样未签名也能交付可用的 TUN,工程可控。**请你确认走哪条。**

## 5. 架构(以方案 A/C 为例)

- 新 `apps/desktop/src/main/tun-controller.ts`:`createTunController({ supervisor, elevate, platform, exec, setSection })`。
  - `enable({ stack })`:① 注入 `tun:` 块(enable:true、stack、`auto-route:true`、`auto-detect-interface:true`、`dns-hijack:['any:53']`、合理 `device`)到 active config(复用 Wave-7 setSection 或 supervisor 注入);② **提权重启内核**(elevate 注入:mac osascript / win runas / linux:若已 setcap 则普通 spawn,否则 pkexec);③ 标记 tun 激活态(持久化)。
  - `disable()`:移除 `tun:` 块 → 普通态重启内核 → mihomo 退出时自动清路由;**额外兜底**清理(见 §6)。
  - `isElevationAvailable()` / `status()`。
- **能力门控**:agent `info().features` 加 `'tun'`;UI 现有 TUN 开关接到 tun-controller(翻开→触发提权流程,而非仅 PATCH /configs)。
- **两种运行模式**(借鉴 Verge):Sidecar(默认,普通态、无 TUN)vs TUN(提权)。切换即重启内核。
- 所有 OS 调用经**注入的 exec/elevate**,可单测命令拼装。

## 6. 安全 / 防断网(关键)

TUN 配错 = 全机断网。必须:

- **退出/崩溃强制拆除**:`before-quit` 与崩溃看门狗里移除 `tun:` 并尽力恢复路由(mihomo 正常退出会清,但崩溃可能残留——保留一个"恢复网络"的兜底:删 tun 配置 + 普通态重启 + 必要时 `route` 清理)。
- **看门狗联动**:TUN 态下内核崩溃,看门狗重启需带回 TUN(否则用户以为还在 TUN 却已裸奔)——或明确降级到 sidecar 并通知。
- **strict-route / auto-route**:用 mihomo 的 `auto-route` + `strict-route`(可选)避免泄漏 / 防止把自身流量也劫持成环。
- **DNS**:`dns-hijack` 接管;退出恢复系统 DNS(mihomo 处理,验证)。
- **"恢复网络"按钮**:UI 提供一键 disable + 清理,救急。

## 7. 未签名注意

- mac:osascript 提权弹原生管理员对话框;未公证的内核二进制首次可能被 Gatekeeper 拦(需用户放行)。LaunchDaemon 路线(方案 B)未签名更难。
- Windows:UAC "未知发布者";wintun.dll 需随包(`apps/desktop/resources`)。
- Linux:pkexec/setcap 需用户授权;发行版桌面环境差异。
- README 增 TUN 章节,说明提权与未签名的现实。

## 8. 逐 OS 要点

- **macOS**:utun 设备由 mihomo 建;提权 = `osascript -e 'do shell script "<kernel cmd>" with administrator privileges'`(或装 LaunchDaemon=方案B)。
- **Windows**:wintun(随包 wintun.dll);提权 = 以 `runas` 重启内核(UAC)。
- **Linux**:`setcap cap_net_admin,cap_net_bind_service+ep <mihomo>`(一次,经 pkexec)→ 之后普通 spawn 可 TUN;否则 pkexec 运行内核。

## 9. 可测性 / 本机限制

- tun-controller 用注入 exec/elevate,**单测命令拼装与状态机**(不真正提权/建设备)。
- **本机是 macOS**:可对 mac 路径做命令级单测,但**真正建 utun + 全机流量 + 提权弹窗无法在 CI/headless 验证**;Windows/Linux 路径**完全无法在本机运行时验证**——只做命令生成 + 单测,运行时验证留真机。spec 与 PR 明确标注。

## 10. 拟分波(批准后细化)

- **W-TUN-1(agent/desktop)**:`tun:` 配置注入/移除(复用 setSection)+ tun-controller 状态机(注入 elevate/exec)+ 能力 `'tun'` + 安全拆除(退出/崩溃)。
- **W-TUN-2(desktop)**:逐 OS elevate 实现(osascript / runas / pkexec + Linux setcap)+ 看门狗联动 + wintun 随包。
- **W-TUN-3(ui)**:现有 TUN 开关接 tun-controller(提权流程 + 能力门控)+ "恢复网络"按钮 + stack 选择 + 状态/错误反馈。
- 真机冒烟(用户)分别在 mac/win/linux 验证。

## 11. 待你拍板

1. **提权策略**:A(按需提权,推荐)/ C(A + Linux setcap,推荐增强)/ B(特权 helper,重)?
2. 是否接受**未签名下 TUN 的现实**(提权弹窗、OS 警告、mac 每会话再提权)?
3. 本机无法运行时验证 win/linux(及 mac 真实建网),**只能命令级单测 + 留真机验证**,可接受?
