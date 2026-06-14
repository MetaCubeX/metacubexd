# metacubexd → Monorepo + Electron 桌面端 + 一体化服务端：设计规格

> 状态：已批准架构，待评审实现规格。日期：2026-06-14。

## 1. 概述与目标

把 metacubexd 从「单一 Nuxt SPA 仪表盘」改造成一个 **pnpm monorepo**，从同一份代码产出三种形态：

- **同一份仪表盘 UI**（原样复用，逻辑不动）；
- **Electron 桌面端**：自带并监督自己的 mihomo 内核；
- **一体化 Docker 服务端**：无头方式做同样的事。

### 变更点

- 仓库转为 pnpm 10 workspace；约 90 个依赖全部移入 `pnpm-workspace.yaml` 的单一 `catalog:`。
- 新增 `packages/agent`：共享 supervisor —— spawn/stop/restart mihomo、流式内核日志、profile CRUD —— 以传输无关的控制 API 暴露，被 **Electron 主进程**与 **Nitro 服务端**共同消费。
- 新增两个 app：`apps/desktop`（Electron）与 `apps/server`（独立 Nitro），后者取代今天「只托管静态资源」的 Docker 镜像。
- 新增 UI 面：内核控制、profile 管理器、Monaco + monaco-yaml 配置编辑器 —— 全部 **能力门控**，连接裸远程 mihomo 时行为与今天完全一致。

### 复用点（逻辑不动）

- 整个 Vue 应用原样迁入 `packages/ui`，保持 `ssr:false`、`hashMode:true`、`{url, secret}` endpoint store，**直连 mihomo 的 Clash API**（ky + 原生 WebSocket）。agent 控制面与之**正交**，绝不代理 Clash API。
- `runtimeConfig.public.defaultBackendURL`（`nuxt.config.ts` 已有）作为自动发现本地 endpoint 的注入点。
- 现有 `pnpm-lock.yaml` 原样复用（catalog 转换会重新解析到同一锁定版本）。

**设计不变量**：UI 在三种部署里是同一份产物；不同的只是「谁托管它、谁监督内核」。agent 以 **TS 源码**被消费（无 dist、无 CJS/ESM 双产物），各 app 的打包器（electron-vite / Nitro-Rollup）各自转译，绕开所有 `[ERR_REQUIRE_ESM]` 互操作坑。

### 已确认决策（来自需求澄清）

| 项           | 决策                                                                                                         |
| :----------- | :----------------------------------------------------------------------------------------------------------- |
| 桌面技术栈   | Electron（electron-vite + electron-builder）                                                                 |
| 服务端后端   | 复用 `packages/agent`（Node/TS），独立 Nitro 托管                                                            |
| 内核获取     | CI 按平台/架构下载内置；用户可在设置中指定自定义路径覆盖                                                     |
| 服务端形态   | 一体化镜像（内置 mihomo + UI + agent）                                                                       |
| 配置管理     | 完整 profile CRUD + Monaco + monaco-yaml（mihomo schema）                                                    |
| 依赖管理     | pnpm 单一默认 catalog                                                                                        |
| 桌面平台覆盖 | **全覆盖**：mac arm64+x64、win x64+arm64、linux x64+arm64                                                    |
| 桌面升级     | **手动下载**（复用现有「新版本」提示，不接 electron-updater）                                                |
| 版本流       | **单一主版本流**（沿用 1.254.x，一个 tag 同发 UI+desktop+server）                                            |
| 订阅自动刷新 | **v1 仅手动**（调度器后置）                                                                                  |
| vite         | 根保留 `npm:rolldown-vite@latest`；桌面端若构建异常再单独 pin 真 vite                                        |
| 控制 token   | 独立随机值（桌面每次启动随机、服务端环境变量）；桌面进程内调用免鉴权                                         |
| 内核日志     | 内存环形缓冲 + SSE；文件落盘后置                                                                             |
| tsconfig     | 新增根 `tsconfig.base.json`（agent/desktop/server 继承）；`packages/ui` 继续 `extends ./.nuxt/tsconfig.json` |
| schema 校验  | 配置编辑器提供「关闭校验」开关                                                                               |

---

## 2. Monorepo 结构

```
metacubexd/
├─ pnpm-workspace.yaml        # packages globs + catalog + overrides（仅根）
├─ pnpm-lock.yaml             # 单一 lockfile，原样复用
├─ package.json               # 私有根编排器（husky/commitlint/scripts）
├─ tsconfig.base.json         # agent/desktop/server 共享基底
├─ .husky/  .github/  .node-version  LICENSE  README.md  .gitignore
├─ docs/                      # 截图 + 本 specs 目录
├─ packages/
│  ├─ ui/                     # 现有 Nuxt 应用，原样迁入
│  │  ├─ nuxt.config.ts       # import ./package.json（仍可用）；设 srcDir:'.'
│  │  ├─ package.json         # @metacubexd/ui，catalog: 引用
│  │  ├─ tsconfig.json        # extends ./.nuxt/tsconfig.json
│  │  ├─ app.vue              # legacy 布局：自动识别，无 app/ 目录
│  │  ├─ pages/ components/ composables/ stores/ utils/ constants/ types/
│  │  ├─ layouts/ middleware/ plugins/ assets/ public/ i18n/
│  │  ├─ vitest.config.ts  eslint.config.mjs
│  │  └─ scripts/  e2e/  __tests__/  test/
│  └─ agent/                  # 新增共享 TS 库（源码导出）
│     ├─ package.json         # @metacubexd/agent，exports ./src/*.ts
│     ├─ tsconfig.json
│     └─ src/
│        ├─ index.ts          # createAgent(): supervisor + profiles + router
│        ├─ types.ts
│        ├─ supervisor.ts     # MihomoSupervisor（进程生命周期）
│        ├─ profiles.ts       # ProfileStore（磁盘 CRUD）
│        ├─ http.ts           # createControlRouter()（h3，传输无关）
│        └─ kernel/
│           ├─ assets.ts      # (os,arch)->mihomo 资源名映射（唯一来源）
│           └─ fetch-kernel.ts# 下载器，CI + dev + electron 复用
└─ apps/
   ├─ desktop/                # Electron（electron-vite + electron-builder）
   │  ├─ package.json
   │  ├─ electron.vite.config.ts
   │  ├─ electron-builder.yml
   │  ├─ scripts/fetch-mihomo.mjs
   │  ├─ resources/           # CI 预置的 per-arch mihomo + default-config.yaml
   │  └─ src/main/ src/preload/
   └─ server/                 # 一体化独立 Nitro 镜像
      ├─ package.json
      ├─ nitro.config.ts
      ├─ Dockerfile
      ├─ docker-entrypoint.sh
      ├─ lib/supervisor.ts    # @metacubexd/agent 的单例封装
      ├─ middleware/auth.ts
      └─ routes/control/  routes/[...].ts
```

