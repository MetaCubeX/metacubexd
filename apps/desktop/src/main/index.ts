import type { SystemProxyController } from '@metacubexd/agent/types'
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
import { createAgent } from '@metacubexd/agent'
import { app, BrowserWindow, nativeImage, Notification } from 'electron'
import { resolveMihomoBinary } from './binary-path'
import { resolveBootPorts } from './boot-ports'
import { runShutdownCleanup } from './cleanup'
import { startControlServer, stopControlServer } from './control-server'
import { parseSubscriptionDeepLink } from './deep-link'
import { pickFreePorts } from './free-port'
import { bootstrapDataDir } from './paths'
import { makeToken } from './secrets'
import { shouldStartHidden } from './startup'
import { createSystemProxyController } from './sysproxy'
import { readSysProxyBypass } from './sysproxy-config'
import { createTray, trayIconPath } from './tray'

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
  })

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

function createWindow(startHidden = false): void {
  const devIcon = devAppIcon()
  win = new BrowserWindow({
    width: 1280,
    height: 800,
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
  // Load over http from the same-origin control server (NOT file://) so web
  // workers (Monaco) and same-origin /api/control fetch/SSE work. boot() always
  // runs before createWindow(), so rendererUrl is set.
  void win.loadURL(rendererUrl ?? 'about:blank')
}

async function shutdownKernel(): Promise<void> {
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
    if (Notification.isSupported()) {
      new Notification({
        title: 'Subscription imported',
        body: `${meta.name} is now active.`,
      }).show()
    }
  } catch (err) {
    if (Notification.isSupported()) {
      new Notification({
        title: 'Subscription import failed',
        body: err instanceof Error ? err.message : String(err),
      }).show()
    }
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
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

  app.on('window-all-closed', () => {
    // Keep running in tray on all platforms (kernel stays supervised);
    // quit only via tray/menu.
  })
}
