# 桌面端窗口自定义标题栏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Electron 桌面窗口加一条全宽 32px 自定义标题栏,替换原生标题栏:主题一致、可拖拽、左侧 Logo,Windows/Linux 自绘窗口控制按钮(经 IPC),macOS 保留原生红绿灯。

**Architecture:** 主进程按平台设窗口选项(mac `titleBarStyle:'hidden'`,win/linux `frame:false`)并通过新模块 `window-controls.ts` 注册 IPC 控制通道;preload 把 `platform` 和 `window` 控制方法挂到现有 `window.metacubexd` 桥;渲染层用两个可测 composable(`useDesktop` / `useWindowControls`)+ 薄展示组件 `TitleBar.vue`,挂在 `layouts/default.vue` 顶部,桌面模式下隐藏 Sidebar 自身 Logo。Web 构建零行为变化。

**Tech Stack:** Electron 42(`BrowserWindow` / `ipcMain` / `ipcRenderer` / `contextBridge`)、electron-vite(ESM main + preload bundle)、Vue 3 `<script setup>` + Nuxt 4 自动导入、@tabler/icons-vue、Tailwind v4 / daisyui、Vitest(jsdom,**无 @vue/test-utils** → 逻辑放 composable 单测,组件不单测)。

**测试基线(全程保持绿):** agent 199 / desktop 227(本计划 +window-controls)/ server 13 / ui 467(本计划 +useDesktop +useWindowControls)。

**提交策略说明:** 各任务末尾的 `commit` 步骤为标准 TDD 节奏。但本仓库用户的既定约束是「只在明确要求时才 commit」。执行时:**若用户未授权提交,跳过每个 commit 步骤,把改动累积在工作树**,在计划全部完成后统一询问是否提交。**绝不 push 到 origin。**

**仓库根:** `/Users/shikun/Developer/opensource/metacubexd`。下方命令凡含 `cd` 均相对仓库根。

---

### Task 1: 主进程 `window-controls.ts`(IPC 控制通道,依赖注入 + 可单测)

**Files:**

- Create: `apps/desktop/src/main/window-controls.ts`
- Test: `apps/desktop/src/main/__tests__/window-controls.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/desktop/src/main/__tests__/window-controls.spec.ts`:

```ts
import type { BrowserWindow } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { registerWindowControls } from '../window-controls'

// Fake ipcMain: records each handle(channel, handler) so a test can invoke a
// channel's handler directly and assert what it did to the window.
function fakeIpcMain() {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      },
    ),
    /** Invoke a registered channel's handler (event arg is irrelevant here). */
    invoke: (channel: string, ...args: unknown[]) =>
      handlers.get(channel)?.({} as unknown, ...args),
    handlers,
  }
}

// Fake BrowserWindow: only the methods window-controls touches. A mutable
// `maximized` flag lets maximize/unmaximize flip state like the real window.
function fakeWindow(initialMaximized = false) {
  let maximized = initialMaximized
  return {
    minimize: vi.fn(),
    maximize: vi.fn(() => {
      maximized = true
    }),
    unmaximize: vi.fn(() => {
      maximized = false
    }),
    isMaximized: vi.fn(() => maximized),
    close: vi.fn(),
  }
}

describe('registerWindowControls', () => {
  it('registers the four window-control channels', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({
      ipcMain,
      getWindow: () => fakeWindow() as unknown as BrowserWindow,
    })

    expect([...ipcMain.handlers.keys()].sort()).toEqual(
      [
        'window:close',
        'window:is-maximized',
        'window:minimize',
        'window:toggle-maximize',
      ].sort(),
    )
  })

  it('window:minimize minimizes the window', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow()
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    ipcMain.invoke('window:minimize')

    expect(win.minimize).toHaveBeenCalledTimes(1)
  })

  it('window:close closes the window', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow()
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    ipcMain.invoke('window:close')

    expect(win.close).toHaveBeenCalledTimes(1)
  })

  it('window:toggle-maximize maximizes when not maximized and returns true', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow(false)
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    const result = ipcMain.invoke('window:toggle-maximize')

    expect(win.maximize).toHaveBeenCalledTimes(1)
    expect(win.unmaximize).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('window:toggle-maximize restores when maximized and returns false', () => {
    const ipcMain = fakeIpcMain()
    const win = fakeWindow(true)
    registerWindowControls({
      ipcMain,
      getWindow: () => win as unknown as BrowserWindow,
    })

    const result = ipcMain.invoke('window:toggle-maximize')

    expect(win.unmaximize).toHaveBeenCalledTimes(1)
    expect(win.maximize).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('window:is-maximized reflects the window state', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({
      ipcMain,
      getWindow: () => fakeWindow(true) as unknown as BrowserWindow,
    })

    expect(ipcMain.invoke('window:is-maximized')).toBe(true)
  })

  it('is a safe no-op when there is no window', () => {
    const ipcMain = fakeIpcMain()
    registerWindowControls({ ipcMain, getWindow: () => null })

    expect(() => ipcMain.invoke('window:minimize')).not.toThrow()
    expect(() => ipcMain.invoke('window:close')).not.toThrow()
    expect(ipcMain.invoke('window:toggle-maximize')).toBe(false)
    expect(ipcMain.invoke('window:is-maximized')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/desktop && pnpm exec vitest run src/main/__tests__/window-controls.spec.ts`
