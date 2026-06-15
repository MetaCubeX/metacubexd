# metacubexd 桌面端窗口自定义标题栏 — 设计 spec(待用户过目)

> 状态:**设计已批准**(用户在 brainstorming 中确认两个关键分叉)。本文聚焦架构决策,不含实现代码。批准本 spec 后写实现计划、TDD 实现。
> 关联:[[2026-06-14-monorepo-desktop-server-design]](Electron 桌面外壳 + 同源 control server 渲染 Nuxt)。

## 1. 目标与范围

给 Electron 桌面窗口加一条**全宽自定义标题栏**,替换原生标题栏:与应用主题一致、可拖拽、承载品牌 Logo,并在 Windows/Linux 上自绘窗口控制按钮。覆盖 macOS / Windows / Linux。

**不含**(YAGNI):顶栏不放页面标题/流量指示/主题语言切换器;不做窗口置顶;不做自定义 resize 边框(`frame:false` 下 Electron 仍保留系统 resize);不引入 `titleBarOverlay`。

## 2. 现状(已核实)

- **窗口**:`apps/desktop/src/main/index.ts` 的 `createWindow()` 用**默认原生标题栏**——未设 `titleBarStyle`、未 `frame:false`。
- **preload**:`apps/desktop/src/preload/index.ts` 仅通过 `contextBridge` 暴露静态对象 `window.metacubexd`(`isDesktop`/`control`/`endpoint`),**无任何 IPC 方法**。
- **渲染外壳**:`packages/ui` 共用(Web + 桌面同一套)。`app.vue → layouts/default.vue → components/Sidebar.vue`。桌面端(lg+)**无顶部栏**——只有左侧全高 Sidebar(顶部带 `LogoText`)+ 内容区。Sidebar 内的 `<header>` 是 `lg:hidden` 的移动端专用栏。
- **桌面检测**:`window.metacubexd?.isDesktop`(UI 中尚无 composable 包装它;`desktop-endpoint.client.ts` 插件只用 `.endpoint`)。

## 3. 已确认的两个关键决策

### 3.1 窗口控制策略 → **平台原生混合**

- **macOS**:`titleBarStyle:'hidden'`,**保留原生红绿灯**(关/最小/最大化),不自绘按钮;加可拖拽主题条。
- **Windows/Linux**:`frame:false`,**自绘**主题化的 最小化/最大化-还原/关闭 三按钮,经 IPC 驱动。

理由:各平台最地道(mac 用户期待红绿灯),且整条栏完全跟随应用主题。

### 3.2 布局 → **全宽 32px 细顶栏**

标题栏横跨整个窗口顶部(在 Sidebar + 内容之上);`LogoText` 移到顶栏左侧,Sidebar 在桌面模式隐藏自身 Logo(成为纯导航)。Web 模式不变,Logo 照旧在 Sidebar。

## 4. 总体数据流

```
主进程 BrowserWindow (无原生边框 / mac hidden)
   │  ipcMain.handle('window:minimize' | 'window:toggle-maximize' | 'window:close' | 'window:is-maximized')
   │  win.on('maximize'/'unmaximize') → webContents.send('window:maximize-changed', isMaximized)
   ▼
preload (contextBridge)
   │  window.metacubexd.platform = 'darwin' | 'win32' | 'linux'
   │  window.metacubexd.window   = { minimize, toggleMaximize, close, isMaximized, onMaximizeChange }
   ▼
渲染层  useDesktop() → { isDesktop, platform, isMac, windowControls }
   └─ TitleBar.vue(仅桌面渲染)+ Sidebar 桌面隐藏自身 Logo
```

## 5. 主进程改动(`apps/desktop/src/main/`)

- **`index.ts createWindow()`** 按平台加窗口选项:
  - macOS:`titleBarStyle:'hidden'` + `trafficLightPosition:{ x:12, y:9 }`(把红绿灯垂直居中到 32px 栏)。
  - Windows/Linux:`frame:false`。
  - 创建窗口后挂 `win.on('maximize'|'unmaximize')` → `win.webContents.send('window:maximize-changed', win.isMaximized())`,供按钮图标切换。
- **新模块 `window-controls.ts`**(沿用现有 `tray.ts`/`hotkeys.ts` 的依赖注入 + 可单测模式):
  - `registerWindowControls({ ipcMain, getWindow })` 注册四个 `ipcMain.handle` 通道:
    - `window:minimize` → `win.minimize()`
    - `window:toggle-maximize` → `win.isMaximized() ? win.unmaximize() : win.maximize()`,**返回新的 `isMaximized()`**
    - `window:close` → `win.close()`
    - `window:is-maximized` → `win.isMaximized()`
  - 每个 handler 先 `getWindow()`,窗口不存在则安全 no-op / 返回 false。
- **`index.ts` app.whenReady** 内调用一次 `registerWindowControls({ ipcMain, getWindow: () => win })`。

## 6. preload 桥接(`apps/desktop/src/preload/index.ts`)

