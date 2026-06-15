import type {
  KernelManager,
  SystemProxyController,
} from '@metacubexd/agent/types'
import type { Tray } from 'electron'
import type { ControlServer } from './control-server'
import type { FsLike } from './paths'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { createAgent, createProfileScheduler } from '@metacubexd/agent'
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  nativeImage,
  Notification,
} from 'electron'
import { buildAppMenu } from './app-menu'
import { resolveMihomoBinary } from './binary-path'
import { resolveBootPorts } from './boot-ports'
import { runShutdownCleanup } from './cleanup'
import { startControlServer, stopControlServer } from './control-server'
import { parseSubscriptionDeepLink } from './deep-link'
import { pickFreePorts } from './free-port'
import { loadHotkeyBindings, registerHotkeys } from './hotkeys'
import { createKernelManager } from './kernel-manager'
import { createKernelCrashWatcher, createNotifier } from './notifier'
import { bootstrapDataDir } from './paths'
import { makeToken } from './secrets'
import { shouldStartHidden } from './startup'
import { createSystemProxyController } from './sysproxy'
import { readSysProxyBypass } from './sysproxy-config'
import { createTray, trayIconPath } from './tray'
import {
  DEFAULT_WINDOW_BOUNDS,
  loadWindowState,
  saveWindowState,
} from './window-state'