Expected: FAIL —— `Failed to resolve import "../window-controls"` / `registerWindowControls is not a function`.

- [ ] **Step 3: 写最小实现**

Create `apps/desktop/src/main/window-controls.ts`:

```ts
import type { BrowserWindow, IpcMain } from 'electron'

export interface WindowControlsDeps {
  /** Only `handle` is used; narrowed so tests can pass a fake. */
  ipcMain: Pick<IpcMain, 'handle'>
  /** Current main window (null when none); read lazily per call. */
  getWindow: () => BrowserWindow | null
}

/**
 * Register the IPC channels the custom title bar (Windows/Linux) drives:
 * minimize, toggle maximize/restore, close, and a maximized-state query. macOS
 * keeps its native traffic lights so it never invokes these, but registering
 * unconditionally is harmless. Every handler is a safe no-op when the window is
 * gone (returns false where a boolean is expected) so a late call can't throw.
 * Call ONCE (e.g. in app.whenReady) — ipcMain.handle throws on a duplicate
 * channel; the per-window maximize-event forwarding lives in createWindow.
 */
export function registerWindowControls({
  ipcMain,
  getWindow,
}: WindowControlsDeps): void {
  ipcMain.handle('window:minimize', () => {
    getWindow()?.minimize()
  })

  ipcMain.handle('window:toggle-maximize', () => {
    const win = getWindow()
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle('window:close', () => {
    getWindow()?.close()
  })

  ipcMain.handle(
    'window:is-maximized',
    () => getWindow()?.isMaximized() ?? false,
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/desktop && pnpm exec vitest run src/main/__tests__/window-controls.spec.ts`
Expected: PASS (7 passed).

- [ ] **Step 5: 类型检查**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无错误。

- [ ] **Step 6: Commit**(若未获授权则跳过,累积工作树)

```bash
git add apps/desktop/src/main/window-controls.ts apps/desktop/src/main/__tests__/window-controls.spec.ts
git commit -m "feat(desktop): add window-controls ipc module for custom title bar"
```

---

### Task 2: 主进程 `index.ts` —— 接入无边框窗口选项 + 最大化事件转发 + 注册控制通道

**Files:**

- Modify: `apps/desktop/src/main/index.ts`(import 区、`createWindow()`、`app.whenReady` 内)

> 说明:`index.ts` 是 boot 入口,沿用现有约定不做单元测试;以类型检查 + electron-vite 构建 + 既有 desktop 测试套件保持绿来验证。

- [ ] **Step 1: 加 import**

在 `apps/desktop/src/main/index.ts` 顶部 import 区,把 electron 解构里加上 `ipcMain`。当前(约 23-30 行):

```ts
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  Notification,
} from 'electron'
```

改为:

```ts
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
} from 'electron'
```

并在 `import { createTray, trayIconPath } from './tray'`(约 50 行)下一行加:

```ts
import { registerWindowControls } from './window-controls'
```

- [ ] **Step 2: 在 `createWindow()` 里加无边框窗口选项 + 最大化事件转发**

在 `createWindow()` 内,`win = new BrowserWindow({ ... })` 调用之前,先算平台选项。找到(约 574 行起):