### `pnpm-workspace.yaml`（packages + 默认 catalog + 合并后的 overrides）

```yaml
packages:
  - 'packages/*'
  - 'apps/*'

# 单一默认 catalog：每个包用 "catalog:" 引用。
catalog:
  # UI（从旧根 package.json 原样搬入，下面仅示例，其余 ~80 个 UI 依赖同样移入）
  nuxt: 4.4.8
  vue: ^3.5.35
  vue-router: ^5.1.0
  pinia: ^3.0.4
  '@pinia/nuxt': ^0.11.3
  '@vueuse/core': ^14.3.0
  '@vueuse/nuxt': ^14.3.0
  '@tanstack/vue-query': ^5.101.0
  ky: ^2.0.2
  zod: ^4.4.3
  tailwindcss: ^4.3.0
  '@tailwindcss/vite': ^4.3.0
  daisyui: ^5.5.23
  typescript: ^6.0.3
  vitest: ^4.1.8
  '@types/node': ^25.9.2
  # 配置编辑器
  monaco-editor: ^0.55.1
  monaco-yaml: ^5.5.1
  meta-json-schema: ^1.19.27
  # agent 运行时
  tree-kill: ^1.2.2
  yaml: ^2.9.0
  h3: ^1.15.11
  # 桌面工具链
  electron: ^42.0.0
  electron-vite: ^5.0.0
  electron-builder: ^26.0.0
  # 根工具
  husky: ^9.1.7
  lint-staged: ^17.0.7
  commitlint: ^21.0.2
  '@commitlint/config-conventional': ^21.0.2

# overrides 必须只在 workspace 根（pnpm 10/11）。合并旧 package.json#pnpm.overrides
# + 旧 workspace override。
overrides:
  '@isaacs/brace-expansion': '>=5.0.1'
  '@nuxt/devtools-kit': 3.2.4
  '@unhead/vue': 2.1.15
  'brace-expansion@^1': '>=1.1.15'
  'brace-expansion@^2': '>=2.1.1'
  defu: 6.1.7
  diff: '>=9.0.0'
  h3: '>=1.15.11'
  koa: '>=3.2.1'
  node-forge: '>=1.4.0'
  picomatch: '>=4.0.4'
  rollup: '>=4.60.4'
  serialize-javascript: '>=7.0.5'
  srvx: '>=0.11.16'
  tar: '>=7.5.15'
  yaml: '>=2.9.0'
  # 冲突解决（见下）：维持现状 = rolldown-vite。
  vite: 'npm:rolldown-vite@latest'

neverBuiltDependencies: []
```

> **冲突标记并解决（已在仓库核验）。** 今天 `package.json#pnpm.overrides.vite: 8.0.16` 与 `dependencies.vite: 8.0.16` 同时存在，而 `pnpm-workspace.yaml#overrides.vite: npm:rolldown-vite@latest` 在安装时胜出 —— 即**项目目前已跑在 rolldown-vite 上**。**保留 `vite: npm:rolldown-vite@latest`** 为唯一根 override，删除 `8.0.16` pin。**注意**：electron-vite/electron-builder 未针对 rolldown-vite 验证；若 `apps/desktop` 构建失败，仅为 desktop 单独 pin 真 `vite: 8.0.16`（通过其 `devDependencies` 或 per-package 解析）。

### 现有应用迁入 `packages/ui`

- `git mv` 整个当前根（`app.vue`、`pages/`、`components/`、`composables/`、`stores/`、`utils/`、`constants/`、`types/`、`layouts/`、`middleware/`、`plugins/`、`assets/`、`public/`、`i18n/`、`nuxt.config.ts`、`vitest.config.ts`、`eslint.config.mjs`、`tsconfig.json`、`package.json`、`scripts/`、`e2e/`、`__tests__/`、`test/`）进 `packages/ui/`。`docs/` 留在根。
- **不要引入 `app/` 子目录。** Nuxt 4 自动识别本项目的 legacy 根布局（顶层 `pages/`+`components/`、无 `app/`），`~`/`@` 仍指向包根，所有 import 不变。为不依赖启发式，在 `nuxt.config.ts` 显式设 `srcDir: '.'`。
- `nuxt.config.ts` 第 3 行 `import pkg from './package.json'` 仍可用（package.json 一并搬入）。
- `dist -> .output/public` 软链随包搬迁（或在 `packages/ui/` 下重建）。

### 根 `package.json`（私有编排器，纯 `pnpm -r`/`--filter`，无 Turbo）

```json
{
  "name": "metacubexd-monorepo",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.34.1",
  "scripts": {
    "dev": "pnpm --filter @metacubexd/ui dev",
    "build:ui": "pnpm --filter @metacubexd/ui generate",
    "build:server": "pnpm --filter @metacubexd/server... build",
    "build:desktop": "pnpm --filter @metacubexd/desktop... build",
    "build": "pnpm build:ui && pnpm build:server",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "catalog:",
    "commitlint": "catalog:",
    "@commitlint/config-conventional": "catalog:",
    "lint-staged": "catalog:"
  }
}
```

**迁移坑：**

- **Lockfile 纪律**：结构迁移（workspace + `catalog:` 引用）单独一个 commit、**零版本变更**，让 `pnpm-lock.yaml` diff 只有 catalog 协议解析行。版本升级另开 commit。
- **prepare/postinstall 拆分**：根 `prepare: husky`；`packages/ui` 保留 `postinstall: nuxt prepare`。今天根 `prepare` 是 `nuxt prepare && husky`，不拆会在根安装时报 `nuxt: command not found` 或缺 `.nuxt/tsconfig.json`。
- **overrides 即安全 pin**（`brace-expansion`/`node-forge`/`tar`）—— 不抬到根会静默失效（CVE 暴露）。
- **构建顺序**由 filter 语法保证（`@metacubexd/server...` 先拉 ui+agent）；4 个包无需 Turbo。

---

## 3. `packages/agent` —— 共享 supervisor

传输无关 TS 库（`"type": "module"`，无框架）。核心 = `MihomoSupervisor`（进程生命周期）+ `ProfileStore`（磁盘 CRUD），外包一层框架中立的 **h3 路由工厂**，被 Electron 主进程与 Nitro 共同挂载。

### 职责

1. **进程生命周期** —— spawn/stop/restart 内置 mihomo，就绪/崩溃检测，状态机。
2. **配置唯一来源** —— 启动前把 `external-controller` + `secret`（及端口）**写入激活 YAML**，UI 现有 Clash API 直连零改动。
3. **Profile CRUD** —— 磁盘多 profile，订阅导入，校验，set-active。
4. **日志流** —— mihomo **子进程** stdout/stderr（区别于 mihomo 自身的 `/logs` Clash WS，后者 UI 直接拿）。
5. **能力广播** —— `GET /info` 供 UI 门控内核功能。

