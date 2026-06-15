import type {
  KernelManager,
  SystemProxyController,
  TunController,
} from '@metacubexd/agent/types'
import type { Tray } from 'electron'
import type { ControlServer } from './control-server'
import type { HelperInstallOptions } from './helper/installer'
import type { HelperKernelStartOptions } from './helper/server'
import type { FsLike } from './paths'
import { exec as nodeExec } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createAgent, createProfileScheduler } from '@metacubexd/agent'
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
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
import { createHelperClient } from './helper/client'
import { createHelperInstaller } from './helper/installer'
import { resolveHelperEntry } from './helper/paths'
import { loadHotkeyBindings, registerHotkeys } from './hotkeys'
import { createKernelManager } from './kernel-manager'
import { createKernelCrashWatcher, createNotifier } from './notifier'
import { bootstrapDataDir } from './paths'
import { makeToken } from './secrets'
import { shouldStartHidden } from './startup'
import { createSystemProxyController } from './sysproxy'
import { readSysProxyBypass } from './sysproxy-config'
import { createSysproxyGuard } from './sysproxy-guard'
import { createTray, trayIconPath } from './tray'
import { createTunRuntime } from './tun-runtime'
import { registerWindowControls } from './window-controls'
import {
  DEFAULT_WINDOW_BOUNDS,
  loadWindowState,
  saveWindowState,
} from './window-state'

// ESM has no CommonJS `__dirname`; electron-vite bundles main as ESM under
// `"type": "module"`, so derive it from import.meta.url (the bundled
// out/main/index.js location). All `join(__dirname, ...)` paths below resolve
// exactly as the CJS equivalent did, in both dev and packaged (asar) layouts.
const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Real fs adapter for bootstrapDataDir (recursive mkdir is idempotent).
const fsAdapter: FsLike = {
  existsSync,
  mkdirSync: (p) => void mkdirSync(p, { recursive: true }),
  readFileSync: (p) => readFileSync(p, 'utf8'),
  writeFileSync: (p, data) => writeFileSync(p, data, 'utf8'),
}

// TUN privileged-helper service identifiers (LaunchDaemon label on macOS,
// systemd unit / Windows service name on linux/win). Stable so install/uninstall
// + isInstalled all address the same registered service.
const HELPER_LABEL = 'io.github.metacubexd.helper'
const HELPER_SERVICE_NAME = 'metacubexd-helper'

const execAsync = promisify(nodeExec)

/**
 * Injected un-elevated command runner for the installer's cheap isInstalled
 * probe (never needs privilege). Real shell-out — only ever invoked when the
 * user enables TUN, never at boot and never in tests.
 */
const helperExec = (cmd: string): Promise<{ stdout: string; stderr: string }> =>
  execAsync(cmd)

/**
 * Injected elevation runner: run the ONE privileged install/uninstall script
 * with administrator privileges. macOS goes through osascript (`do shell script
 * ... with administrator privileges`, ONE prompt); linux/win go through the
 * installer's own pkexec/UAC commands, so a plain elevated shell suffices. Only
 * ever invoked on an explicit user TUN enable — never at boot, never in tests.
 */
const helperElevate = (
  script: string,
): Promise<{ stdout: string; stderr: string }> => {
  if (process.platform === 'darwin') {
    // Escape for embedding inside an AppleScript string literal.
    const escaped = script.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return execAsync(
      `osascript -e 'do shell script "${escaped}" with administrator privileges'`,
    )
  }
  // linux: the script already contains pkexec-eligible commands; win: runas/UAC.
  // Run it through the platform shell; the script's own commands carry privilege.
  return execAsync(script)
}

/**
 * Per-OS local socket / named-pipe path + root-owned secret-file path for the
 * privileged helper. mac/linux: a unix domain socket under a writable dir;
 * Windows: a `\\.\pipe\...` named pipe. The secret file is the root-owned,
 * app-readable path the installer writes the shared secret to.
 */