- 引入 `ipcRenderer`,在现有 `metacubexd` 对象上追加:
  - `platform: process.platform`
  - `window`:
    - `minimize()` → `ipcRenderer.invoke('window:minimize')`
    - `toggleMaximize()` → `ipcRenderer.invoke('window:toggle-maximize')`
    - `close()` → `ipcRenderer.invoke('window:close')`
    - `isMaximized()` → `ipcRenderer.invoke('window:is-maximized')`
    - `onMaximizeChange(cb)` → 包装 `ipcRenderer.on('window:maximize-changed', (_e, v) => cb(v))`,**返回取消订阅函数** `() => ipcRenderer.removeListener(...)`
- 仍走 `contextBridge`(不放开 contextIsolation),只暴露包装函数,不暴露裸 `ipcRenderer`。

## 7. 渲染层(`packages/ui/`,Web + 桌面双模式安全)

- **新 composable `composables/useDesktop.ts`**:读 `window.metacubexd`,返回 `{ isDesktop, platform, isMac, windowControls }`。SSR / Web 下 `window.metacubexd` 不存在 → `isDesktop=false`、`windowControls` 为安全空壳。
- **新组件 `components/TitleBar.vue`**:
  - 32px 高、`-webkit-app-region: drag`、`bg-base-200/95 backdrop-blur` + 底边框(与现有 chrome 风格一致)、`z` 高于内容。
  - 左侧 `LogoText`;macOS 左内边距 ~72px 给红绿灯让位,Windows/Linux 无内边距。
  - 右侧**仅 Windows/Linux**:三个按钮(`-webkit-app-region: no-drag`),tabler 图标 `IconMinus` / `IconSquare`↔`IconCopy`(最大化↔还原) / `IconX`,关闭按钮 hover 红色;最大化态由 `windowControls.onMaximizeChange` 驱动图标切换(组件 onMounted 订阅、onUnmounted 取消)。
  - Windows/Linux 拖拽区 `@dblclick` → `windowControls.toggleMaximize()`(补上 `frame:false` 缺失的双击最大化)。
- **`layouts/default.vue`**:根 div 改 `flex flex-col`;顶部 `<TitleBar v-if="isDesktop" />`(shrink-0),其下 `flex-1 min-h-0` 包住 `<Sidebar>`。固定/绝对定位的背景层、`ConnectionErrorBanner`、`ProtectedResources`、`GlobalTrafficIndicator` 保持同级。
- **`components/Sidebar.vue`**:桌面模式下隐藏抽屉里的 `LogoText`(以及移动端 header 的 Logo),避免与顶栏重复。**Web 模式不变**。

## 8. 平台差异一览

|                      | macOS                                 | Windows / Linux     |
| -------------------- | ------------------------------------- | ------------------- |
| 窗口选项             | `titleBarStyle:'hidden'` + 红绿灯定位 | `frame:false`       |
| 关 / 最小 / 最大按钮 | 系统红绿灯(不自绘)                    | 自绘三按钮 + IPC    |
| 顶栏左内边距         | ~72px 让位红绿灯                      | 0                   |
| 双击最大化           | 系统自带                              | 自己监听 `dblclick` |

## 9. 测试计划(严格 TDD,沿用各包现有套路)

- **desktop**(`src/main/__tests__/window-controls.spec.ts`):假 `ipcMain`(记录 `handle` 回调)+ 假 window(各方法 spy)。断言:每个通道调用对应 window 方法;`toggle-maximize` 按 `isMaximized()` 在 maximize/unmaximize 间切换并返回新值;`getWindow()` 返回 null 时安全 no-op / 返回 false。
- **ui**:
  - `composables/__tests__/useDesktop.spec.ts`:有 `window.metacubexd`(各平台)→ `isDesktop=true`、`platform`、`isMac` 判定;无 → `isDesktop=false`、`windowControls` 空壳可安全调用。
  - `components/__tests__/TitleBar.spec.ts`:mac → 无自绘按钮、有红绿灯让位内边距类、有 Logo;win → 有三按钮,点击分别调 `windowControls.minimize/toggleMaximize/close`;`onMaximizeChange(true)` 后最大化按钮切到"还原"图标。
- **preload**:极薄、现有亦无测试,保持一致不单测。
- 全包门禁须保持绿:agent 199 / desktop(现 227,+window-controls)/ server 13 / ui(现 467,+useDesktop+TitleBar)。

## 10. 受影响文件

**新增**:`apps/desktop/src/main/window-controls.ts`、`packages/ui/composables/useDesktop.ts`、`packages/ui/components/TitleBar.vue`,以及三个 `.spec`。

**改动**:`apps/desktop/src/main/index.ts`(createWindow + whenReady)、`apps/desktop/src/preload/index.ts`、`packages/ui/layouts/default.vue`、`packages/ui/components/Sidebar.vue`。

## 11. 风险与注意

- **共用 UI 双模式**:`TitleBar`/Logo 隐藏必须以 `isDesktop` 门控,Web 构建零行为变化。
- **窄窗口边缘情形**:桌面窄窗(< lg)会同时出现顶栏与移动端 header;顶栏在上、可接受。桌面模式下移动端 header 的 Logo 一并隐藏以免重复。
- **mac 红绿灯遮挡**:32px 栏 + `trafficLightPosition` 居中,Logo 左内边距让位,确保不重叠。
- **最大化态同步**:依赖主进程 `maximize`/`unmaximize` 事件转发,避免 UI 与真实窗口态脱节。