```ts
win = new BrowserWindow({
  width: bounds.width,
  height: bounds.height,
  // Only pass x/y when both survived sanitization — otherwise let Electron
  // center the window on the primary display.
  ...(bounds.x !== undefined && bounds.y !== undefined
    ? { x: bounds.x, y: bounds.y }
    : {}),
  show: false,
  // Window icon for the Windows/Linux task bar in dev (macOS ignores it and
  // uses the dock icon set in whenReady). Packaged builds use the bundle icon.
  ...(devIcon ? { icon: devIcon } : {}),
  webPreferences: {
    preload: join(__dirname, '..', 'preload', 'index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  },
})
```

替换为(新增 `titleBarOptions` 常量并展开进构造参数):

```ts
// Custom title bar (see TitleBar.vue): macOS hides the title bar but keeps
// the native traffic lights (positioned to center in the 32px renderer bar);
// Windows/Linux go fully frameless and the renderer self-draws min/max/close.
const titleBarOptions: Electron.BrowserWindowConstructorOptions =
  process.platform === 'darwin'
    ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 12, y: 9 } }
    : { frame: false }

win = new BrowserWindow({
  width: bounds.width,
  height: bounds.height,
  // Only pass x/y when both survived sanitization — otherwise let Electron
  // center the window on the primary display.
  ...(bounds.x !== undefined && bounds.y !== undefined
    ? { x: bounds.x, y: bounds.y }
    : {}),
  show: false,
  ...titleBarOptions,
  // Window icon for the Windows/Linux task bar in dev (macOS ignores it and
  // uses the dock icon set in whenReady). Packaged builds use the bundle icon.
  ...(devIcon ? { icon: devIcon } : {}),
  webPreferences: {
    preload: join(__dirname, '..', 'preload', 'index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  },
})

// Keep the renderer's maximize/restore button in sync with the real window
// state: forward every native maximize/unmaximize to the title bar. (macOS
// never renders that button but the events are harmless there.)
const sendMaximizeState = () =>
  win?.webContents.send('window:maximize-changed', win.isMaximized())
win.on('maximize', sendMaximizeState)
win.on('unmaximize', sendMaximizeState)
```

- [ ] **Step 3: 在 `app.whenReady` 里注册控制通道**

在 `app.whenReady().then(async () => { ... })` 内,`createWindow(startHidden)`(约 777 行)之后、`tray = createTray({ ... })` 之前,插入:

```ts
// Register the window-control IPC channels ONCE (the title bar on
// Windows/Linux drives minimize/maximize/close through them). getWindow is
// lazy so a later createWindow() (macOS reopen) is picked up automatically.
registerWindowControls({ ipcMain, getWindow: () => win })
```

- [ ] **Step 4: 类型检查**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无错误。

- [ ] **Step 5: electron-vite 构建(验证 main 打包正常)**

Run: `cd apps/desktop && pnpm build`
Expected: 构建成功,`out/main/index.js` 生成,无报错。

- [ ] **Step 6: 跑 desktop 全量测试**

Run: `cd apps/desktop && pnpm test`
Expected: 全绿(228 起,含 Task 1 的 7 个新用例)。

- [ ] **Step 7: Commit**(若未获授权则跳过)

```bash
git add apps/desktop/src/main/index.ts
git commit -m "feat(desktop): frameless window + wire window-control ipc and maximize sync"
```

---

### Task 3: preload —— 暴露 `platform` 与 `window` 控制桥

**Files:**

- Modify: `apps/desktop/src/preload/index.ts`

> 说明:preload 极薄,仓库现有亦无 preload 单测,保持一致不单测;以类型检查 + electron-vite 构建验证。

- [ ] **Step 1: 改写 preload**

把 `apps/desktop/src/preload/index.ts` 整体替换为:

```ts
import { contextBridge, ipcRenderer } from 'electron'

// Shared contract (spec §4): the renderer bridge shape consumed by
// packages/ui/plugins/desktop-endpoint.client.ts + composables/useControlApi.ts
// + composables/useDesktop.ts.
//   window.metacubexd = {
//     isDesktop: true,
//     platform: 'darwin' | 'win32' | 'linux',
//     control:  { base, token },
//     endpoint: { url, secret },
//     window:   { minimize, toggleMaximize, close, isMaximized, onMaximizeChange },
//   }
// Endpoint/control values arrive via env vars the main process sets on this
// preload's process; the window methods proxy to the main-process IPC channels
// registered by window-controls.ts.
contextBridge.exposeInMainWorld('metacubexd', {
  isDesktop: true,
  platform: process.platform,
  control: {
    base: process.env.MCXD_CONTROL_BASE,
    token: process.env.MCXD_CONTROL_TOKEN,
  },
  endpoint: {
    url: process.env.MCXD_CLASH_URL,
    secret: process.env.MCXD_CLASH_SECRET,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    // Subscribe to native maximize/unmaximize; returns an unsubscribe fn.
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      const handler = (_event: unknown, maximized: boolean) => cb(maximized)
      ipcRenderer.on('window:maximize-changed', handler)
      return () =>
        ipcRenderer.removeListener('window:maximize-changed', handler)
    },
  },
})
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/desktop && pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: electron-vite 构建(验证 preload 打包正常)**

Run: `cd apps/desktop && pnpm build`
Expected: 构建成功,`out/preload/index.js` 生成,无报错。

- [ ] **Step 4: Commit**(若未获授权则跳过)

```bash
git add apps/desktop/src/preload/index.ts
git commit -m "feat(desktop): expose platform + window controls on the preload bridge"
```

---

### Task 4: UI `useDesktop` composable(可测)

**Files:**

- Create: `packages/ui/composables/useDesktop.ts`
- Test: `packages/ui/composables/__tests__/useDesktop.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/ui/composables/__tests__/useDesktop.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDesktop } from '../useDesktop'

// Install a fake desktop bridge on window.metacubexd for the duration of a test.
function setBridge(bridge: unknown) {
  ;(window as unknown as { metacubexd?: unknown }).metacubexd = bridge
}

afterEach(() => {
  delete (window as unknown as { metacubexd?: unknown }).metacubexd
})