function resolveHelperPaths(userData: string): {
  socketPath: string
  secretFile: string
} {
  if (process.platform === 'win32') {
    return {
      socketPath: `\\\\.\\pipe\\${HELPER_SERVICE_NAME}`,
      secretFile: join(userData, 'helper.secret'),
    }
  }
  if (process.platform === 'darwin') {
    return {
      socketPath: `/tmp/${HELPER_SERVICE_NAME}.sock`,
      secretFile: `/Library/Application Support/${HELPER_LABEL}/helper.secret`,
    }
  }
  return {
    socketPath: `/run/${HELPER_SERVICE_NAME}.sock`,
    secretFile: `/etc/${HELPER_SERVICE_NAME}/helper.secret`,
  }
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
// Re-asserts the OS proxy if an external actor turns it off while we own it.
// Started when the proxy is enabled, stopped when disabled / on quit.
let sysproxyGuard: ReturnType<typeof createSysproxyGuard> | null = null
// Same-origin renderer URL (the control server serves the dashboard too); set
// in boot() and loaded by createWindow().
let rendererUrl: string | null = null
// TUN controller (option B). The REAL elevation/helper-IPC injection is wired in
// boot() via createTunRuntime (B-3): the B-1 state machine driving the B-2 helper
// client + the B3-T1 installer + the agent setSection primitive. Kept
// module-level so the quit/crash paths can recover the network through
// tunTeardown (anti-lockout).
let tunController: TunController | null = null
// Safe-teardown helper: recoverNetwork() tears the TUN down (back to sidecar)
// when active. Built in boot() from the tun-runtime; backs both the UI
// "recover network" action and the quit/crash paths.
let tunTeardown: ReturnType<typeof createTunRuntime>['teardown'] | null = null

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
  // enable() that always applies the default bypass list when the caller didn't
  // pass an explicit one — used by enable() below AND by the guard's re-assert.
  const enableWithBypass = (bypass?: string[]): Promise<void> =>
    baseSystemProxy.enable(bypass && bypass.length > 0 ? bypass : defaultBypass)
  // Guard against external changes (other apps / OS settings turning the proxy
  // off while we own it); re-asserts with the default bypass. Started/stopped by
  // the enable()/disable() wrappers below so every toggle (tray, hotkey, boot)
  // drives it consistently.
  sysproxyGuard = createSysproxyGuard({
    controller: { ...baseSystemProxy, enable: enableWithBypass },
  })
  systemProxy = {
    ...baseSystemProxy,
    enable: async (bypass) => {
      await enableWithBypass(bypass)
      // Begin watching only after the proxy is actually on. start() is
      // idempotent so the guard's own re-assert (which routes back through the
      // base enable, not this wrapper) never double-arms.
      sysproxyGuard?.start()
    },
    disable: async () => {
      // Stop watching first so the guard can't race a re-assert against our own
      // disable and flip the proxy back on.
      sysproxyGuard?.stop()
      await baseSystemProxy.disable()
    },
    setAutoProxy: async (url) => {
      // PAC mode replaces the fixed proxy, so stop the fixed-proxy guard — it
      // re-asserts the manual proxy and would fight the PAC URL otherwise.
      sysproxyGuard?.stop()
      await baseSystemProxy.setAutoProxy(url)
    },
    disableAutoProxy: async () => {
      sysproxyGuard?.stop()
      await baseSystemProxy.disableAutoProxy()
    },
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

  // Same chicken-and-egg as kernelManager: the TUN runtime needs agent.supervisor
  // + agent.profiles.setSection, but createAgent needs a tunController to register
  // the 'tun' feature + /api/control/tun routes. Hand createAgent a stable
  // delegate (truthy so 'tun' goes live) and back it with the real B-3 runtime
  // controller once the agent (and its supervisor/profiles) exists. createAgent
  // returns synchronously and no /api/control request fires before boot()
  // completes, so realTunController is always set by request time.
  let realTunController: TunController | null = null
  const tunControllerDelegate: TunController = {
    enable: (o) => {
      if (!realTunController) throw new Error('tun controller not ready')
      return realTunController.enable(o)
    },
    disable: () => {
      if (!realTunController) throw new Error('tun controller not ready')
      return realTunController.disable()
    },
    status: () => {
      if (!realTunController) throw new Error('tun controller not ready')
      return realTunController.status()
    },
  }
  tunController = tunControllerDelegate

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
    // Inject the TUN controller (delegate); enables the capability-gated
    // /api/control/tun routes + the 'tun' feature flag. Backed by the real B-3
    // runtime controller built below once the supervisor/profiles exist.
    tunController,
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

  // Wire the REAL TUN runtime (B-3): the B-1 state machine driving the B-2 helper
  // client + the B3-T1 installer + the agent setSection primitive + the
  // in-process supervisor (the sidecar backend). Everything OS/privilege/install/
  // spawn lives behind these injected deps — boot() never elevates, installs a
  // service, or spawns a privileged process; the privileged spawn happens inside
  // the already-installed root/admin helper, reached over a local socket.
  const tunPaths = resolveHelperPaths(userData)
  // Where the resolved TUN mode is persisted for the cold-start prompt.
  const tunStatePath = join(userData, 'tun-state.json')
  // Per-install shared secret stamped onto every helper IPC request. Persisted so
  // it stays stable across sessions (the installer writes it root-owned; the
  // client reads it back from here). Best-effort read; first run mints one.
  const helperSecretPath = join(userData, 'helper-secret.txt')
  const helperSecret = existsSync(helperSecretPath)
    ? readFileSync(helperSecretPath, 'utf8').trim()
    : (() => {
        const s = makeToken()
        try {
          writeFileSync(helperSecretPath, s, 'utf8')
        } catch {
          /* best-effort; a failed persist just re-mints next launch */
        }
        return s
      })()
  const tunRuntime = createTunRuntime({
    installer: createHelperInstaller({
      platform: process.platform,
      exec: helperExec,
      elevate: helperElevate,
      paths: {
        label: HELPER_LABEL,
        serviceName: HELPER_SERVICE_NAME,
        secretPath: tunPaths.secretFile,
      },
    }),
    // Lazily dial the helper IPC socket only on the privileged relaunch —
    // createHelperClient connects at construction, and the helper isn't listening
    // until it's installed. Forward the runtime's disconnect handler so an
    // UNEXPECTED helper drop (crash/kill) reaches onHelperDisconnect below.
    connectClient: (onDisconnect) =>
      createHelperClient({
        socketPath: tunPaths.socketPath,
        secret: helperSecret,
        onDisconnect,
      }),
    supervisor: agent.supervisor,
    setSection: async (key, value) => {
      const activeId = await agent!.profiles.getActiveId()
      if (!activeId) throw new Error('tun: no active profile to edit')
      await agent!.profiles.setSection(activeId, key, value)
    },
    kernelOptions: (): HelperKernelStartOptions => ({
      binaryPath,
      homeDir: paths.homeDir,
      configPath: paths.activeConfigPath,
    }),
    installOptions: (): HelperInstallOptions => ({
      electronBin: process.execPath,
      // Where the privileged service finds the helper bundle to run. Packaged:
      // the asar-UNPACKED copy under resourcesPath (a file inside app.asar can't
      // be spawned by an external service); dev: <appPath>/out/helper/index.js.
      helperEntry: resolveHelperEntry({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        appPath: app.getAppPath(),
      }),
      socketPath: tunPaths.socketPath,
      secret: helperSecret,
    }),
    // Persist the resolved mode so a future session knows the last state. We do
    // NOT auto-restore TUN at boot (that would silently elevate); the cold-start
    // prompt is surfaced below + handled by the UI (B-4).
    persist: async (state) => {
      try {
        writeFileSync(tunStatePath, JSON.stringify(state), 'utf8')
      } catch (err) {
        notify('Failed to persist TUN state', err)
      }
    },
    logError: (err) => notify('TUN network recovery failed', err),
    // Helper-disconnect linkage (B-3): while in TUN mode the kernel runs UNDER
    // the privileged helper, so the app does NOT supervise it directly — it
    // monitors the HELPER CONNECTION instead. If that connection drops
    // unexpectedly (helper crash/kill), recover the network (tear the TUN down,
    // fall back to the sidecar) so the machine can't keep believing it's routing
    // through a vanished TUN, and notify the user. recoverNetwork is a no-op once
    // already back in sidecar, so a benign disconnect is harmless. The watchdog
    // ownership split (helper supervises its own mihomo; app supervises the
    // helper connection) is enforced below by gating the in-app supervisor
    // watchdog on tunRuntime.isTunMode().
    onHelperDisconnect: () => {
      notify(
        'TUN helper disconnected',
        'Recovering the network — routing falls back to the sidecar.',
      )
      void tunTeardown?.recoverNetwork()
    },
  })
  // Back the delegate handed to createAgent with the real runtime controller, and
  // wire the safe-teardown helper for the UI recover action + quit/crash paths.
  realTunController = tunRuntime.controller
  tunTeardown = tunRuntime.teardown

  // Cold-start restore prompt: if the last session ended in TUN mode, surface a
  // notification rather than auto-elevating (an unattended boot must never pop a
  // privilege prompt). The renderer re-enables TUN through /api/control/tun on
  // the user's confirmation (B-4 UI). Best-effort read; a missing/corrupt file
  // means "was sidecar", so nothing to prompt.
  try {
    if (existsSync(tunStatePath)) {
      const last = JSON.parse(readFileSync(tunStatePath, 'utf8')) as {
        mode?: string
      }
      if (last.mode === 'tun') {
        notify(
          'TUN mode was active',
          'Re-enable TUN from the dashboard to resume routing all traffic.',
        )
      }
    }
  } catch (err) {
    notify('Failed to read persisted TUN state', err)
  }

  // In-app supervisor crash watchdog (Wave 5). Watchdog OWNERSHIP SPLIT (B-3):
  // this watchdog supervises only the SIDECAR-mode kernel (the in-process
  // supervisor's child). In TUN mode the kernel runs UNDER the privileged helper,
  // which owns its own mihomo's liveness (B-2: it stops the kernel + tears the
  // TUN down on app disconnect / its own exit); the app instead monitors the
  // HELPER connection via onHelperDisconnect above. So while tunRuntime.isTunMode()
  // is true this watchdog is INERT — reacting here would fight the helper's
  // supervision (double-restart) and the supervisor's state is stale anyway (its
  // child was stopped when we switched to the helper). The watcher de-dupes a
  // sustained errored state so a single sidecar crash notifies once (it re-arms
  // after a recovery). Subscribed before start() so we never miss the first event.
  const crashWatcher = createKernelCrashWatcher(notify)
  agent.supervisor.on('state', (state) => {
    // Disarm in TUN mode: the helper (not this supervisor) owns the kernel.
    if (tunRuntime.isTunMode()) return
    crashWatcher(state)
  })

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

  // Resume the guard if the OS proxy was left enabled from a prior session — the
  // OS state is the source of truth, so a persisted-enabled proxy must keep
  // being defended on this launch. Best-effort: a failed read just skips it.
  try {
    if (await systemProxy.isEnabled()) sysproxyGuard.start()
  } catch (err) {
    notify('System proxy guard failed to start', err)
  }
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
  // Anti-lockout: if TUN mode is active, tear it down (back to sidecar) before
  // the kernel stops so we never leave the machine routing into a dead TUN
  // device. recoverNetwork() is a no-op in sidecar mode and never throws; in TUN
  // mode it stops the privileged helper kernel over IPC, removes the `tun:` block
  // and relaunches the unprivileged sidecar (B-3 runtime). Then the sidecar stop
  // below is a no-op since the supervisor is already stopped.
  await tunTeardown?.recoverNetwork()
  // Stop re-asserting the OS proxy so the guard can't race the disable() below
  // and flip it back on mid-shutdown (the disable() wrapper also stops it, but
  // be explicit so the quit-stop guarantee doesn't depend on that internal).
  sysproxyGuard?.stop()
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
    // Register the window-control IPC channels ONCE (the title bar on
    // Windows/Linux drives minimize/maximize/close through them). getWindow is
    // lazy so a later createWindow() (macOS reopen) is picked up automatically.
    registerWindowControls({ ipcMain, getWindow: () => win })
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