### 进程模型（关键决策）

- spawn `mihomo -d <homeDir> -f <activeConfigPath>`。**不**用 `-ext-ctl`/`-secret` flag，而是写进激活 YAML（单一来源；flag 会覆盖 config 导致 UI 的 WS `?token=` / Bearer 失配）。
- **就绪检测**：每 ~200ms 轮询 Clash API `GET http://<ctrl>/version`（带 secret），最多 10s。首个 200 → `running` 并捕获 `{version}`。就绪前进程 `exit`/`error` → `errored`。（复用 UI 已在调的端点，无脆弱日志解析。）
- **状态机**：`stopped | starting | running | stopping | errored`，附 `pid`、`startedAt`、`version`、`lastExitCode`、`lastError`。所有生命周期操作经 **async mutex** 串行化（幂等 start/stop），避免多标签页把两个内核抢到 9090。
- **优雅停止**：`SIGTERM`（mihomo 收到会干净退出；`SIGHUP` = reload），等 `stopTimeoutMs`（5s），再 `SIGKILL`。**Windows 一律走 `tree-kill`**（`taskkill /pid <pid> /T /F`），因 `process.kill(pid,'SIGTERM')` 在 Windows 是模拟的、会留孤儿。
- **重启 = stop().then(start())** 经同一 mutex（**不是** mihomo 的 Clash `POST /restart`）—— supervisor 拥有进程，能接住改过的 profile 或二进制路径。
- **校验** = `mihomo -t -d <homeDir> -f <candidate>`，自带超时（>3s 视为无效并 SIGKILL 校验进程）。在 set-active 前、create/update 后运行。诊断视为参考；内核 reload 才是最终校验。

### TypeScript 接口（核心）

```ts
// packages/agent/src/types.ts
export type KernelStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'errored'

export interface KernelState {
  status: KernelStatus
  pid?: number
  startedAt?: number // uptimeMs = Date.now() - startedAt
  version?: string // 就绪后从 Clash GET /version
  externalController: string // 如 '127.0.0.1:9090'，UI 应指向它
  secret: string // Clash API secret（同时写入 config）
  lastExitCode?: number | null
  lastError?: string
}

export interface SupervisorOptions {
  binaryPath: string // 解析后的 mihomo（win 为 .exe）
  homeDir: string // mihomo -d 工作目录（可写）
  activeConfigPath: string // mihomo -f 目标（由 ProfileStore 管理）
  startTimeoutMs?: number // 默认 10_000
  stopTimeoutMs?: number // 默认 5_000
}

export interface MihomoSupervisor {
  getState(): KernelState
  start(): Promise<KernelState>
  stop(): Promise<KernelState>
  restart(): Promise<KernelState>
  validate(configPath: string): Promise<{ valid: boolean; message: string }>
  on(
    event: 'log',
    cb: (l: { stream: 'stdout' | 'stderr'; line: string; ts: number }) => void,
  ): void
  on(event: 'state', cb: (s: KernelState) => void): void
  dispose(): Promise<void>
}

export type ProfileType = 'local' | 'remote'
export interface ProfileMeta {
  id: string
  name: string
  type: ProfileType
  url?: string
  userAgent?: string
  updatedAt: number
  subscriptionInfo?: {
    upload: number
    download: number
    total: number
    expire: number
  }
}
export interface ProfileStore {
  list(): Promise<ProfileMeta[]>
  read(id: string): Promise<string> // 原始 YAML
  create(i: { name: string; content?: string }): Promise<ProfileMeta>
  update(
    id: string,
    p: { name?: string; content?: string },
  ): Promise<ProfileMeta>
  delete(id: string): Promise<void>
  duplicate(id: string, name?: string): Promise<ProfileMeta>
  importFromUrl(url: string, name?: string): Promise<ProfileMeta> // UA 'clash.meta'
  getActiveId(): Promise<string | undefined>
  setActive(id: string): Promise<void> // 校验 + 写 activeConfigPath
}
```

### Profile 存储与订阅导入

- 布局：`<homeDir>/profiles/<id>.yaml` 存内容 + `<homeDir>/profiles/index.json` 清单 `[{id,name,type,url?,userAgent,updatedAt,subscriptionInfo?}]`。`activeId` 存小 `state.json`；`setActive` 校验后把所选 profile 复制到 `activeConfigPath`。**绝不**把元数据存为 YAML front-matter（mihomo 拒绝未知顶层键）。
- **每次启动把 `external-controller`/`secret`/端口叠加进激活 config**，保证用户 profile 在桌面/服务端间可移植。
- **订阅导入**：用 `User-Agent: clash.meta` 拉取；解析 `Subscription-Userinfo: upload=..; download=..; total=..; expire=..` 进 `subscriptionInfo`；原文逐字持久化。

### 控制 API 路由表（挂在与 Clash API **分离**的前缀下）

```
# 前缀: /api/control   鉴权（仅 HTTP）: Authorization: Bearer <AGENT_TOKEN>
GET    /api/control/info                       -> { hasAgent, version, platform, kernel, features }
GET    /api/control/kernel/status              -> KernelState
POST   /api/control/kernel/start | stop | restart -> KernelState
GET    /api/control/kernel/logs                -> text/event-stream（SSE：子进程 stdout/stderr + state）

GET    /api/control/profiles                   -> ProfileMeta[]
POST   /api/control/profiles                   -> ProfileMeta   { name, content? }
GET    /api/control/profiles/:id               -> { meta, content }
PUT    /api/control/profiles/:id               -> ProfileMeta   { name?, content? }
DELETE /api/control/profiles/:id               -> 204
POST   /api/control/profiles/:id/duplicate     -> ProfileMeta
POST   /api/control/profiles/import            -> ProfileMeta   { url, name? }   (UA clash.meta)
POST   /api/control/profiles/:id/activate      -> KernelState   (校验 + setActive + reload)
POST   /api/control/profiles/:id/validate      -> { valid, message }

GET    /api/control/config                     -> 激活 YAML (text/yaml)
PUT    /api/control/config                     -> 校验 + 写入 + reload 内核
GET    /api/control/health                     -> 200（公开，healthcheck）
```

> **日志传输 —— 已统一为 SSE。** `/api/control/kernel/logs` 用 SSE（单向、对代理友好、无需 `crossws` upgrade、在 Electron 内挂载行为一致）。Nitro 的 `features.websocket` 仅在未来出现双向需求时才需要；v1 全程 SSE。（Electron 内进程内 supervisor 经 EventEmitter 发出；SSE 路由仅在 HTTP 面使用。）

