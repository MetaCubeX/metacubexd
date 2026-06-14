# metacubexd 桌面端竞品功能缺口分析

> 调研日期 2026-06-15。多 agent 工作流产出(3 路读码盘点现状 + 6 个竞品并行联网调研 + 合成 + 对抗式 critic 审查)。
> 竞品:Clash Verge Rev(Tauri/Rust,~125k★)、Mihomo Party(Electron,架构最接近)、FlClash(Flutter)、Clash Nyanpasu(Tauri)、GUI.for.Clash(Wails/Go)、Clash for Windows(EOL 基线)。

## 1. 我们的架构回顾

metacubexd desktop 是 Electron 客户端:进程内 **control server** 在 `127.0.0.1:<controlPort>` 同源提供渲染器(loopback HTTP)+ `/api/control`(h3 router,per-launch token 鉴权);mihomo Clash API 在独立 loopback 端口;`packages/agent` 负责内核监管 + 配置注入 + profile 存储;`packages/ui`(Nuxt CSR)是仪表盘;托盘常驻。数据目录在 `userData/mihomo-home`。

**优势(竞品多数没有的):** 智能节点推荐与自动切换、Data Usage 历史流量分析(IndexedDB)、5 种节点展示模式、连接表分组/列定制、32 套 DaisyUI 主题、GeoIP 富化、PWA。仪表盘本身比多数竞品更强。

**短板集中在「桌面外壳 / OS 集成」层** —— 这正是 Verge/Party 等原生客户端的强项,也是 metacubexd 从「面板」升级为「完整客户端」必须补的部分。

## 2. 已验证的真实 Bug(调研顺手发现,应优先修)

| Bug                            | 证据                                                                                        | 影响                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **托盘图标缺失**               | `tray.ts` 引用 `resources/tray.png`,但该文件不存在 → `nativeImage.createEmpty()` 空白图标   | 托盘常驻应用唯一的入口**不可见**                      |
| **`boot()` 不注入 mixed-port** | `boot()` 调 `createAgent` 时未传 `mixedPort`,`injectClashConfig()` 因此跳过 mixed-port 注入 | 内核可能没有固定 mixed-port,系统代理无从指向          |
| **订阅就地刷新缺失**           | 无 `profiles.refresh(id)`;`importFromUrl` 每次都 mint 新 id                                 | 重新拉订阅会产生**孤儿 profile**,而非更新原有         |
| **macOS 未签名**               | electron-builder `identity:null`,无 Windows 签名                                            | Gatekeeper/SmartScreen 拦截;且阻塞自更新与 setuid TUN |
| **崩溃不自愈**                 | `proc.on('exit')` 仅置 `errored`,无重启                                                     | 内核意外退出后代理静默失效                            |
| **`fetchKernel` 未接线**       | `fetch-kernel.ts` 存在但没接到任何 control 路由                                             | 无法从 UI 管理/切换内核版本                           |

## 3. 优先级缺口清单

优先级:**P0 = 可信桌面客户端的及格线** / **P1 = 强价值** / **P2 = 锦上添花**。工作量 S/M/L。

### P0(及格线 —— 全部 6 个竞品都有)

| 功能                                  | 工作量 | 落地要点                                                                           | 备注                                |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------- | ----------------------------------- |
| **系统代理开关**                      | M      | `main/sysproxy.ts` 按 OS 实现(mac `networksetup` / win 注册表 / linux `gsettings`) | 需先修 `boot()` mixed-port bug      |
| **订阅定时自动更新**                  | M      | `profiles.refresh(id)` + `updateInterval` + 调度器                                 |                                     |
| **订阅就地刷新**                      | S      | `profiles.refresh(id)` 复用 doFetch,更新原 profile                                 | 修 bug                              |
| **应用自更新**                        | M      | `electron-updater` + publish feed                                                  | **硬依赖代码签名**                  |
| **代码签名 / 公证**                   | M      | macOS Developer ID + notarize;Windows Authenticode                                 | **需用户提供证书**;阻塞自更新与 TUN |
| **托盘:模式切换(rule/global/direct)** | S      | PATCH Clash `/configs`(经 `MCXD_CLASH_URL/SECRET`)                                 | 日常高频路径                        |
| **托盘图标资产**                      | S      | 加 `resources/tray.png` + macOS Template 图标                                      | 修 bug                              |

### P1(强价值)

