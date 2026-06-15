# TUN 方案 B — Wave B-5 实现计划(打包 + 文档,收官)

> 执行:subagent-driven(顺序,每任务 implement→review→fix)。分支 `feat/desktop-feature-parity`,本地不推送。
> 依据 spec §12。B-5 把 helper + wintun 进包,补 README TUN 章节。**electron-builder 实际打包/真机本机无法跑——只做配置 + 脚本 + 静态校验 + 文档;真机打包验证留 CI/用户。**

**通用约束:** 同前(`test`+`typecheck`;**不 `pnpm install`**;只改本任务文件;不吞错误;conventional commit 小写主题)。

---

## Task 1 — desktop:打包 helper + wintun.dll

**Files:** `apps/desktop/electron-builder.yml`、`apps/desktop/scripts/fetch-mihomo.mjs`(或新 `fetch-wintun` 步骤)、(按需 `apps/desktop/src/main/helper/installer.ts` 的路径解析);测试(脚本/路径解析可单测的部分)。

- **helper 进包**:确认 `electron-builder.yml` 的 `files`/asar 设置包含 `out/helper/**`(electron-vite 已产出 `out/helper/index.js`)。若 helper 需以独立文件被特权服务 spawn(asar 内不能直接执行),把 `out/helper` 加入 `asarUnpack`(像 mihomo 那样),并让 installer 用解包后的真实路径(packaged: `process.resourcesPath/app.asar.unpacked/out/helper/index.js`;dev: 源/out 路径)。统一一个 `resolveHelperEntry({ isPackaged, resourcesPath, appPath })` 纯函数 + 单测。
- **wintun.dll(Windows)**:mihomo 在 Windows 建 TUN 需同目录的 `wintun.dll`。扩展 fetch 脚本在 Windows 目标拉取 `wintun.dll` 到 `resources/`(幂等,沿用 fetch-mihomo 风格;来源用官方 wintun.net zip 或 mihomo 配套),`electron-builder.yml` 把 `wintun.dll` 列入 win 的 extraResources + asarUnpack。非 Windows 不需要。
- **mac entitlement 注记**:TUN 在已签名 app 需 network entitlement;**本项目未签名**,entitlement 无意义,代码/文档注明(不加签名相关配置)。
- 静态校验:`electron-builder.yml` YAML 合法;`resolveHelperEntry` 单测;fetch 脚本幂等(已存在则跳过)。**不实际打包。**

**验收:** electron-builder 配置含 out/helper(+ asarUnpack)与 win wintun.dll;`resolveHelperEntry` 逐环境路径正确(单测);fetch 脚本幂等。desktop `test`+`typecheck` 绿(脚本若 mjs 不入 tsc,则只跑 test + 校验 YAML)。**注明未真机打包。**

## Task 2 — docs:README TUN 章节

**Files:** `README.md`(或 docs 下对应文件);无测试(纯文档)。

- 新增 "TUN mode (desktop)" 章节:
  - 它做什么(接管全机流量,免逐应用代理)、需要**特权 helper**(一次性安装,会弹管理员授权)。
  - **未签名现实**:mac Gatekeeper / Windows SmartScreen / 未知发布者警告 + 如何放行;helper 安装会再弹一次授权。
  - **逐 OS 注意**:mac(LaunchDaemon)、Windows(服务 + wintun.dll 随包)、Linux(systemd + GNOME;pkexec)。
  - **恢复网络**:若断网,用 UI"恢复网络"按钮 / 退出 app(退出会自动拆 TUN)。
  - **状态说明**:TUN 为新功能,需在各 OS 真机验证;遇问题反馈。
- 中英按 README 现有语言风格(若 README 为英文则英文;保持一致)。

**验收:** README 有清晰 TUN 章节,覆盖安装/提权/未签名/逐 OS/恢复网络。无测试;`pnpm --filter @metacubexd/desktop typecheck` 仍绿(未碰代码)。

---

## 完成后(TUN-B 收官)

全包 gate(agent/desktop/server/ui test+typecheck,desktop build)。汇报 **TUN-B 全 5 波结构完成**。**强调:整套 TUN 是单测 + 命令生成 + 配置层面完成,真实安装/提权/建网/逐 OS 行为需用户在 mac/win/linux 真机冒烟。** 之后建议走 finishing-a-development-branch:真机冒烟 → 本地合并回 main(不推送)。