### 鉴权与能力探测

- **两个独立 secret**：**Clash secret** 守护内核 RESTful API（代理数据）；**agent token**（`AGENT_TOKEN`，每安装随机）守护进程/profile 管理（start/stop、磁盘写）。以 `Authorization: Bearer <agentToken>` 发送。Electron 进程内绑定时免鉴权（无网络面）；仅 HTTP 挂载强制鉴权。
- `GET /api/control/info` → `{ hasAgent:true, version, platform:{os,arch}, kernel:{bundled, path, version?}, features:['profiles','logs-sse','kernel-control'] }`。UI **每个 endpoint 调一次**；成功解锁内核 UI，404/错误回退今天的纯面板模式。内置 mihomo 版本来自 CI 写入的 build-time JSON。

### 桌面与服务端如何共同消费（单一来源、两种传输）

```ts
// packages/agent/src/index.ts
export function createAgent(
  opts: SupervisorOptions & { profilesDir: string; agentToken?: string },
) {
  const profiles = createProfileStore({
    dir: opts.profilesDir,
    activeConfigPath: opts.activeConfigPath,
  })
  const supervisor = createSupervisor(opts)
  return {
    supervisor, // Electron 主进程：直接 supervisor.start()/on('log')，无 HTTP
    profiles,
    router: createControlRouter({ supervisor, profiles, opts }), // Nitro：挂在 /api/control
    info: () => ({
      hasAgent: true,
      version: AGENT_VERSION,
      platform: { os: process.platform, arch: process.arch },
      kernel: {
        bundled: true,
        path: opts.binaryPath,
        version: supervisor.getState().version,
      },
      features: ['profiles', 'logs-sse', 'kernel-control'],
    }),
  }
}
```

- **桌面**直接 import `@metacubexd/agent`（electron-vite 把 TS 打进主进程产物）。
- **服务端**把 `router` 挂在 `routes/control/**`（Nitro-Rollup 打同一份 TS 源）。
- `packages/agent/package.json` `exports` 指向**源码**：`{ ".": { "types": "./src/index.ts", "import": "./src/index.ts" }, "./http": "./src/http.ts", "./kernel/fetch-kernel": "./src/kernel/fetch-kernel.ts" }`。

**agent 坑：** secret-flag 失配；macOS 隔离属性会让未签名 `.app` 里下载的二进制被杀（剥除 `com.apple.quarantine` + `chmod +x`）；Windows `.exe` 后缀 + tree-kill；只读 `homeDir` → 内核非零退出（确保可写卷/userData）；端口 9090 冲突（选空闲端口、写进 config、把真实 URL 返回 UI）；绝不把控制 API 挂在 Clash API 根前缀；生命周期操作经 mutex 串行。

---

## 4. `apps/desktop` —— Electron

**工具链**：electron-vite 5（打 main/preload/renderer、dev HMR、`externalizeDepsPlugin`）+ electron-builder 26。Electron 经 catalog 锁 ~42.x。

### 布局与 UI 加载

- 桌面**不重新构建** Nuxt SPA。`packages/ui` 跑 `nuxt generate` → `.output/public`；CI 把它复制到 `apps/desktop/renderer/`。主进程经 `win.loadFile(renderer/index.html)` 走 `file://`（因 UI 是 CSR + `hashMode` + 相对 `baseURL`）。**桌面端无 localhost 静态服务。**
- **在桌面 renderer 副本里剥除/中和 PWA service worker** —— `sw.js` + workbox 在 `file://` 下会跨更新缓存陈旧 shell。

### 内核侧载打包

- mihomo 经 electron-builder **`extraResources`**（落在 `app.asar` 外、可 spawn）→ 运行时 `process.resourcesPath` 解析。
- **`${arch}` 在 `extraResources.from` 不生效。** CI 在打包**前**把对应架构二进制预置到**固定路径**（`apps/desktop/resources/mihomo[.exe]`）（经共享 `fetch-kernel.ts`，或 `beforeBuild`/`beforePack` 钩子按 `context.arch`）。`artifactName` 里用 `${arch}` 没问题。
- 按 `app.isPackaged` 分支取二进制路径：已打包 → `join(process.resourcesPath, 'mihomo'+ext)`；dev → `join(app.getAppPath(), 'resources', 'mihomo'+ext)`。**用户自定义内核路径始终优先。**
- darwin/linux 首次运行防御性 `chmodSync(path, 0o755)`（asar/zip 解压可能丢可执行位）。

### 数据目录

- 运行态（mihomo home、`profiles/*.yaml`、geo 缓存）放 `app.getPath('userData')` —— **绝不**放 `resources/`（只读、更新时被擦）。首次运行把 `extraResources` 里的默认 profile 复制进 userData（若缺）。

### UI ↔ 控制 API 接线

- 主进程生成每次启动的随机 `controlToken`，在 `127.0.0.1:<临时端口>` 起控制 API，spawn mihomo（agent 把生成的 `external-controller`+`secret` 写进激活 config），再经 **preload `contextBridge`**（`window.metacubexd`）把 `{controlApiBase, controlApiToken, clashApiUrl, clashSecret}` 交给 renderer。客户端 Nuxt 插件 seed endpoint Pinia store，用户无需填地址。

```ts
// apps/desktop/src/preload/index.ts
import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('metacubexd', {
  isDesktop: true,
  control: {
    base: process.env.MCXD_CONTROL_BASE,
    token: process.env.MCXD_CONTROL_TOKEN,
  },
  endpoint: {
    url: process.env.MCXD_CLASH_URL,
    secret: process.env.MCXD_CLASH_SECRET,
  },
})
```

```ts
// packages/ui/plugins/desktop-endpoint.client.ts
export default defineNuxtPlugin(() => {
  const w = window as any
  if (!w.metacubexd?.isDesktop) return
  const store = useEndpointStore()
  const { url, secret } = w.metacubexd.endpoint
  if (!url) return
  const id = 'local-mihomo'
  if (!store.endpointList.find((e) => e.id === id))
    store.addEndpoint({ id, url, secret, label: 'Local mihomo (desktop)' })
  if (!store.selectedEndpoint) store.setSelectedEndpoint(id)
})
```

> **桌面控制传输 —— 已定。** 用 `127.0.0.1` 绑定的 localhost HTTP + 每次启动 token —— 同一套基于 ky 的 UI 控制 API 客户端在桌面与服务端逐字复用。token + 仅环回绑定覆盖本地攻击面。

### 生命周期、托盘、单实例