| 功能                                                | 工作量 | 落地要点                                                                                       |
| --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| **TUN / 虚拟网卡**                                  | L      | `config.vue` 已通过 Clash API 暴露开关(部分);缺特权管线:按需提权内核 + 路由/DNS;**硬依赖签名** |
| 代理 bypass / LAN 白名单编辑器                      | S      | 配合系统代理,避免断 LAN                                                                        |
| DNS 设置 UI(nameserver/fake-ip/hosts/enhanced-mode) | M      | 现仅有 DNS 查询工具,无编辑器                                                                   |
| mihomo 内核版本管理(列出/切换/升级)                 | M      | 接线 `fetchKernel` 到 `kernel/versions`+`upgrade`;stable/alpha                                 |
| GeoIP/GeoSite/MMDB 资产下载更新                     | M      | `fetchGeoAssets(homeDir)` + 首次引导 + 定时路由                                                |
| 崩溃自动重启 / 看门狗                               | S      | 意外退出后带退避重启,可关                                                                      |
| Deep-link 自定义 URL scheme 导入订阅                | S      | `setAsDefaultProtocolClient` + second-instance argv                                            |
| Profile 合成:Merge(YAML 覆盖)                       | M      | Merge 类型 + setActive 前 enhance;复用 MonacoYamlEditor                                        |
| 托盘:系统代理/TUN 开关 + 代理组选择器               | M      | 扩展 `tray.ts`;组子菜单经 Clash API;动态图标色                                                 |
| 开机静默/最小化启动                                 | S      | 检测 login-launch(`--hidden`),跳过 `createWindow()`                                            |

### P2(锦上添花,已分组归并)

- **WebDAV/云备份还原**(M):本地 JSON 导出已有,缺远程 profile 同步。
- **网络配置编辑器组**(M):PAC、sysproxy guard、网卡选择器、sniffer、tunnels、external-controller/secret UI、运行时配置查看器(`GET /api/control/config/runtime` 只读)。
- **UX 打磨组**(M):全局热键、窗口尺寸持久化、原生应用菜单、lite mode、置顶悬浮窗、系统通知。
- **Profile/诊断组**(L):JS/Lua 脚本(沙箱)、GUI proxy/group/rule 编辑器、二维码分享、流媒体/AI 解锁检测、多目标连通性测试、内嵌面板启动器、Sub-Store。
- **监控/定制组**(M):连接导出(CSV/JSON)、切换时断连(把 `autoCloseConns` 扩展到 profile/mode)、自定义 CSS、更多语言(现 3 个 vs Verge 13)、全 provider 健康检查、Windows UWP loopback 豁免、分应用路由(依赖 TUN)。

## 4. 实现批次建议(波次)

- **Wave 0 — Bug 修复(S,几乎零风险):** tray.png、`boot()` mixed-port、订阅就地刷新、崩溃看门狗。
- **Wave 1 — P0 核心(M):** 系统代理(含 bypass)、订阅自动更新调度、托盘模式切换。
- **Wave 2 — P1 内核/资产/配置(M):** 内核版本管理(接线 fetchKernel)、Geo 资产、DNS 设置 UI、Merge profile、deep-link、静默启动、托盘扩展。
- **Wave 3 — 分发(M,需用户证书):** 代码签名/公证 + 自更新。
- **Wave 4 — TUN(L):** 特权 helper 管线(逐 OS),依赖 Wave 3 的签名。
- **Wave 5 — P2 长尾:** 按需挑选。

## 5. 阻塞 / 前置依赖(我无法独立完成)

1. **代码签名:** 需用户提供 Apple Developer ID 证书 + Windows Authenticode 证书(及 CI secrets)。我可把配置与 CI 接好,但无法真正签名。
2. **自更新:** macOS 未签名无法自更新;依赖 (1)。
3. **TUN:** 需特权 helper(NT Service/systemd/launchd)、提权弹窗、逐 OS 路由管理 —— 是独立工程,且依赖 (1);建议单独 spec。

## 6. 风险

- Electron(vs Verge 的 Tauri/Rust)拿不到原生 OS API,sysproxy/TUN 必须 shell-out 到系统命令或带原生 helper,体积/内存更大。
- 系统代理在各 OS 行为差异大(尤其 Linux 桌面环境碎片化);需 per-OS 测试。
- TUN 的路由/DNS 劫持若出错会断网,必须有可靠的回滚与 strict-route。