// Real fs adapter for bootstrapDataDir (recursive mkdir is idempotent).
const fsAdapter: FsLike = {
  existsSync,
  mkdirSync: (p) => void mkdirSync(p, { recursive: true }),
  readFileSync: (p) => readFileSync(p, 'utf8'),
  writeFileSync: (p, data) => writeFileSync(p, data, 'utf8'),
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let agent: ReturnType<typeof createAgent> | null = null
let controlServer: ControlServer | null = null
// Subscription auto-update scheduler; created + started in boot() with an
// onResult callback that notifies success/failure. Stopped on shutdown.
let profileScheduler: ReturnType<typeof createProfileScheduler> | null = null
// OS system-proxy controller, configured in boot() for the managed mixed port.
// Kept module-level so the quit/cleanup path can disable() it (anti-lockout).
let systemProxy: SystemProxyController | null = null
// Same-origin renderer URL (the control server serves the dashboard too); set
// in boot() and loaded by createWindow().
let rendererUrl: string | null = null

function defaultConfigSource(): string {
  // packaged -> process.resourcesPath/default-config.yaml ; dev -> repo resources
  return app.isPackaged
    ? join(process.resourcesPath, 'default-config.yaml')
    : join(app.getAppPath(), 'resources', 'default-config.yaml')
}

/**
 * App icon for `electron-vite dev`. Packaged builds embed the icon via
 * electron-builder (build/icon.icns|ico|png) so the OS shows it on the dock /
 * task bar automatically — in dev there is no bundle, so without this Electron
 * falls back to its default atom icon. Returns null when packaged or missing.
 */
function devAppIcon(): Electron.NativeImage | null {
  if (app.isPackaged) return null
  const img = nativeImage.createFromPath(
    join(app.getAppPath(), 'build', 'icon.png'),
  )
  return img.isEmpty() ? null : img
}

async function boot(): Promise<void> {
  const userData = app.getPath('userData')
  const paths = bootstrapDataDir(userData, defaultConfigSource(), fsAdapter)

  // Resolve mihomo binary (user override read from a settings file if present).
  const overridePath = join(userData, 'mihomo-bin-override.txt')
  const userOverride = existsSync(overridePath)
    ? readFileSync(overridePath, 'utf8').trim()
    : undefined
  const binaryPath = resolveMihomoBinary({
    platform: process.platform,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    userOverride,
  })
  // chmod +x defensively on unix (asar/zip extraction may drop the bit).
  if (process.platform !== 'win32' && existsSync(binaryPath)) {
    try {
      chmodSync(binaryPath, 0o755)
    } catch {
      /* best-effort; agent also chmods on first spawn */
    }
  }

  // Pick three distinct free loopback ports: control server, Clash API, and the
  // kernel's managed mixed proxy (prereq for Wave 2 system-proxy wiring).
  const { controlPort, clashPort, mixedPort } = resolveBootPorts(
    await pickFreePorts(3),
  )
  const controlToken = makeToken()
  const clashSecret = makeToken()

  // System proxy points at the managed mixed (http+socks) port. The default
  // bypass list is read from userData/sysproxy.json, falling back to the safe
  // defaults, and applied whenever enable() is called without an explicit list.
  // Module-level so the quit path can disable() it (anti-lockout).
  const defaultBypass = readSysProxyBypass(
    join(userData, 'sysproxy.json'),
    fsAdapter,
  )
  const baseSystemProxy = createSystemProxyController({
    host: '127.0.0.1',
    port: mixedPort,
  })
  systemProxy = {
    ...baseSystemProxy,
    enable: (bypass) =>
      baseSystemProxy.enable(
        bypass && bypass.length > 0 ? bypass : defaultBypass,
      ),
  }

  // Kernel version management needs the supervisor that createAgent builds
  // internally — chicken-and-egg. We hand createAgent a stable delegate (truthy
  // so the 'kernel-version' feature + routes register) and back it with the real
  // KernelManager once the agent (and its supervisor) exists. createAgent returns
  // synchronously and no /api/control request fires before boot() completes, so
  // realKernelManager is always set by request time.
  let realKernelManager: KernelManager | null = null
  const kernelManager: KernelManager = {
    listVersions: () => {
      if (!realKernelManager) throw new Error('kernel manager not ready')
      return realKernelManager.listVersions()
    },
    switch: (version) => {
      if (!realKernelManager) throw new Error('kernel manager not ready')
      return realKernelManager.switch(version)
    },
  }

  agent = createAgent({
    binaryPath,
    homeDir: paths.homeDir,
    activeConfigPath: paths.activeConfigPath,
    profilesDir: paths.profilesDir,
    // In-process (Electron) binding skips auth — but we still pass the token
    // so the loopback HTTP face requires it for any external caller.
    agentToken: controlToken,
    // Hand the pre-picked clash endpoint + secret to the supervisor. The
    // supervisor writes external-controller/secret into the active config
    // before spawn (Plan 02 C2 config injection) so the kernel binds exactly
    // these — state.externalController/state.secret echo them back.
    externalController: `127.0.0.1:${clashPort}`,
    secret: clashSecret,
    // Managed mixed (http+socks) proxy port; the supervisor injects this as
    // `mixed-port:` into the active YAML before spawn.
    mixedPort,
    // Inject the OS proxy controller; enables the capability-gated
    // /api/control/sysproxy routes + the 'system-proxy' feature flag.
    systemProxy,
    // Inject the kernel version manager (delegate); enables the capability-gated
    // /api/control/kernel/* routes + the 'kernel-version' feature flag.
    kernelManager,
  })

  // Now that the supervisor exists, build the real manager. Downloaded kernels
  // land in <userData>/kernels/<version>; switching writes the override file
  // (overridePath) for cold-start persistence then live-swaps the supervisor.
  realKernelManager = createKernelManager({
    supervisor: agent.supervisor,
    os: process.platform,
    arch: process.arch,
    kernelsDir: join(userData, 'kernels'),
    overridePath,
  })

  // Surface a desktop notification when the kernel crashes. The watcher de-dupes
  // a sustained errored state so a single crash notifies once (it re-arms after
  // a recovery). Subscribed before start() so we never miss the first event.
  const crashWatcher = createKernelCrashWatcher(notify)
  agent.supervisor.on('state', crashWatcher)

  // Drive subscription auto-update against the agent's profile store, surfacing
  // each refresh outcome as a notification. createAgent builds its own scheduler
  // (without onResult) but never starts it; the desktop owns the ticking here.
  profileScheduler = createProfileScheduler({
    profiles: agent.profiles,
    onResult: (r) => {
      if (r.ok) notify('Subscription updated', `${r.id} refreshed.`)
      else notify('Subscription update failed', r.error ?? r.id)
    },
  })
  profileScheduler.start()

  // The control server also serves the renderer (same origin as /api/control)
  // from the dir where copy:renderer / electron-builder stage the nuxt output.
  const rendererDir = join(__dirname, '..', '..', 'renderer')
  controlServer = await startControlServer(
    agent.router,
    controlPort,
    rendererDir,
  )
  rendererUrl = `http://127.0.0.1:${controlPort}/`

  // Start the kernel; capture the bound external-controller + secret.
  const state = await agent.supervisor.start()

  // Inject the renderer bridge env (consumed by preload/index.ts).
  process.env.MCXD_CONTROL_BASE = `http://127.0.0.1:${controlPort}/api/control`
  process.env.MCXD_CONTROL_TOKEN = controlToken
  process.env.MCXD_CLASH_URL = `http://${state.externalController}`
  process.env.MCXD_CLASH_SECRET = state.secret
  // Loopback proxy port for Wave 2 system-proxy wiring.
  process.env.MCXD_MIXED_PORT = String(mixedPort)
}

// Path to the persisted main-window geometry under userData.
function windowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

// Debounce the write-on-resize/move so a drag doesn't fan out to hundreds of
// disk writes; the close handler flushes synchronously regardless.
let saveWindowTimer: ReturnType<typeof setTimeout> | null = null

function persistWindowBounds(immediate = false): void {
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  const write = (): void =>
    saveWindowState(fsAdapter, windowStatePath(), bounds)
  if (immediate) {
    if (saveWindowTimer) {
      clearTimeout(saveWindowTimer)
      saveWindowTimer = null
    }
    write()
    return
  }
  if (saveWindowTimer) clearTimeout(saveWindowTimer)
  saveWindowTimer = setTimeout(() => {
    saveWindowTimer = null
    write()
  }, 300)
}

function createWindow(startHidden = false): void {
  const devIcon = devAppIcon()
  // Restore the persisted geometry (sanitized) so the window reopens where the
  // user left it; first run / corrupt state falls back to the default size.
  const bounds = loadWindowState(
    fsAdapter,
    windowStatePath(),
    DEFAULT_WINDOW_BOUNDS,
  )
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
  // On a hidden (login-launch) start, keep the window off-screen — the kernel
  // still boots and the tray can summon it later. A normal launch shows it once
  // the renderer is ready.
  if (!startHidden) win.once('ready-to-show', () => win?.show())
  // Persist the geometry as the user resizes/moves; flush on close so the final
  // position is saved even if the debounce timer hadn't fired yet.
  win.on('resize', () => persistWindowBounds())
  win.on('move', () => persistWindowBounds())
  win.on('close', () => persistWindowBounds(true))
  // Load over http from the same-origin control server (NOT file://) so web
  // workers (Monaco) and same-origin /api/control fetch/SSE work. boot() always
  // runs before createWindow(), so rendererUrl is set.
  void win.loadURL(rendererUrl ?? 'about:blank')
}

async function shutdownKernel(): Promise<void> {
  // Halt subscription auto-update ticking so no refresh fires mid-shutdown.
  profileScheduler?.stop()
  // Anti-lockout: release the OS system proxy BEFORE the kernel goes away so we
  // never leave the machine pointing at a dead loopback port. All steps are
  // best-effort (see runShutdownCleanup).
  await runShutdownCleanup({
    systemProxy: systemProxy ?? undefined,
    stopKernel: () => agent?.supervisor.stop() ?? Promise.resolve(),
    stopControlServer: () =>
      controlServer ? stopControlServer(controlServer) : Promise.resolve(),
  })
}

function focusWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

// Global-hotkey window toggle: hide when visible, otherwise summon + focus.
function toggleWindowVisibility(): void {
  if (!win) return
  if (win.isVisible() && !win.isMinimized()) {
    win.hide()
  } else {
    focusWindow()
  }
}

// Global-hotkey system-proxy toggle: read the live OS state, then flip it.
// Best-effort — surfaces failures as a notification rather than swallowing.
async function toggleSystemProxy(): Promise<void> {
  if (!systemProxy) return
  try {
    if (await systemProxy.isEnabled()) {
      await systemProxy.disable()
    } else {
      await systemProxy.enable()
    }
  } catch (err) {
    notify('System proxy toggle failed', err)
  }
}

const PROXY_MODE_CYCLE = ['rule', 'global', 'direct'] as const
type ProxyModeName = (typeof PROXY_MODE_CYCLE)[number]

// Global-hotkey proxy-mode cycle: GET the current mode from the Clash API, then
// PATCH the next one in rule -> global -> direct -> rule. Best-effort; failures
// surface as a notification.
async function cycleProxyMode(): Promise<void> {
  const url = process.env.MCXD_CLASH_URL
  const secret = process.env.MCXD_CLASH_SECRET
  if (!url) return
  const auth = secret ? { Authorization: `Bearer ${secret}` } : {}
  try {
    const res = await fetch(`${url}/configs`, { headers: auth })
    if (!res.ok) return
    const cfg = (await res.json()) as { mode?: string }
    const current = cfg.mode?.toLowerCase() as ProxyModeName | undefined
    const idx = current ? PROXY_MODE_CYCLE.indexOf(current) : -1
    const next = PROXY_MODE_CYCLE[(idx + 1) % PROXY_MODE_CYCLE.length]
    await fetch(`${url}/configs`, {
      method: 'PATCH',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    })
  } catch (err) {
    notify('Proxy mode switch failed', err)
  }
}

// Wraps the Electron Notification constructor (dependency-injected in
// notifier.ts so the crash/subscription notifications stay unit-testable).
const notifier = createNotifier({ Notification })

// Show a desktop notification when supported (no-op headless/CI).
function notify(title: string, body: unknown): void {
  if (!Notification.isSupported()) return
  notifier.notify(title, body instanceof Error ? body.message : String(body))
}

// A deep link can arrive before boot() finishes (e.g. cold launch via the OS
// handing us the URL in argv). Hold the most recent one until the agent exists,
// then flush it.
let pendingDeepLink: { url: string; name?: string } | null = null

// Import a subscription from a deep link, make it active, restart the kernel,
// then surface the window + a notification. Queues if the agent isn't ready.
async function handleSubscriptionDeepLink(link: {
  url: string
  name?: string
}): Promise<void> {
  if (!agent) {
    pendingDeepLink = link
    return
  }
  try {
    const meta = await agent.profiles.importFromUrl(link.url, link.name)
    await agent.profiles.setActive(meta.id)
    await agent.supervisor.restart()
    focusWindow()
    notify('Subscription imported', `${meta.name} is now active.`)
  } catch (err) {
    notify('Subscription import failed', err)
  }
}

// Scan an argv list (Windows/Linux deliver deep links as a process argument)
// for the first recognized subscription link and handle it.
function handleDeepLinkFromArgv(argv: readonly string[]): void {
  for (const arg of argv) {
    const link = parseSubscriptionDeepLink(arg)
    if (link) {
      void handleSubscriptionDeepLink(link)
      return
    }
  }
}

// Register the custom URL schemes so the OS routes clash:// / clashmeta://
// links to this app (deep-link subscription import).
app.setAsDefaultProtocolClient('clash')
app.setAsDefaultProtocolClient('clashmeta')

// macOS delivers deep links via open-url (not argv) — both at cold launch and
// while running. boot() may not have finished yet; handleSubscriptionDeepLink
// queues until the agent exists.
app.on('open-url', (event, url) => {
  event.preventDefault()
  const link = parseSubscriptionDeepLink(url)
  if (link) void handleSubscriptionDeepLink(link)
})

// Single-instance lock: focus the existing window on a second launch.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Windows/Linux deliver a deep link in the second launch's argv.
    handleDeepLinkFromArgv(argv)
    focusWindow()
  })

  app.whenReady().then(async () => {
    // Show the real icon on the macOS dock in dev (packaged builds get it from
    // the .app bundle's icns).
    const devIcon = devAppIcon()
    if (devIcon && process.platform === 'darwin') app.dock?.setIcon(devIcon)
    await boot()
    // Silent start: a login-launch (--hidden arg or OS wasOpenedAtLogin) boots
    // the kernel but keeps the window hidden until summoned from the tray.
    const startHidden = shouldStartHidden(
      process.argv,
      app.getLoginItemSettings(),
    )
    createWindow(startHidden)
    tray = createTray({
      getWindow: () => win,
      startKernel: () => void agent?.supervisor.start(),
      stopKernel: () => void agent?.supervisor.stop(),
      quit: () => app.quit(),
      iconPath: trayIconPath(),
      // boot() (runs above) sets these from the bound kernel state; fall back
      // to empty strings so createTray never sees undefined.
      clash: {
        url: process.env.MCXD_CLASH_URL ?? '',
        secret: process.env.MCXD_CLASH_SECRET ?? '',
      },
      // boot() builds the OS proxy controller (anti-lockout disable() on quit
      // lives in shutdownKernel). Passing it renders the tray "System proxy"
      // checkbox; enable() applies the default bypass list (see boot()).
      ...(systemProxy ? { systemProxy } : {}),
    })
    // Native application menu. Without it the OS never wires the standard
    // Cmd/Ctrl+C / V / A accelerators, so copy/paste silently fail in inputs
    // and the Monaco editor. The Edit submenu's roles fix that; macOS also gets
    // the app/Window menus. Custom items reuse the focus/supervisor helpers.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        buildAppMenu({
          platform: process.platform,
          actions: {
            showWindow: () => focusWindow(),
            startKernel: () => void agent?.supervisor.start(),
            stopKernel: () => void agent?.supervisor.stop(),
          },
        }),
      ),
    )

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // Register the global hotkeys (overridable via <userData>/hotkeys.json).
    // toggleSystemProxy/cycleProxyMode are async; the action signature is void
    // so we fire-and-forget here (each notifies on failure).
    registerHotkeys({
      globalShortcut,
      bindings: loadHotkeyBindings(
        join(app.getPath('userData'), 'hotkeys.json'),
        fsAdapter,
      ),
      actions: {
        toggleSystemProxy: () => void toggleSystemProxy(),
        cycleProxyMode: () => void cycleProxyMode(),
        toggleWindow: () => toggleWindowVisibility(),
      },
    })

    // Flush a deep link that arrived (and was queued) before the agent existed.
    if (pendingDeepLink) {
      const link = pendingDeepLink
      pendingDeepLink = null
      void handleSubscriptionDeepLink(link)
    }
    // Windows/Linux: a cold launch via a deep link puts the URL in process.argv.
    handleDeepLinkFromArgv(process.argv)
  })

  // Kill the kernel before quitting — orphaned kernel holding the clash port
  // is the classic leak (spec §4).
  let cleanedUp = false
  app.on('before-quit', (event) => {
    if (cleanedUp) return
    event.preventDefault()
    cleanedUp = true
    void shutdownKernel().finally(() => {
      tray?.destroy()
      app.quit()
    })
  })

  // Release the OS-level global shortcuts on the final quit so they don't leak
  // past the process (Electron also clears them, but be explicit).
  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })

  app.on('window-all-closed', () => {
    // Keep running in tray on all platforms (kernel stays supervised);
    // quit only via tray/menu.
  })
}