- `app.requestSingleInstanceLock()` + `second-instance`；`Tray` + `Menu`；autostart 经 `app.setLoginItemSettings({ openAtLogin })`（均为 Electron 42 一等 API，无额外依赖）。
- spawn mihomo `detached:false`；在 `before-quit`/`will-quit` 及 agent stop 端点 kill；卡死关停时 SIGKILL —— 占住 9090 的孤儿内核是经典泄漏。

### 不签名 electron-builder 配置

```yaml
# apps/desktop/electron-builder.yml  （全目标不签名）
appId: one.metacubex.desktop
productName: MetaCubeXD
directories: { output: dist, buildResources: build }
files: [ 'out/**/*', 'package.json' ]
asar: true
asarUnpack: [ 'resources/**' ]      # 保持 mihomo 二进制可 spawn
extraResources:
  - { from: resources/mihomo${ext}, to: mihomo${ext} }   # CI 在此预置对应架构二进制
  - { from: resources/default-config.yaml, to: default-config.yaml }
mac:
  identity: null                    # 不签名：完全跳过 codesign
  hardenedRuntime: false            # 无 notarization 时不要开
  category: public.app-category.utilities
  target: [ dmg, zip ]              # zip 为未来自更新留门
  artifactName: ${productName}-${version}-mac-${arch}.${ext}
win:
  target: [ { target: nsis, arch: [x64, arm64] } ]
  artifactName: ${productName}-${version}-win-${arch}.${ext}
nsis: { oneClick: false, allowToChangeInstallationDirectory: true, perMachine: false }
linux:
  target: [ { target: AppImage, arch: [x64, arm64] }, { target: deb, arch: [x64, arm64] } ]
  category: Network
  artifactName: ${productName}-${version}-linux-${arch}.${ext}
```

**桌面坑：** `${arch}` 不能用在 `extraResources.from`（按架构预置）；让二进制可执行；`process.resourcesPath` 仅打包后存在；未签名 macOS 隔离（「应用已损坏」）→ 文档化 `xattr -dr com.apple.quarantine` / 右键打开，设 `identity:null` + `hardenedRuntime:false`，绝不 `gatekeeperAssess`；**TUN 需提权**，未签名应用无法附带特权 helper → 默认非 TUN（mixed-port），TUN 作高级项；绝不把控制 token 烤进静态 UI（经 bridge 每次启动注入）；验证 agent 依赖确实进了 `app.asar`（pnpm 软链 + asar 是利刃 —— 测打包后产物）；linux arm64 AppImage 可能需 `ubuntu-24.04-arm` runner。

---

## 5. `apps/server` —— 独立 Nitro + 多架构 Docker

构建为**独立 Nitro 应用**（`preset: 'node-server'`、自带 `nitro.config.ts`），**不是**对 UI 的第二次 Nuxt 构建。

> **为何独立（已核验）。** `packages/ui` 的发布构建是 `nuxt generate` → 纯静态；其 `.output/server` 是 preview stub，会**静默丢掉**任何 `server/api` 路由。与其逼 UI 改用 `nuxt build`，不如让 `apps/server` 作独立 Nitro 项目：(a) 托管 `packages/ui` 的静态产物，(b) 挂载 agent 控制 API，(c) 监督内置 mihomo。

### 路由挂载与静态托管

- agent handler 放 `apps/server/routes/control/*.ts` —— 薄 `defineEventHandler`，import `@metacubexd/agent` 上的 `supervisor` 单例。
- `middleware/auth.ts` 对 `/control/**` 做 token 守护（Bearer 或 SSE 用 `?token=`），静态 UI + `/control/health` 公开。
- 静态 UI 经 `publicAssets: [{ baseURL:'/', dir: UI_DIST, maxAge: 31536000 }]` + catch-all `routes/[...].ts` 返回 `index.html`（hash 路由几乎不会深链 404，仅作兜底）。

```ts
// apps/server/nitro.config.ts
import { defineConfig } from 'nitro'
import { fileURLToPath } from 'node:url'
const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))
export default defineConfig({
  preset: 'node-server',
  compatibilityDate: '2025-01-01',
  publicAssets: [{ baseURL: '/', dir: uiDist, maxAge: 60 * 60 * 24 * 365 }],
  // 故意不做 Clash-API 代理：nitro routeRules `proxy` 无法 upgrade WebSocket
  // （nitro #2886），而仪表盘走原生 WS。UI 把 endpoint 直接指向 mihomo 的
  // external-controller（9090）。
})
```

> **关键：** **绝不**通过 Nitro 代理 Clash API。Nitro `routeRules.proxy` 不转发 WS upgrade，会让流量/连接/日志/内存半残（HTTP 通、WS 死）。直接暴露 mihomo 的 `external-controller`；用户（或桌面 bridge）把 endpoint 指向 `http://<host>:9090`。

### Dockerfile（多阶段、多架构、按架构内核）

```dockerfile
# syntax=docker/dockerfile:1
# ---- Stage 1: 构建静态 UI（builder 原生架构）----
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/ui generate          # -> packages/ui/.output/public

# ---- Stage 2: 构建独立 Nitro 服务 + agent ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS server
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/server... build       # nitro -> apps/server/.output

# ---- Stage 3: 取目标架构 mihomo（普通 stage = 正确 TARGETARCH）----
FROM alpine:3.20 AS kernel
ARG TARGETARCH
ARG MIHOMO_VERSION=v1.19.27
RUN apk add --no-cache curl ca-certificates gzip
RUN set -eux; \
    if   [ "$TARGETARCH" = "amd64" ]; then ASSET=mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz; \
    elif [ "$TARGETARCH" = "arm64" ]; then ASSET=mihomo-linux-arm64-${MIHOMO_VERSION}.gz; \
    else echo "unsupported arch $TARGETARCH" >&2; exit 1; fi; \
    curl -fsSL "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${ASSET}" -o /tmp/k.gz; \
    gunzip -c /tmp/k.gz > /usr/local/bin/mihomo; chmod +x /usr/local/bin/mihomo; /usr/local/bin/mihomo -v

# ---- Stage 4: 精简运行时 ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache ca-certificates tzdata tini
WORKDIR /app
COPY --from=server  /repo/apps/server/.output ./
COPY --from=ui      /repo/packages/ui/.output/public ./ui-dist
COPY --from=kernel  /usr/local/bin/mihomo /usr/local/bin/mihomo
ENV NODE_ENV=production UI_DIST=/app/ui-dist MIHOMO_BIN=/usr/local/bin/mihomo \
    DATA_DIR=/data CONTROL_PORT=8080 CLASH_API_PORT=9090 MIXED_PORT=7890
VOLUME ["/data"]
EXPOSE 8080 9090 7890
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${CONTROL_PORT}/control/health" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]                      # PID 1 收割被 kill/重启的内核
CMD ["node", "/app/server/index.mjs"]
```

### 卷 / 环境变量 / compose