describe('composables/useDesktop', () => {
  it('reports web mode when no bridge is present', () => {
    const { isDesktop, platform, isMac } = useDesktop()

    expect(isDesktop).toBe(false)
    expect(platform).toBeNull()
    expect(isMac).toBe(false)
  })

  it('provides safe no-op window controls in web mode', async () => {
    const { windowControls } = useDesktop()

    expect(() => windowControls.minimize()).not.toThrow()
    expect(() => windowControls.toggleMaximize()).not.toThrow()
    expect(() => windowControls.close()).not.toThrow()
    await expect(windowControls.isMaximized()).resolves.toBe(false)
    // onMaximizeChange returns an unsubscribe fn that is safe to call.
    const off = windowControls.onMaximizeChange(() => {})
    expect(() => off()).not.toThrow()
  })

  it('reports desktop + macOS from the bridge', () => {
    setBridge({ isDesktop: true, platform: 'darwin', window: {} })
    const { isDesktop, platform, isMac } = useDesktop()

    expect(isDesktop).toBe(true)
    expect(platform).toBe('darwin')
    expect(isMac).toBe(true)
  })

  it('reports desktop + non-macOS for win32', () => {
    setBridge({ isDesktop: true, platform: 'win32', window: {} })
    const { isMac } = useDesktop()

    expect(isMac).toBe(false)
  })

  it('passes the bridge window methods through', () => {
    const minimize = vi.fn()
    setBridge({ isDesktop: true, platform: 'win32', window: { minimize } })

    useDesktop().windowControls.minimize()

    expect(minimize).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/ui && pnpm exec vitest run composables/__tests__/useDesktop.spec.ts`
Expected: FAIL —— `Failed to resolve import "../useDesktop"`。

- [ ] **Step 3: 写最小实现**

Create `packages/ui/composables/useDesktop.ts`:

```ts
// packages/ui/composables/useDesktop.ts

// Window-control surface exposed by the desktop preload bridge. On the web (no
// bridge) callers get safe no-ops, so the title bar never has to branch on
// "is there a bridge" — only on platform.
export interface DesktopWindowControls {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  /** Subscribe to native maximize/unmaximize; returns an unsubscribe fn. */
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void
}

interface MetacubexdBridge {
  isDesktop?: boolean
  platform?: string
  window?: Partial<DesktopWindowControls>
}

const NOOP_CONTROLS: DesktopWindowControls = {
  minimize: () => {},
  toggleMaximize: () => {},
  close: () => {},
  isMaximized: () => Promise.resolve(false),
  onMaximizeChange: () => () => {},
}

/**
 * Detect the Electron desktop shell and expose its window-control bridge. Reads
 * the static `window.metacubexd` object the preload injects (see
 * apps/desktop/src/preload/index.ts). SSR / web build: no bridge → isDesktop
 * false and no-op controls. Any missing bridge method falls back to a no-op so
 * an older/partial preload can't throw at the call site.
 */
export function useDesktop() {
  const bridge =
    typeof window !== 'undefined'
      ? (window as unknown as { metacubexd?: MetacubexdBridge }).metacubexd
      : undefined

  const isDesktop = bridge?.isDesktop === true
  const platform = bridge?.platform ?? null
  const isMac = platform === 'darwin'

  const windowControls: DesktopWindowControls = {
    ...NOOP_CONTROLS,
    ...(bridge?.window ?? {}),
  }

  return { isDesktop, platform, isMac, windowControls }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/ui && pnpm exec vitest run composables/__tests__/useDesktop.spec.ts`
Expected: PASS (5 passed)。

- [ ] **Step 5: Commit**(若未获授权则跳过)

```bash
git add packages/ui/composables/useDesktop.ts packages/ui/composables/__tests__/useDesktop.spec.ts
git commit -m "feat(ui): add useDesktop composable for the desktop window bridge"
```

---

### Task 5: UI `useWindowControls` composable(响应式最大化态 + 句柄,可测)

**Files:**

- Create: `packages/ui/composables/useWindowControls.ts`
- Test: `packages/ui/composables/__tests__/useWindowControls.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `packages/ui/composables/__tests__/useWindowControls.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useWindowControls } from '../useWindowControls'

// A controllable fake of the preload window bridge: spies for the imperative
// methods, plus a captured onMaximizeChange callback the test can fire, and a
// spy unsubscribe so we can assert teardown.
function installBridge(initialMaximized = false) {
  let cb: ((maximized: boolean) => void) | null = null
  const off = vi.fn()
  const windowApi = {
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => Promise.resolve(initialMaximized)),
    onMaximizeChange: vi.fn((fn: (m: boolean) => void) => {
      cb = fn
      return off
    }),
  }
  ;(window as unknown as { metacubexd?: unknown }).metacubexd = {
    isDesktop: true,
    platform: 'win32',
    window: windowApi,
  }
  return {
    windowApi,
    off,
    /** Simulate a native maximize/unmaximize event reaching the renderer. */
    fire: (m: boolean) => cb?.(m),
  }
}

afterEach(() => {
  delete (window as unknown as { metacubexd?: unknown }).metacubexd
})

describe('composables/useWindowControls', () => {
  it('seeds isMaximized from the bridge', async () => {
    installBridge(true)
    const { isMaximized } = useWindowControls()

    // Seeding is async (isMaximized() resolves a promise).
    expect(isMaximized.value).toBe(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(isMaximized.value).toBe(true)
  })

  it('updates isMaximized when the window maximize state changes', () => {
    const bridge = installBridge(false)
    const { isMaximized } = useWindowControls()

    bridge.fire(true)
    expect(isMaximized.value).toBe(true)

    bridge.fire(false)
    expect(isMaximized.value).toBe(false)
  })

  it('delegates minimize/toggleMaximize/close to the bridge', () => {
    const bridge = installBridge()
    const { minimize, toggleMaximize, close } = useWindowControls()

    minimize()
    toggleMaximize()
    close()

    expect(bridge.windowApi.minimize).toHaveBeenCalledTimes(1)
    expect(bridge.windowApi.toggleMaximize).toHaveBeenCalledTimes(1)
    expect(bridge.windowApi.close).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes from maximize changes when the scope is disposed', () => {
    const bridge = installBridge()
    const scope = effectScope()
    scope.run(() => {
      useWindowControls()
    })

    expect(bridge.off).not.toHaveBeenCalled()
    scope.stop()
    expect(bridge.off).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd packages/ui && pnpm exec vitest run composables/__tests__/useWindowControls.spec.ts`
Expected: FAIL —— `Failed to resolve import "../useWindowControls"`。

- [ ] **Step 3: 写最小实现**

Create `packages/ui/composables/useWindowControls.ts`:

```ts
// packages/ui/composables/useWindowControls.ts
import { getCurrentScope, onScopeDispose } from 'vue'
import { useDesktop } from './useDesktop'

/**
 * Reactive window-control state for the custom title bar. Seeds the maximized
 * flag from the live window (it may reopen already maximized), then keeps it in
 * sync via the main-process maximize/unmaximize events. Uses onScopeDispose (not
 * onUnmounted) so the subscription tears down in any effect scope — including
 * unit tests — exactly like useBackendWebSocket does.
 */
export function useWindowControls() {
  const { windowControls } = useDesktop()
  const isMaximized = ref(false)

  // Seed from the live window state; best-effort (default false is safe).
  void Promise.resolve(windowControls.isMaximized())
    .then((v) => {
      isMaximized.value = v
    })
    .catch(() => {})

  // Stay in sync with the real window; unsubscribe when the scope disposes.
  const off = windowControls.onMaximizeChange((v) => {
    isMaximized.value = v
  })
  if (getCurrentScope()) onScopeDispose(off)

  return {
    isMaximized,
    minimize: () => windowControls.minimize(),
    toggleMaximize: () => windowControls.toggleMaximize(),
    close: () => windowControls.close(),
  }
}
```

> 注:`ref` 由 `test/setup.ts` 全局 stub 提供(Nuxt 自动导入模拟),实现里无需 import `ref`,与 `useWebSocket.ts` 等现有 composable 一致。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd packages/ui && pnpm exec vitest run composables/__tests__/useWindowControls.spec.ts`
Expected: PASS (4 passed)。

- [ ] **Step 5: Commit**(若未获授权则跳过)

```bash
git add packages/ui/composables/useWindowControls.ts packages/ui/composables/__tests__/useWindowControls.spec.ts
git commit -m "feat(ui): add useWindowControls composable for reactive maximize state"
```

---

### Task 6: UI `TitleBar.vue`(薄展示组件,不单测)

**Files:**

- Create: `packages/ui/components/TitleBar.vue`

> 说明:本仓库组件无单测基建(无 @vue/test-utils),组件保持薄、逻辑已在 Task 4/5 的 composable 内测过。以类型检查 + `generate:desktop` 构建验证。

- [ ] **Step 1: 写组件**

Create `packages/ui/components/TitleBar.vue`:

```vue
<script setup lang="ts">
import { IconCopy, IconMinus, IconSquare, IconX } from '@tabler/icons-vue'
import { useDesktop } from '~/composables/useDesktop'
import { useWindowControls } from '~/composables/useWindowControls'

// macOS keeps native traffic lights (no self-drawn buttons); Windows/Linux draw
// their own min/max/close. Parent (default.vue) only renders this in desktop
// mode, so isDesktop is implied here.
const { isMac } = useDesktop()
const { isMaximized, minimize, toggleMaximize, close } = useWindowControls()
</script>

<template>
  <!-- 32px draggable bar. dblclick toggles maximize on Win/Linux (frameless has
       no native double-click-to-maximize); macOS handles it natively. -->
  <div
    class="flex h-8 shrink-0 items-center border-b border-[color-mix(in_oklch,var(--color-base-content)_10%,transparent)] bg-[color-mix(in_oklch,var(--color-base-200)_95%,transparent)] backdrop-blur-[12px]"
    style="-webkit-app-region: drag"
    @dblclick="!isMac && toggleMaximize()"
  >
    <!-- Brand (left). macOS pads ~72px to clear the native traffic lights. -->
    <div class="flex items-center" :class="isMac ? 'pl-[72px]' : 'pl-3'">
      <LogoText />
    </div>

    <div class="flex-1" />

    <!-- Window controls — Windows/Linux only. -->
    <div
      v-if="!isMac"
      class="flex h-full items-center"
      style="-webkit-app-region: no-drag"
    >
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-[color-mix(in_oklch,var(--color-base-content)_8%,transparent)] hover:text-base-content"
        aria-label="minimize"
        @click="minimize"
      >
        <IconMinus class="h-4 w-4" />
      </button>
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-[color-mix(in_oklch,var(--color-base-content)_8%,transparent)] hover:text-base-content"
        :aria-label="isMaximized ? 'restore' : 'maximize'"
        @click="toggleMaximize"
      >
        <IconCopy v-if="isMaximized" class="h-4 w-4" />
        <IconSquare v-else class="h-4 w-4" />
      </button>
      <button
        class="flex h-full w-12 items-center justify-center text-base-content/70 transition-colors hover:bg-error hover:text-error-content"
        aria-label="close"
        @click="close"
      >
        <IconX class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
```

> `LogoText` 是 Nuxt 自动导入组件(无需 import),与 Sidebar.vue 用法一致。

- [ ] **Step 2: 类型检查**

Run: `cd packages/ui && pnpm typecheck`
Expected: 无错误。

- [ ] **Step 3: Commit**(若未获授权则跳过)

```bash
git add packages/ui/components/TitleBar.vue
git commit -m "feat(ui): add TitleBar component for the custom desktop window chrome"
```

---

### Task 7: UI 接入 —— `default.vue` 顶部挂 TitleBar + `Sidebar.vue` 桌面隐藏 Logo

**Files:**

- Modify: `packages/ui/layouts/default.vue`(`<script setup>` + `<template>` 根结构)
- Modify: `packages/ui/components/Sidebar.vue`(`<script setup>` + 两处 Logo)

> 说明:布局/组件改动,以类型检查 + `generate:desktop` 构建验证(无组件单测)。

- [ ] **Step 1: `default.vue` 引入 useDesktop**

在 `packages/ui/layouts/default.vue` 的 `<script setup>` 里,现有 store 声明区(约 5-7 行)之后加:

```ts
const { isDesktop } = useDesktop()
```

(`useDesktop` 为 Nuxt 自动导入 composable,无需显式 import,与文件内其它 `useXStore`/`useAppearance` 用法一致。)

- [ ] **Step 2: `default.vue` 改根结构,顶部插 TitleBar**

把模板根 `<div ref="rootElement" ...>` 的 class 由:

```
class="relative h-screen overscroll-y-none antialiased"
```

改为(加 `flex flex-col`):

```
class="relative flex h-screen flex-col overscroll-y-none antialiased"
```

然后把现有的:

```html
<Sidebar>
  <slot />
</Sidebar>
```

替换为(顶部加 TitleBar,Sidebar 包进 flex-1 容器以占据剩余高度):

```html
<!-- Custom desktop title bar (desktop shell only; web build skips it). -->
<TitleBar v-if="isDesktop" />

<!-- Sidebar + page content fill the height below the title bar. -->
<div class="relative flex min-h-0 flex-1 flex-col">
  <Sidebar>
    <slot />
  </Sidebar>
</div>
```

(背景层 `<template v-if="appearance.hasBackground...">`、`ConnectionErrorBanner`、`ProtectedResources`、`GlobalTrafficIndicator`、`ShortcutsHelpModal` 全部保持原位、原顺序不动 —— 它们是 fixed/absolute 或全局组件,不受 flex 列影响。)

- [ ] **Step 3: `Sidebar.vue` 引入 useDesktop**

在 `packages/ui/components/Sidebar.vue` 的 `<script setup>` 里,`const { hasFeature } = useControlInfo()`(约 27 行)下一行加:

```ts
const { isDesktop } = useDesktop()
```

- [ ] **Step 4: `Sidebar.vue` 桌面隐藏移动端 header 的 Logo**

找到移动端 header 里的(约 172-175 行):

```html
<!-- Logo -->
<div class="min-w-0 shrink">
  <LogoText />
</div>
```

改为(桌面模式不渲染,避免与顶栏 Logo 重复):

```html
<!-- Logo (hidden in the desktop shell — the title bar owns branding) -->
<div v-if="!isDesktop" class="min-w-0 shrink">
  <LogoText />
</div>
```

- [ ] **Step 5: `Sidebar.vue` 桌面隐藏抽屉头部的 Logo 行**

找到抽屉 sidebar header 里的 Logo 行(约 217-227 行):

```html
<!-- Logo row -->
<div
  class="flex items-center lg:min-h-7"
  :class="configStore.sidebarExpanded ? '' : 'lg:justify-center'"
>
  <LogoText v-show="configStore.sidebarExpanded" class="hidden lg:block" />
  <LogoText class="block lg:hidden" />
</div>
```

在最外层 div 上加 `v-if="!isDesktop"`:

```html
<!-- Logo row (hidden in the desktop shell — the title bar owns it) -->
<div
  v-if="!isDesktop"
  class="flex items-center lg:min-h-7"
  :class="configStore.sidebarExpanded ? '' : 'lg:justify-center'"
>
  <LogoText v-show="configStore.sidebarExpanded" class="hidden lg:block" />
  <LogoText class="block lg:hidden" />
</div>
```

- [ ] **Step 6: 类型检查**

Run: `cd packages/ui && pnpm typecheck`
Expected: 无错误。

- [ ] **Step 7: 跑 UI 全量单测(确认接入未破坏现有)**

Run: `cd packages/ui && pnpm test:unit`
Expected: 全绿(476 起:原 467 + Task4 的 5 + Task5 的 4)。

- [ ] **Step 8: Commit**(若未获授权则跳过)

```bash
git add packages/ui/layouts/default.vue packages/ui/components/Sidebar.vue
git commit -m "feat(ui): mount TitleBar in the desktop shell and relocate the logo to it"
```

---

### Task 8: 集成验证 —— 重新生成渲染产物 + 拷贝 + 全包门禁

**Files:** 无(仅构建/验证)

- [ ] **Step 1: 生成桌面渲染产物**

Run: `cd packages/ui && pnpm generate:desktop`
Expected: 构建成功,输出 `Generated public .output/public`,无报错(尤其无 i18n/编译错误)。

- [ ] **Step 2: 拷贝渲染产物进 desktop**

Run: `cd apps/desktop && pnpm copy:renderer`
Expected: `renderer updated: N files`。

- [ ] **Step 3: 全包测试门禁**

Run(在仓库根):

```bash
pnpm --filter @metacubexd/desktop test
pnpm --filter @metacubexd/ui test:unit
```

Expected:desktop 全绿(228 起);ui 全绿(476 起)。

- [ ] **Step 4: 全包类型检查**

Run(在仓库根):

```bash
pnpm --filter @metacubexd/desktop typecheck
pnpm --filter @metacubexd/ui typecheck
```

Expected:均无错误。

- [ ] **Step 5: 真机冒烟(交回用户)**

提示用户:重启 `pnpm dev:desktop`(非仅 Cmd+R —— 主进程窗口选项变化需重建窗口)。验证:

- macOS:无原生标题栏,红绿灯在 32px 主题条内居中,Logo 在条左侧,拖条可移动窗口,双击系统行为正常。
- Windows/Linux(如可测):无原生边框,右上自绘最小化/最大化/关闭,点击各自生效,最大化后图标切「还原」,拖条双击最大化/还原。
- Web 仪表盘:无标题栏、Logo 仍在 Sidebar,行为零变化。

- [ ] **Step 6: Commit**(若有未提交的构建产物 `apps/desktop/renderer`,且获授权)

```bash
git add apps/desktop/renderer
git commit -m "chore(desktop): regenerate renderer with custom title bar"
```

---

## Self-Review(写计划后对照 spec)

**Spec 覆盖核对:**

- §3.1 平台原生混合(mac hidden+红绿灯 / win+linux frameless+自绘) → Task 2(窗口选项)+ Task 1/3(IPC)+ Task 6(组件按 isMac 分支)。✅
- §3.2 全宽 32px 顶栏 + Logo 移顶栏 + Sidebar 桌面隐藏 Logo → Task 6 + Task 7。✅
- §4 数据流(ipcMain↔preload↔useDesktop↔TitleBar) → Task 1/3/4/5/6。✅
- §5 主进程(createWindow 选项 + maximize 转发 + whenReady 注册 + window-controls 模块) → Task 1/2。✅
- §6 preload(platform + window + onMaximizeChange 返回退订) → Task 3。✅
- §7 渲染层(useDesktop / TitleBar / default.vue 重构 / Sidebar 隐藏 Logo) → Task 4/6/7;§7 的「最大化态响应式 + 订阅生命周期」拆为 `useWindowControls`(Task 5)以便单测。✅(对 spec 的细化:组件无测试基建,逻辑下沉 composable。)
- §8 平台差异表 → Task 2(内边距/双击由 Task 6 实现)。✅
- §9 测试计划 → spec 原列 `TitleBar.spec.ts`;因仓库无组件测试基建(无 @vue/test-utils),改为 `useDesktop.spec.ts` + `useWindowControls.spec.ts` 覆盖等价逻辑(Task 4/5),`window-controls.spec.ts`(Task 1)。✅(已记录偏离理由。)
- §10 受影响文件 → 全部出现在各 Task 的 Files。✅
- §11 风险(双模式门控 / 窄窗重复 / mac 红绿灯遮挡 / 最大化态同步) → isDesktop 门控(Task 7)、移动端 header Logo 隐藏(Task 7 Step 4)、trafficLightPosition+pl-72(Task 2/6)、maximize 事件转发(Task 2 Step 2)。✅

**占位符扫描:** 无 TBD/TODO/「类似 Task N」/空 catch 未说明;每个代码步骤含完整代码。✅

**类型/命名一致性:** `registerWindowControls({ ipcMain, getWindow })`、IPC 通道名 `window:minimize|toggle-maximize|close|is-maximized` + 事件 `window:maximize-changed`、`DesktopWindowControls` 五方法(`minimize/toggleMaximize/close/isMaximized/onMaximizeChange`)在主进程/preload/composable/组件全程一致。✅