- **持久化**：单一命名卷挂 `/data`，存 `profiles/`、激活 config、mihomo 的 geo/fakeip 缓存（读写 —— 只读 homeDir 会让内核非零退出）。
- **环境变量**：`CONTROL_TOKEN`（agent 鉴权，也作 SSE 的 `?token=`）、`CLASH_SECRET`（内核 external-controller secret —— UI 里设为 endpoint secret）、`CONTROL_PORT`(8080)、`CLASH_API_PORT`(9090)、`MIXED_PORT`(7890)。
- agent **必须把 `external-controller: 0.0.0.0:9090` 注入激活 config**（默认 127.0.0.1，跨发布端口不可达）。

```yaml
# compose.yaml —— 默认仅代理；TUN 为高级覆盖
services:
  metacubexd:
    image: ghcr.io/metacubex/metacubexd-server:latest
    restart: unless-stopped
    environment:
      CONTROL_TOKEN: 'change-me-control'
      CLASH_SECRET: 'change-me-clash'
      CONTROL_PORT: '8080'
      CLASH_API_PORT: '9090'
      MIXED_PORT: '7890'
      TZ: 'Asia/Shanghai'
    ports:
      - '8080:8080' # 仪表盘 UI + /control agent API
      - '9090:9090' # mihomo Clash API + WS（UI endpoint 目标）
      - '7890:7890' # mixed 代理端口
    volumes: ['metacubexd-data:/data']
    # ---- TUN（高级）: cap_add: [NET_ADMIN]; devices: ["/dev/net/tun:/dev/net/tun"]; network_mode: host ----
volumes: { metacubexd-data: {} }
```

**服务端坑：** `nuxt generate` 丢 API 路由（故用独立 Nitro）；不代理 Clash API（WS upgrade）；用 `TARGETARCH` 而非 `uname -m`，且 `ARG TARGETARCH` 声明在最终/kernel stage **内部**；`.gz` 是**裸二进制不是 tarball**（`gunzip -c`，绝不 `tar`）；amd64 通用版在老/虚拟化 CPU 上 SIGILL → 用 `-compatible`；musl/Alpine + Go 二进制一般可用，遇 loader 错误回退 debian-slim；装 `ca-certificates`+`tzdata`；用 `tini` 当 PID 1 收割僵尸；pin `compatibilityDate`。

---

## 6. UI 变更

现有页面（overview、proxies、connections、rules、logs、config、traffic、setup）原样复用。新面由 `GET /api/control/info` **能力门控**：无 agent 应答时仪表盘行为与今天完全一致（纯远程面板）。

### 新增：内核控制 UI

- 一个控制条/面板（放 `overview` 和/或 `setup`），显示 `KernelState`（状态、版本、uptime、pid）+ Start/Stop/Restart 按钮，门控于 `features.includes('kernel-control')`。经桌面/服务端共用的 ky 客户端调 `/api/control/kernel/*`。
- 实时内核日志视图消费 SSE 流（`/api/control/kernel/logs`）—— 区别于现有 Clash `/logs` 面板。

### 新增：Profile 管理器 + Monaco/monaco-yaml 编辑器

**手动接线 Monaco + monaco-yaml**（**不用** `nuxt-monaco-editor`，它不暴露注册 YAML worker / 跑 `configureMonacoYaml` 的 API）。版本：`monaco-editor@^0.55.1`、`monaco-yaml@^5.5.1`，schema 取自 `meta-json-schema@^1.19.27`（MIT 社区 schema —— **无官方 mihomo schema**，这是「Meta JSON Schema」VS Code 扩展背后的事实标准）。schema **本地打包**（离线/隔离网/CSP 安全；绝不 `enableSchemaRequest`）。

**Worker 设置** —— Vite `?worker` 后缀 import + 手动 `self.MonacoEnvironment`（**只选一种**；与 `vite-plugin-monaco-editor` 混用会触发经典的 `Could not resolve .../editor.worker` 构建失败，且只在 `nuxt generate` 时出现）。只注册 `editor`/`json`/`yaml` worker，丢掉 ts/css/html。

```ts
// packages/ui/utils/monaco-setup.ts （仅从 client-only wrapper import）
import * as monaco from 'monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import YamlWorker from 'monaco-yaml/yaml.worker?worker'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
;(self as any).MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    if (label === 'yaml') return new YamlWorker()
    if (label === 'json') return new JsonWorker()
    return new EditorWorker()
  },
}
let configured = false
export function ensureMonacoYaml() {
  if (configured) return monaco
  configured = true
  configureMonacoYaml(monaco, {
    enableSchemaRequest: false,
    hover: true,
    completion: true,
    validate: true,
    format: true,
    schemas: [
      {
        uri: 'https://github.com/dongchengjie/meta-json-schema',
        fileMatch: ['**/config.yaml', 'inmemory://profile/*'], // 必须匹配 model URI
        schema: metaSchema as any,
      },
    ],
  })
  return monaco
}
```

**Client-only、懒加载 wrapper** —— `MonacoYamlEditor.client.vue`（`.client` 后缀，因 Nuxt 仍会在 prerender 期 evaluate setup，而 monaco 触碰 `self`/`Worker`）；`import('monaco-editor')` 放 `onMounted` 内，让 monaco 落进独立 async chunk，overview/proxies 等页不付 ~3-5MB。model 用 `monaco.editor.createModel(text, 'yaml', monaco.Uri.parse('inmemory://profile/config.yaml'))`（语言**必须** `'yaml'`、URI **必须**匹配 `fileMatch`，否则零校验）。页面用法：

```ts
// packages/ui/pages/config.vue（或新 profiles 页）—— async => 独立 chunk
const MonacoYamlEditor = defineAsyncComponent(
  () => import('~/components/MonacoYamlEditor.client.vue'),
)
// <ClientOnly><MonacoYamlEditor v-model="profileText" :read-only="!editing" /></ClientOnly>
```

**主题同步 daisyUI**：Monaco 有自己的主题系统（daisyUI CSS 变量不会级联进去）。读 `getComputedStyle(document.documentElement).colorScheme` → `vs`/`vs-dark`（daisyUI v5 按命名主题输出 `color-scheme`），watch `configStore.curTheme`，回退 `usePreferredDark()`。调 `monaco.editor.setTheme(...)`。

**Profile 管理器**驱动 `/api/control/profiles/*`：列表、create/duplicate/delete、import-from-URL（带 `subscriptionInfo` 用量卡）、在 Monaco 编辑、校验、激活（触发内核 reload）。schema 诊断视为参考 —— 绝不阻断保存；内核 reload 才是最终校验。**提供「关闭校验」开关**，应对前沿 mihomo 键。

**UI 坑：** 验证 rolldown-vite 在**生成**产物里确实输出三个 `?worker` chunk（测 `nuxt generate`，不只 `nuxt dev`；worker 404 = 静默失效的补全）；PWA workbox precache 可能超 `maximumFileSizeToCacheInBytes`（5MB）或被 monaco worker chunk 撑大 → `globIgnore` 掉它们；`configureMonacoYaml` 只调一次（模块级 guard）；`color-scheme` 仅在 mount 后读。

---

## 7. mihomo 内核获取 + CI/CD

### Pin + 资源映射

在一个 env 变量里 pin `MIHOMO_VERSION=v1.19.27`（当前最新稳定；**绝不**消费滚动的 `Prerelease-Alpha` tag），可覆盖；运行时自定义路径设置覆盖内置二进制。资源是 per-(os,arch) **裸单文件** `gz`（linux/darwin）或 `zip`（windows），命名 `mihomo-<os>-<arch>[-compatible]-<version>.{gz,zip}`。**amd64 全程用 `-compatible`（GOAMD64=v1）**（通用 amd64=GOAMD64=v3，在 2015 前/虚拟化 CPU 上 SIGILL）；arm64 单一构建。

```ts
// packages/agent/src/kernel/assets.ts —— 唯一来源
export const MIHOMO_VERSION = process.env.MIHOMO_VERSION ?? 'v1.19.27'
const OS_MAP = {
  linux: 'linux',
  darwin: 'darwin',
  win32: 'windows',
  windows: 'windows',
} as const
const ARCH_MAP = { x64: 'amd64', amd64: 'amd64', arm64: 'arm64' } as const
export function mihomoAsset(
  os: string,
  arch: string,
  version = MIHOMO_VERSION,
) {
  const o = OS_MAP[os],
    a = ARCH_MAP[arch]
  const ext = o === 'windows' ? 'zip' : 'gz'
  const variant = a === 'amd64' ? '-compatible' : ''
  const name = `mihomo-${o}-${a}${variant}-${version}.${ext}`
  return {
    name,
    url: `https://github.com/MetaCubeX/mihomo/releases/download/${version}/${name}`,
    ext,
    binName: o === 'windows' ? 'mihomo.exe' : 'mihomo',
  }
}
// linux/amd64 -> ...-amd64-compatible-...gz | linux/arm64 -> ...-arm64-...gz
// darwin/amd64-> ...-amd64-compatible-...gz | darwin/arm64-> ...-arm64-...gz
// windows/amd64-> ...-amd64-compatible-...zip| windows/arm64-> ...-arm64-...zip
```

### 下载器（CI + electron 钩子 + dev 复用）

`packages/agent/src/kernel/fetch-kernel.ts` 接 `(os, arch, destDir)`，拉资源，**gunzip 直出二进制**（`.gz` 是裸二进制非 tar —— `tar xzf` 会失败）或解 zip 定位 `.exe`，重命名，`chmod 0o755`。资源名锚定精确匹配（避开 `-go120/-go122/...` 的旧 Go 构建）。

### 扩展 `release.yml`（保留现有一切）

保留 release-please job + gh-pages + dist tarball + 现有多架构镜像 job 的 QEMU/buildx/login 接线 + 截图。新增两个 job，门控于 `needs.release-please.outputs.release_created`，版本取自 `outputs.tag_name`：

**(a) Docker 多架构** —— `docker/build-push-action` 指向 `apps/server/Dockerfile`，`platforms: linux/amd64,linux/arm64`（buildx 按平台设 `TARGETARCH`），`build-args: MIHOMO_VERSION=v1.19.27`，`cache-from/to: type=gha,mode=max`，tags `ghcr.io/metacubex/metacubexd-server:{latest,<tag>}`。

**(b) 不签名 electron 矩阵** —— 分开的 mac runner（`macos-14` arm64、`macos-13` x64）各出一个单架构侧载内核；`windows-latest` 与 `ubuntu-latest` 按预置二进制出两架构（linux arm64 AppImage 若交叉构建不稳则用 `ubuntu-24.04-arm`）。每行：`pnpm install` → `NUXT_APP_BASE_URL='./' pnpm --filter @metacubexd/ui generate` → 复制 `.output/public` 到 `apps/desktop/renderer` → 预置对应架构 mihomo（`fetch-kernel.ts` / `beforeBuild` 钩子）→ `electron-vite build` → `electron-builder <ebargs> -c.mac.identity=null --publish never`（`CSC_IDENTITY_AUTO_DISCOVERY=false`）→ 经 `softprops/action-gh-release@v3` 附件（**仅 files；不设 body/name**，避免并发矩阵 job 抢 release-please 的 notes）。

```yaml
# .github/workflows/release.yml —— 追加 job（现有 job 不动）
release-desktop:
  needs: release-please
  if: ${{ needs.release-please.outputs.release_created }}
  permissions: { contents: write }
  strategy:
    fail-fast: false
    matrix:
      include:
        - { os: macos-14,       ebargs: '--mac --arm64' }
        - { os: macos-13,       ebargs: '--mac --x64'   }
        - { os: windows-latest, ebargs: '--win --x64 --arm64'   }
        - { os: ubuntu-latest,  ebargs: '--linux --x64 --arm64' }
  runs-on: ${{ matrix.os }}
  env: { MIHOMO_VERSION: v1.19.27, CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
  steps:
    - uses: actions/checkout@v6
    - uses: pnpm/action-setup@v6
    - uses: actions/setup-node@v6
      with: { node-version: latest, cache: pnpm }
    - run: pnpm install
    - run: pnpm --filter @metacubexd/ui generate
      env: { NUXT_APP_BASE_URL: './' }
    - run: rm -rf apps/desktop/renderer && cp -r packages/ui/.output/public apps/desktop/renderer
      shell: bash
    - run: node apps/desktop/scripts/fetch-mihomo.mjs   # 预置对应架构侧载内核
    - run: pnpm --filter @metacubexd/desktop build
    - run: pnpm --filter @metacubexd/desktop exec electron-builder ${{ matrix.ebargs }} -c.mac.identity=null --publish never
      shell: bash
      env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
    - uses: softprops/action-gh-release@v3
      with:
        tag_name: ${{ needs.release-please.outputs.tag_name }}
        files: |
          apps/desktop/dist/*.dmg
          apps/desktop/dist/*.zip
          apps/desktop/dist/*.exe
          apps/desktop/dist/*.AppImage
          apps/desktop/dist/*.deb
```

> `electron-builder --publish never` 必须 —— 否则它会另建一个 draft release，与 release-please 持有的 tag 冲突。

**CI 坑：** `.gz` ≠ tarball；跳过 `-go1xx` 旧资源（锚定正则）；跳过 Alpha tag；macOS `CSC_IDENTITY_AUTO_DISCOVERY=false`，否则 builder 会抓到游离 keychain 证书 / 卡在 notarize；`--publish never`；矩阵 softprops 调用不设 `body`；按架构在构建内预置（单一硬编码架构下载会把 amd64 烤进 arm64 镜像）；上游无校验和 → pin 版本即完整性机制（可选硬编码预期 SHA256）。

---

## 8. README 部署文档大纲

1. **新增内容** —— 同一代码三种部署（托管仪表盘 / 桌面应用 / 一体化服务端）；纯仪表盘模式仍可对任意远程 mihomo 工作。
2. **托管仪表盘（不变）** —— gh-pages URL + 指向现有 mihomo `{url, secret}`。
3. **桌面应用** —— 按 OS 下载安装包；**不签名构建说明**：macOS `xattr -dr com.apple.quarantine /Applications/MetaCubeXD.app` 或右键→打开；Windows SmartScreen「更多信息→仍要运行」；Linux `chmod +x *.AppImage` / `dpkg -i *.deb`。注：自带内核、自动配置本地 endpoint；**TUN/系统代理是高级项、未签名下可能需提权**。
4. **一体化 Docker 服务端** —— `compose.yaml`、env 表（`CONTROL_TOKEN`、`CLASH_SECRET`、端口）、卷 `/data`、如何把 UI endpoint 指向 `http://<host>:9090` 配 `CLASH_SECRET`；**TUN 覆盖**（host 网络 + `NET_ADMIN` + `/dev/net/tun`）。
5. **Profile 与配置编辑器** —— 多 profile CRUD、订阅导入、Monaco YAML 校验、应用/reload。
6. **自定义内核路径** —— 设置里覆盖内置 mihomo。
7. **从源码构建 / monorepo 开发** —— `pnpm install`、`pnpm dev`（UI）、`pnpm build:server`、`pnpm build:desktop`。
8. **排障** —— 内核起不来（9090 占用、隔离属性、amd64 SIGILL→`-compatible`）、日志（SSE 内核日志 vs Clash `/logs`）、只读数据目录。

---

## 9. 风险与坑（汇总）

- **rolldown-vite vs electron-vite/electron-builder** —— 仓库已跑在 `npm:rolldown-vite@latest`；桌面工具链未针对其验证。_缓解_：根留 rolldown，必要时仅为 `apps/desktop` 单独 pin 真 `vite`。
- **agent 源码打包** —— 必须验证 agent 运行时依赖（`tree-kill`、`yaml` 等）在 pnpm 软链 store 下确实进了 `app.asar`；测**打包后**产物，不只 dev。
- **`?worker` chunk + rolldown + PWA precache** —— 在 `nuxt generate` 产物上验证；workbox `globIgnore` 掉 monaco worker chunk。
- **全部不签名** —— mac/win/linux 安装包及内置 mihomo 均未签名；quarantine/Gatekeeper/SmartScreen 体验须文档化；未签名无法附带特权 helper（TUN）。
- **WebSocket 传输边界** —— 绝不通过 Nitro 代理 Clash API；agent 日志仅 SSE。
- **amd64 SIGILL** —— 统一 `-compatible`。
- **overrides 即 CVE pin** —— 必须抬到根，否则安全 pin 静默失效。

---

## 10. 实现顺序（每步独立可验证）

每步单独 commit，让 lockfile/结构 diff 可审查。

1. **结构性 monorepo 迁移（行为不变）。** 给 `pnpm-workspace.yaml` 加 `packages:` globs；`git mv` 应用进 `packages/ui`；依赖转 `catalog:`；**所有 overrides 合并到根**（解决 vite 冲突→rolldown）；拆 `prepare`/`postinstall`。一个 commit、**零版本升级**。_验证_：`pnpm install`（lockfile diff 最小）、`pnpm --filter @metacubexd/ui dev` 与 `generate` 均通；unit/e2e 测试过。

2. **`packages/agent` 核心（无传输）。** 实现 `MihomoSupervisor`（spawn/stop/restart/validate、mutex、就绪轮询、tree-kill）+ `ProfileStore` + `kernel/assets.ts` + `fetch-kernel.ts`。_验证_：小脚本下载 mihomo、启动、轮询 `/version`、干净停止；asset 映射与 profile CRUD 的单测。

3. **控制路由 + 能力 info。** 实现 `createControlRouter`（h3）+ SSE 日志流 + `/info` + 鉴权。_验证_：挂在临时 h3 server；curl 每个路由；SSE 流出内核日志；`/info` 形状正确。

4. **`apps/server`（独立 Nitro）。** 接静态 UI 托管、`routes/control/**`、鉴权中间件、supervisor 单例、SPA 兜底。_验证_：`pnpm --filter @metacubexd/server... build`，本地跑，加载仪表盘，经控制 UI 起内核，endpoint 指 `:9090`。

5. **服务端 Dockerfile + 多架构 + compose。** 多阶段构建、按 `TARGETARCH` 内核、tini PID 1、卷、healthcheck。_验证_：`docker buildx build --platform linux/amd64,linux/arm64`；跑 amd64 容器，healthcheck 绿，仪表盘 + 内核 + 代理均可用。

6. **`apps/desktop`（Electron）。** electron-vite main/preload、`extraResources` 侧载、userData 引导、contextBridge 交接、单实例/托盘/生命周期。UI 插件 seed endpoint store。_验证_：`electron-vite dev` 加载 UI、自动连本地起的内核、Start/Stop/Restart 可用、退出无孤儿内核。

7. **不签名 electron-builder 打包。** `electron-builder.yml`、按架构预置、`--publish never`。_验证_：`electron-builder --dir` 再在单一 OS 出完整安装包；安装、启动、内核运行（mac 上 quarantine 剥除后）。

8. **UI：内核控制 + profile 管理器 + Monaco 编辑器。** 经 `/info` 能力门控；内核面板 + SSE 日志视图；profile CRUD UI；手动 Monaco + monaco-yaml wrapper（worker、schema、主题同步、懒 chunk、关闭校验开关）。_验证_：对 `nuxt generate` 产物（不只 dev）—— YAML 补全/校验在线，monaco 独立 chunk，其他页不受影响；`/info` 404 时纯远程模式仍工作。

9. **CI/CD 扩展。** 给 `release.yml` 加 Docker 多架构 job + 不签名 electron 矩阵；保留 release-please/gh-pages/tarball/截图。_验证_：dry-run tag 产出含全部安装包的 GH release + 多架构 GHCR 镜像；gh-pages 不变。

10. **README + 文档 + 收尾。** 部署文档（§8）、排障、自定义内核路径、TUN 说明。_验证_：新用户仅凭 README 即可部署每种模式。
