import type {
  KernelManager,
  SystemProxyController,
  TunController,
} from '@metacubexd/agent/types'
import type { Tray } from 'electron'
import type { ControlServer } from './control-server'
import type { HelperInstallOptions } from './helper/installer'
import type { HelperKernelStartOptions } from './helper/server'
import type {FailedHotkey} from './hotkeys';
import type { FsLike } from './paths'
import { exec as nodeExec } from 'node:child_process'
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  createAgent,
  createProfileScheduler,
  TunPreconditionError,
} from '@metacubexd/agent'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
} from 'electron'
import { buildAppMenu } from './app-menu'
import { resolveMihomoBinary } from './binary-path'
import { resolveBootPorts } from './boot-ports'
import { getProxyMode, nextProxyMode, setProxyMode } from './clash-config'
import { runShutdownCleanup } from './cleanup'
import { startControlServer, stopControlServer } from './control-server'
import { parseSubscriptionDeepLink } from './deep-link'
import { registerDesktopIpc } from './desktop-ipc'
import {
  DEFAULT_DESKTOP_SETTINGS,
  loadDesktopSettings,
  mergeDesktopSettings,
  saveDesktopSettings,
} from './desktop-settings'
import { pickFreePorts } from './free-port'
import { createHelperClient } from './helper/client'
import { createHelperElevate } from './helper/elevate'
import { createHelperInstaller } from './helper/installer'
import { resolveHelperEntry } from './helper/paths'
import {
  DEFAULT_HOTKEYS,
  
  loadHotkeyBindings,
  registerHotkeys,
  sanitizeHotkeyBindings,
  saveHotkeyBindings
} from './hotkeys'
import { createKernelManager } from './kernel-manager'
import { createLogFileSink } from './log-file'
import { createLoginItemController } from './login-item'
import { createKernelCrashWatcher, createNotifier } from './notifier'
import { bootstrapDataDir } from './paths'
import { buildProxyEnvCommand } from './proxy-env'
import { makeToken } from './secrets'
import { createShutdownOrchestrator } from './shutdown-orchestrator'
import { runSilentUpdateCheck } from './silent-update'
import { shouldStartHidden } from './startup'
import { createSystemProxyController } from './sysproxy'
import { readSysProxyBypass, writeSysProxyBypass } from './sysproxy-config'
import { createSysproxyGuard } from './sysproxy-guard'
import { createTrafficPoller, formatTraySpeed } from './traffic-poller'
import { createTray, trayIconPath } from './tray'
import { createTunRuntime } from './tun-runtime'
import { checkForUpdates } from './update-check'
import { registerWindowControls } from './window-controls'
import { applyWindowSecurity } from './window-security'
import {
  DEFAULT_WINDOW_BOUNDS,
  loadWindowState,
  MIN_WINDOW_BOUNDS,
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
 * with administrator privileges (osascript / pkexec / UAC RunAs). Only ever
 * invoked on an explicit user TUN enable — never at boot, never in tests.
 * See `helper/elevate.ts` — a plain exec here was the #2116 Windows TUN 500.
 */
const helperElevate = createHelperElevate({
  platform: process.platform,
  exec: helperExec,
})

/**
 * Per-OS local socket / named-pipe path + root-owned secret-file path for the
 * privileged helper. mac/linux: a unix domain socket under a writable dir;
 * Windows: a `\\.\pipe\...` named pipe. The secret file is the root-owned,
 * ROOT-ONLY (0600 / SYSTEM-ACL'd) path the installer writes the shared secret
 * to and the helper reads as root — distinct from the app's own user-owned copy
 * under userData (helper-secret.txt). It is never world-readable.
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
// On-disk app event log (userData/logs/app.log): every notify() plus uncaught
// errors, so post-mortem support has more than a vanished toast. Created in
// boot(); notify() tolerates it being null before that.
let appLog: ReturnType<typeof createLogFileSink> | null = null
// Desktop-shell settings (silent update check, TUN auto-restore, tray speed),
// loaded in boot() from userData/desktop-settings.json and mutated through the
// desktop:set-settings IPC channel.
let desktopSettings = { ...DEFAULT_DESKTOP_SETTINGS }
let desktopSettingsPath: string | null = null
// Live tray speed: the /traffic stream poller + its last formatted line. The
// poller runs while showTraySpeed is on; macOS additionally paints the line
// into the menu-bar title every sample.
let trafficPoller: ReturnType<typeof createTrafficPoller> | null = null
let lastSpeedLine: string | null = null

// Real fs adapter for the log sinks (recursive mkdir; byte-accurate size).
const logFsAdapter = {
  existsSync,
  mkdirSync: (p: string) => void mkdirSync(p, { recursive: true }),
  appendFileSync: (p: string, data: string) => appendFileSync(p, data, 'utf8'),
  statSize: (p: string) => statSync(p).size,
  renameSync,
  unlinkSync,
}

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

  // Desktop-shell settings (silent update check / TUN auto-restore / tray
  // speed). Loaded up front — the TUN cold-start path below already branches
  // on tunAutoRestore.
  desktopSettingsPath = join(userData, 'desktop-settings.json')
  desktopSettings = loadDesktopSettings(desktopSettingsPath, fsAdapter)

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
  const sysproxyConfigPath = join(userData, 'sysproxy.json')
  let defaultBypass = readSysProxyBypass(sysproxyConfigPath, fsAdapter)
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
  // An explicitly applied list (the control panel's "Apply") becomes the
  // persisted default, so the guard's re-asserts, the tray toggle and the next
  // boot all keep honoring it — previously the edit evaporated on any of those.
  // Skips the write when nothing changed (the guard re-asserts every few
  // seconds; it must not grind the disk).
  const setDefaultBypass = (bypass: string[]): void => {
    if (JSON.stringify(bypass) === JSON.stringify(defaultBypass)) return
    // Persist BEFORE mutating the in-memory default: if the write fails (full
    // disk, locked file) the memory stays in sync with disk, so re-Applying the
    // same list still differs from the default and retries the write — updating
    // memory first would make the equality guard swallow the retry silently.
    try {
      writeSysProxyBypass(sysproxyConfigPath, fsAdapter, bypass)
    } catch (err) {
      notify('Failed to save proxy bypass list', err)
      return
    }
    defaultBypass = [...bypass]
  }
  systemProxy = {
    ...baseSystemProxy,
    enable: async (bypass) => {
      if (bypass && bypass.length > 0) setDefaultBypass(bypass)
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
    // Before the first enable the base controller has seen no bypass yet and
    // reports [] — surface the effective default list instead so the control
    // panel's textarea opens pre-filled with what enable() would actually apply.
    describe: () => {
      const d = baseSystemProxy.describe()
      return d.bypass.length > 0 ? d : { ...d, bypass: [...defaultBypass] }
    },
    // Route-level hook: /sysproxy POSTs record the applied list here even when
    // the apply happens while the proxy is off (disable() takes no list).
    setDefaultBypass,
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
    // The real runtime controller always wires uninstall (installer.uninstall),
    // so expose it through the delegate too — this is what registers the
    // /api/control/tun/uninstall route. Throws if the real controller somehow
    // lacks it (it never does in B-3).
    uninstall: () => {
      if (!realTunController?.uninstall)
        throw new Error('tun controller not ready')
      return realTunController.uninstall()
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
    githubToken: process.env.GITHUB_TOKEN,
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
  // Hoisted out of createTunRuntime so the TUN auto-restore gate below can
  // probe isInstalled() (cheap, un-elevated) without a second installer.
  const helperInstaller = createHelperInstaller({
    platform: process.platform,
    exec: helperExec,
    elevate: helperElevate,
    paths: {
      label: HELPER_LABEL,
      serviceName: HELPER_SERVICE_NAME,
      secretPath: tunPaths.secretFile,
    },
  })
  const tunRuntime = createTunRuntime({
    installer: helperInstaller,
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
      if (!activeId)
        throw new TunPreconditionError('tun: no active profile to edit')
      await agent!.profiles.setSection(activeId, key, value)
    },
    // Gate enable() on an active profile BEFORE the controller tears the kernel
    // down. injectTun (setSection above) needs an active profile to write the
    // `tun:` block into; without it the enable used to fail mid-sequence (after
    // stopKernel), leaving the network half torn-down + an [unhandled] 500. This
    // rejects up front so a profile-less enable is a clean, recoverable no-op
    // that the control router reports as a 409.
    precheck: async () => {
      if (!(await agent!.profiles.getActiveId()))
        throw new TunPreconditionError('tun: no active profile to edit')
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

  // Cold-start restore: if the last session ended in TUN mode, either queue an
  // automatic re-enable (opt-in setting; runs after the kernel starts and ONLY
  // when the helper service is already installed, so an unattended boot never
  // pops a privilege prompt) or surface a notification for the manual path.
  // Best-effort read; a missing/corrupt file means "was sidecar".
  let tunRestoreStack: string | null = null
  try {
    if (existsSync(tunStatePath)) {
      const last = JSON.parse(readFileSync(tunStatePath, 'utf8')) as {
        mode?: string
        stack?: string
      }
      if (last.mode === 'tun') {
        if (desktopSettings.tunAutoRestore) {
          tunRestoreStack =
            typeof last.stack === 'string' ? last.stack : 'mixed'
        } else {
          notify(
            'TUN mode was active',
            'Re-enable TUN from the dashboard to resume routing all traffic.',
          )
        }
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

  // Persist kernel output + app events to userData/logs (size-rotated). The
  // dashboard's SSE view only shows the live session; the files are what makes
  // yesterday's crash diagnosable (Help > Open Logs Folder).
  const logsDir = join(userData, 'logs')
  const kernelLog = createLogFileSink({
    dir: logsDir,
    fileName: 'kernel.log',
    fs: logFsAdapter,
  })
  appLog = createLogFileSink({
    dir: logsDir,
    fileName: 'app.log',
    fs: logFsAdapter,
  })
  agent.supervisor.on('log', (l) => kernelLog.write(l.line, l.stream))

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

  // Dev HMR: when running unpackaged AND the `dev:desktop` launcher points us at
  // the live Nuxt dev server, load THAT (full HMR) instead of the static copy
  // the control server serves. The renderer then reaches /api/control + the
  // kernel cross-origin, so flip on the control server's dev-only CORS shim.
  // `MCXD_RENDERER_DEV_URL` is never set in packaged builds, so this is inert
  // there and the renderer stays same-origin with the control API.
  const rendererDevUrl =
    !app.isPackaged && process.env.MCXD_RENDERER_DEV_URL
      ? process.env.MCXD_RENDERER_DEV_URL
      : null

  // The control server also serves the renderer (same origin as /api/control)
  // from the dir where copy:renderer / electron-builder stage the nuxt output.
  const rendererDir = join(__dirname, '..', '..', 'renderer')
  controlServer = await startControlServer(
    agent.router,
    controlPort,
    rendererDir,
    !!rendererDevUrl,
  )
  rendererUrl = rendererDevUrl ?? `http://127.0.0.1:${controlPort}/`

  // Inject the renderer bridge env (consumed by preload/index.ts) from the
  // PRE-PICKED endpoint values rather than the started kernel state. The
  // supervisor injects exactly these (external-controller/secret/mixed-port)
  // into the active config before spawn, so the started state only ever echoes
  // them back — we don't need to await start() to know them. Setting them
  // up-front is what enables "秒开": createWindow() can paint the shell against
  // the already-listening control server without waiting on the kernel.
  process.env.MCXD_CONTROL_BASE = `http://127.0.0.1:${controlPort}/api/control`
  process.env.MCXD_CONTROL_TOKEN = controlToken
  process.env.MCXD_CLASH_URL = `http://127.0.0.1:${clashPort}`
  process.env.MCXD_CLASH_SECRET = clashSecret
  // Loopback proxy port for Wave 2 system-proxy wiring.
  process.env.MCXD_MIXED_PORT = String(mixedPort)

  // Tray speed: stream the Clash /traffic endpoint and keep the last formatted
  // line for the tooltip; macOS additionally paints it into the menu-bar title
  // every sample (monospaced digits so the width doesn't jitter). Started only
  // while the setting is on; the settings IPC toggles it live.
  trafficPoller = createTrafficPoller({
    endpoint: { url: `http://127.0.0.1:${clashPort}`, secret: clashSecret },
    onSample: (sample) => {
      lastSpeedLine = formatTraySpeed(sample)
      if (process.platform === 'darwin') {
        tray?.setTitle(lastSpeedLine, { fontType: 'monospacedDigit' })
      }
    },
  })
  if (desktopSettings.showTraySpeed) trafficPoller.start()

  // Start the kernel WITHOUT blocking boot()/window creation. The renderer
  // already tolerates a not-yet-running kernel (its backend websockets retry
  // once it comes up), so the window shows immediately while the kernel boots in
  // the background. Only AFTER the kernel is actually up do we re-apply the OS
  // system proxy if a prior session left it enabled — the OS state is the source
  // of truth, and a force-kill last time would have left it pointing at the OLD
  // session's mixed port; this launch picked a NEW free port, so re-enable()
  // re-points the proxy at the fresh mixedPort AND re-arms the guard (idempotent)
  // instead of entrenching a dead proxy. Doing it before the kernel binds the
  // port would briefly route through nothing, so it waits on start(). All
  // best-effort: a failed start can't strand the window (the crash watchdog +
  // tray Start action cover recovery), and a failed resume just notifies.
  const sp = systemProxy
  void agent.supervisor
    .start()
    .then(async () => {
      try {
        if (await sp.isEnabled()) await sp.enable()
      } catch (err) {
        notify('System proxy failed to resume', err)
      }
      // TUN auto-restore (opt-in, queued above): only when the helper service
      // is ALREADY installed — enable() then reaches the running root/admin
      // service over its socket without any elevation prompt. A missing
      // service falls back to the manual-path notification.
      if (tunRestoreStack !== null) {
        try {
          if (await helperInstaller.isInstalled()) {
            await tunRuntime.controller.enable({ stack: tunRestoreStack })
            notify(
              'TUN mode restored',
              'Routing all traffic through TUN again.',
            )
          } else {
            notify(
              'TUN mode was active',
              'Re-enable TUN from the dashboard to resume routing all traffic.',
            )
          }
        } catch (err) {
          notify('TUN auto-restore failed', err)
        }
      }
    })
    .catch((err) => notify('Kernel failed to start', err))
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
  // getNormalBounds: the UN-maximized geometry even while maximized, so a
  // restore-from-maximize after relaunch lands where the user left the window
  // (getBounds would bake the maximized rect in as the "normal" size).
  const bounds = {
    ...win.getNormalBounds(),
    ...(win.isMaximized() ? { maximized: true } : {}),
    // Carry the Chromium zoom (menu Cmd/Ctrl +/-) across sessions. Reading it
    // here (resize/move debounce + close flush) needs no zoom-change event —
    // the close flush always captures the final value.
    ...(win.webContents.getZoomLevel() !== 0
      ? { zoomLevel: win.webContents.getZoomLevel() }
      : {}),
  }
  const write = (): void => {
    try {
      saveWindowState(fsAdapter, windowStatePath(), bounds)
    } catch {
      // Best-effort: a geometry write failure (full disk, locked/read-only
      // userData) must never crash the app. From the debounced setTimeout an
      // uncaught throw would hit process.on('uncaughtException') and exit(1) —
      // tearing down the proxy on a routine window move.
    }
  }
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

// Close button / hotkey dismiss destroys the BrowserWindow so the Chromium
// renderer exits (#2117). The kernel + tray keep proxying; tray/hotkey/dock
// recreate the window via focusWindow(). before-quit still flips isQuitting so
// we can skip the "still running" tip on a real quit.
let isQuitting = false

// One-time (persisted) hint after the first panel close, so a new user does
// not mistake a destroyed window for a full quit — the classic tray-app confusion.
function showCloseTipOnce(): void {
  const marker = join(app.getPath('userData'), 'close-tip-shown')
  if (existsSync(marker)) return
  try {
    writeFileSync(marker, '1', 'utf8')
  } catch {
    /* best-effort; worst case the tip shows again next time */
  }
  const where = process.platform === 'darwin' ? 'menu bar' : 'tray'
  notify(
    'MetaCubeXD is still running',
    `The window was closed; the proxy keeps running in the ${where}. Quit from the ${where} menu.`,
  )
}

/** Tell an open renderer to refetch Clash config/proxies (no-op if none). */
function notifyBackendInvalidate(reason?: string): void {
  if (!win || win.isDestroyed()) return
  win.webContents.send('backend:invalidate', reason ? { reason } : {})
}

function createWindow(): void {
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
    // Frameless on both platforms, so the OS enforces no minimum — clamp it
    // ourselves to keep the caption controls + sidebar from overlapping.
    minWidth: MIN_WINDOW_BOUNDS.width,
    minHeight: MIN_WINDOW_BOUNDS.height,
    // Only pass x/y when both survived sanitization — otherwise let Electron
    // center the window on the primary display.
    ...(bounds.x !== undefined && bounds.y !== undefined
      ? { x: bounds.x, y: bounds.y }
      : {}),
    show: false,
    // Paint the dark default-theme base immediately instead of Electron's
    // opaque white, which otherwise flashes before the themed SPA paints and
    // undercuts the fast first-paint work.
    backgroundColor: '#11181f',
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

  // Renderer hardening (Electron security checklist): deny in-app popups, lock
  // top-level navigation to the control-server origin, send foreign http/https
  // links to the system browser, and deny every web permission request. The
  // renderer origin is the control server (rendererUrl); SPA hash routing is
  // same-document so it never trips the navigation guard.
  if (rendererUrl) {
    applyWindowSecurity({
      webContents: win.webContents,
      allowedOrigin: new URL(rendererUrl).origin,
      openExternal: (url) => void shell.openExternal(url),
      setPermissionRequestHandler: (handler) =>
        win?.webContents.session.setPermissionRequestHandler(handler),
    })
  }

  // Keep the renderer's maximize/restore button in sync with the real window
  // state: forward every native maximize/unmaximize to the title bar. (macOS
  // never renders that button but the events are harmless there.)
  const sendMaximizeState = () =>
    win?.webContents.send('window:maximize-changed', win.isMaximized())
  win.on('maximize', sendMaximizeState)
  win.on('unmaximize', sendMaximizeState)
  // Maximize (if persisted) then reveal — tied to ready-to-show so the first
  // paint is already the correct size (no flash of the restored bounds).
  win.once('ready-to-show', () => {
    if (bounds.maximized) win?.maximize()
    win?.show()
  })
  // Restore the persisted Chromium zoom once the document exists (setting it
  // before the first load is overwritten by the navigation's default).
  if (bounds.zoomLevel !== undefined) {
    const zoom = bounds.zoomLevel
    win.webContents.once('did-finish-load', () => {
      win?.webContents.setZoomLevel(zoom)
    })
  }
  // Persist the geometry as the user resizes/moves; flush on close so the final
  // position is saved even if the debounce timer hadn't fired yet.
  win.on('resize', () => persistWindowBounds())
  win.on('move', () => persistWindowBounds())
  // Destroy on close so the Chromium renderer exits (#2117). Kernel + tray keep
  // running; focusWindow() recreates the window on the next summon. A fullscreen
  // window must leave fullscreen first — closing one mid-Space is messy on macOS.
  win.on('close', (event) => {
    persistWindowBounds(true)
    if (win?.isFullScreen()) {
      event.preventDefault()
      win.once('leave-full-screen', () => {
        if (!win || win.isDestroyed()) return
        win.close()
      })
      win.setFullScreen(false)
      return
    }
    if (!isQuitting) showCloseTipOnce()
  })
  // Drop the reference once destroyed so every window consumer
  // (tray/hotkeys/deep links via focusWindow) recreates instead of calling into
  // a destroyed object — that throw used to take down the app via the
  // uncaughtException handler.
  win.on('closed', () => {
    win = null
  })
  // Load over http from the same-origin control server (NOT file://) so web
  // workers (Monaco) and same-origin /api/control fetch/SSE work. boot() always
  // runs before createWindow(), so rendererUrl is set.
  void win.loadURL(rendererUrl ?? 'about:blank')
}

async function shutdownKernel(): Promise<void> {
  // Halt subscription auto-update ticking so no refresh fires mid-shutdown.
  profileScheduler?.stop()
  // Stop streaming /traffic — the kernel is about to go away and a reconnect
  // loop during teardown is just noise.
  trafficPoller?.stop()
  // Anti-lockout: if TUN mode is active, tear it down (back to sidecar) before
  // the kernel stops so we never leave the machine routing into a dead TUN
  // device. recoverNetwork() is a no-op in sidecar mode and never throws; in TUN
  // mode it stops the privileged helper kernel over IPC, removes the `tun:` block
  // and relaunches the unprivileged sidecar (B-3 runtime). Then the sidecar stop
  // below is a no-op since the supervisor is already stopped.
  // Bound it: recoverNetwork talks to the privileged helper over IPC and runs
  // BEFORE the OS proxy is released below, so a wedged helper socket here would
  // delay (or prevent) the safety-critical proxy disable. recoverNetwork already
  // swallows its own errors, so racing a 3s timeout is safe; an incomplete TUN
  // teardown on quit is acceptable — the helper's on-disconnect teardown plus
  // the OS reaping the sidecar cover the residual.
  await Promise.race([
    tunTeardown?.recoverNetwork() ?? Promise.resolve(),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ])
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

// Summon + focus the main window, recreating it when none exists (close and
// quit both destroy it). Never touches a destroyed window — the
// tray/hotkey/deep-link/second-instance paths all route here.
function focusWindow(): void {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  // Window was already alive — push a soft refresh so tray/external Clash
  // edits surface without a full remount (#2117).
  notifyBackendInvalidate('show')
}

// Global-hotkey window toggle: destroy when visible (free the renderer),
// otherwise summon + focus (recreating the window if needed).
function toggleWindowVisibility(): void {
  if (win && !win.isDestroyed() && win.isVisible() && !win.isMinimized()) {
    win.close()
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

// Global-hotkey proxy-mode cycle: read the current mode from the Clash API, then
// switch to the next in rule -> global -> direct -> rule. Shares the bounded
// `/configs` client with the tray submenu (clash-config.ts) — getProxyMode /
// setProxyMode each carry the 3s timeout so a wedged kernel can't hang this
// fire-and-forget hotkey. Best-effort; a kernel that rejects the switch notifies.
async function cycleProxyMode(): Promise<void> {
  const url = process.env.MCXD_CLASH_URL
  if (!url) return
  const endpoint = { url, secret: process.env.MCXD_CLASH_SECRET ?? '' }
  const next = nextProxyMode(await getProxyMode(fetch, endpoint))
  if (!(await setProxyMode(fetch, endpoint, next))) {
    notify('Proxy mode switch failed', 'the kernel did not accept the change')
    return
  }
  notifyBackendInvalidate('mode')
}

// Wraps the Electron Notification constructor (dependency-injected in
// notifier.ts so the crash/subscription notifications stay unit-testable).
// Clicking any toast summons the dashboard — "Kernel stopped" is an implicit
// "come look", not something to dismiss into the void.
const notifier = createNotifier({ Notification, onClick: () => focusWindow() })

// Show a desktop notification when supported (no-op headless/CI). Every
// notification is also an app event worth keeping — mirror it into the on-disk
// app log so a dismissed toast isn't the only record of a failure.
function notify(title: string, body: unknown): void {
  const text = body instanceof Error ? body.message : String(body)
  appLog?.write(`${title}: ${text}`, 'notify')
  if (!Notification.isSupported()) return
  notifier.notify(title, text)
}

// Manual update check (Help > Check for Updates…). Explicit user action, so
// the outcome always surfaces: a dialog when an update exists (with a Download
// button), a notification when up to date or on failure. No auto-updating —
// the app deliberately ships without an updater (publish: null).
async function runUpdateCheck(): Promise<void> {
  try {
    const result = await checkForUpdates(fetch, app.getVersion(), {
      githubToken: process.env.GITHUB_TOKEN,
    })
    if (!result.hasUpdate) {
      notify(
        'Up to date',
        `MetaCubeXD ${result.current} is the latest version.`,
      )
      return
    }
    const opts: Electron.MessageBoxOptions = {
      type: 'info',
      message: `Update available: ${result.latest}`,
      detail: `You are running ${result.current}. Download the new version from GitHub Releases.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }
    const { response } =
      win && !win.isDestroyed()
        ? await dialog.showMessageBox(win, opts)
        : await dialog.showMessageBox(opts)
    if (response === 0) void shell.openExternal(result.releaseUrl)
  } catch (err) {
    notify('Update check failed', err)
  }
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

// Windows toast notifications are attributed (and delivered) via the
// AppUserModelID; without setting it to the installer's appId, packaged-app
// notifications can silently not show. No-op elsewhere.
if (process.platform === 'win32') {
  app.setAppUserModelId('one.metacubex.desktop')
}

// Register the custom URL schemes so the OS routes clash:// / clashmeta://
// links to this app (deep-link subscription import). Unpackaged dev runs
// launch as `electron <app-path>` (process.defaultApp), where Windows/Linux
// registration must pin the executable + app path or the OS routes the link
// to a bare electron binary with no app. Packaged macOS additionally requires
// the schemes in Info.plist — declared via `protocols` in electron-builder.yml.
for (const scheme of ['clash', 'clashmeta']) {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(scheme, process.execPath, [
      resolve(process.argv[1]),
    ])
  } else {
    app.setAsDefaultProtocolClient(scheme)
  }
}

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
    try {
      await boot()
    } catch (err) {
      // boot() can reject (no free ports, control-server bind race,
      // supervisor.start() on a bad kernel/config). There's no window or tray
      // yet and the await sits in a .then() with no .catch, so a silent
      // rejection would leave a headless process with the OS proxy possibly
      // pointing at a dead port. Surface it (dialog works before any window
      // exists; notify() no-ops when notifications are unsupported, exactly when
      // we need it) and quit cleanly — before-quit -> shutdownKernel is fully
      // null-guarded for partial-boot state.
      dialog.showErrorBox(
        'Failed to start MetaCubeXD',
        err instanceof Error ? err.message : String(err),
      )
      app.quit()
      return
    }
    // Silent start: a login-launch (--hidden arg or OS wasOpenedAtLogin) boots
    // the kernel but skips creating the BrowserWindow entirely so no Chromium
    // renderer sits idle until the user summons the panel from the tray (#2117).
    const startHidden = shouldStartHidden(
      process.argv,
      app.getLoginItemSettings(),
    )
    if (!startHidden) createWindow()
    // Register the window-control IPC channels ONCE (the title bar on
    // Windows/Linux drives minimize/maximize/close through them). getWindow is
    // lazy so a later createWindow() (macOS reopen) is picked up automatically.
    registerWindowControls({ ipcMain, getWindow: () => win })
    // Native About panel content (the macOS app-menu About role and the
    // Help > About item on Windows/Linux both read from this).
    app.setAboutPanelOptions({
      applicationName: 'MetaCubeXD',
      applicationVersion: app.getVersion(),
      website: 'https://github.com/MetaCubeX/metacubexd',
    })
    // Cross-platform "open at login" (Electron login items on mac/win; XDG
    // autostart entry on Linux, where setLoginItemSettings is a no-op). The
    // AppImage path must outlive the transient mount, hence env.APPIMAGE.
    const loginItem = createLoginItemController({
      platform: process.platform,
      app,
      linux: {
        fs: {
          existsSync,
          mkdirSync: (p) => void mkdirSync(p, { recursive: true }),
          writeFileSync,
          unlinkSync,
        },
        autostartDir: join(
          // `||` not `??`: the XDG spec mandates an EMPTY XDG_CONFIG_HOME be
          // treated as unset — `??` would keep '' and yield a relative
          // `autostart/` dir in the cwd instead of ~/.config/autostart.
          process.env.XDG_CONFIG_HOME || join(app.getPath('home'), '.config'),
          'autostart',
        ),
        execPath: process.env.APPIMAGE ?? process.execPath,
        name: 'metacubexd',
      },
    })
    tray = createTray({
      showWindow: () => focusWindow(),
      startKernel: () => void agent?.supervisor.start(),
      stopKernel: () => void agent?.supervisor.stop(),
      restartKernel: () => void agent?.supervisor.restart(),
      quit: () => app.quit(),
      iconPath: trayIconPath(),
      // boot() (runs above) sets these from the bound kernel state; fall back
      // to empty strings so createTray never sees undefined.
      clash: {
        url: process.env.MCXD_CLASH_URL ?? '',
        secret: process.env.MCXD_CLASH_SECRET ?? '',
      },
      // boot() builds the OS proxy controller (anti-lockout disable() on quit
      // lives in shutdownKernel). Passing it renders the tray "System Proxy"
      // checkbox; enable() applies the default bypass list (see boot()).
      ...(systemProxy ? { systemProxy } : {}),
      // TUN toggle. enable() elevates + relaunches the kernel — only ever on an
      // explicit tray click. Failures notify here (the tray re-syncs its
      // checkbox from status() afterwards).
      ...(tunController
        ? {
            tun: {
              status: () => tunController!.status(),
              enable: async () => {
                try {
                  await tunController!.enable({ stack: 'mixed' })
                } catch (err) {
                  notify('TUN enable failed', err)
                  throw err
                }
              },
              disable: async () => {
                try {
                  await tunController!.disable()
                } catch (err) {
                  notify('TUN disable failed', err)
                  throw err
                }
              },
            },
          }
        : {}),
      // Live kernel state for the status line + Start/Stop/Restart enablement,
      // kept fresh by the supervisor's own state events — plus the Profiles
      // submenu (switch the active subscription without opening the window).
      ...(agent
        ? {
            getKernelState: () => {
              const s = agent!.supervisor.getState()
              return s.version
                ? { status: s.status, version: s.version }
                : { status: s.status }
            },
            onKernelState: (cb: () => void) =>
              agent!.supervisor.on('state', () => cb()),
            profiles: {
              list: async () =>
                (await agent!.profiles.list()).map((p) => ({
                  id: p.id,
                  name: p.name,
                })),
              activeId: () => agent!.profiles.getActiveId(),
              // Same sequence as the deep-link import path: validate + write
              // the active config, then restart the kernel on it. Notifies
              // both outcomes (the switch is invisible while the menu is
              // closed) and rethrows so the tray re-syncs its radio state.
              activate: async (id: string) => {
                try {
                  const metas = await agent!.profiles.list()
                  await agent!.profiles.setActive(id)
                  await agent!.supervisor.restart()
                  const name = metas.find((m) => m.id === id)?.name ?? id
                  notify('Profile activated', `${name} is now active.`)
                  notifyBackendInvalidate('profile')
                } catch (err) {
                  notify('Profile switch failed', err)
                  throw err
                }
              },
            },
          }
        : {}),
      copyProxyCommand: () => {
        const port = Number(process.env.MCXD_MIXED_PORT)
        if (!Number.isFinite(port) || port <= 0) return
        const cmd = buildProxyEnvCommand(process.platform, '127.0.0.1', port)
        clipboard.writeText(cmd)
        notify('Proxy command copied', cmd)
      },
      loginItem,
      // Last formatted /traffic sample for the tooltip (poller in boot()).
      getSpeedLine: () => lastSpeedLine,
      onBackendInvalidate: () => notifyBackendInvalidate('mode'),
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
            restartKernel: () => void agent?.supervisor.restart(),
            openExternal: (url) => void shell.openExternal(url),
            openDataFolder: () => void shell.openPath(app.getPath('userData')),
            openLogsFolder: () => {
              // The sinks create it lazily on first write; make sure the
              // folder exists so openPath never lands on a missing dir.
              const dir = join(app.getPath('userData'), 'logs')
              mkdirSync(dir, { recursive: true })
              void shell.openPath(dir)
            },
            showAbout: () => app.showAboutPanel(),
            checkForUpdates: () => void runUpdateCheck(),
          },
        }),
      ),
    )

    // macOS dock click (and Windows taskbar activate): summon the existing —
    // possibly hidden — window instead of only reacting when none exists.
    app.on('activate', () => focusWindow())

    // Register the global hotkeys (overridable via <userData>/hotkeys.json).
    // toggleSystemProxy/cycleProxyMode are async; the action signature is void
    // so we fire-and-forget here (each notifies on failure). An accelerator
    // that fails to register (owned by another app / a typo in hotkeys.json)
    // is surfaced instead of dying silently. applyHotkeys re-registers from
    // scratch so the settings panel's saves take effect live.
    const hotkeysPath = join(app.getPath('userData'), 'hotkeys.json')
    const hotkeyActions = {
      toggleSystemProxy: () => void toggleSystemProxy(),
      cycleProxyMode: () => void cycleProxyMode(),
      toggleWindow: () => toggleWindowVisibility(),
    }
    let hotkeyBindings = loadHotkeyBindings(hotkeysPath, fsAdapter)
    let hotkeyFailed: FailedHotkey[] = []
    const applyHotkeys = (bindings: typeof hotkeyBindings): void => {
      globalShortcut.unregisterAll()
      const result = registerHotkeys({
        globalShortcut,
        bindings,
        actions: hotkeyActions,
      })
      hotkeyBindings = bindings
      hotkeyFailed = result.failed
    }
    applyHotkeys(hotkeyBindings)
    if (hotkeyFailed.length > 0) {
      notify(
        'Some hotkeys failed to register',
        hotkeyFailed.map((f) => `${f.accelerator} (${f.action})`).join(', '),
      )
    }

    // Desktop-settings + hotkeys IPC (the dashboard's Desktop panel). The
    // setters own persistence and live side effects: toggling the tray speed
    // starts/stops the /traffic poller, saving hotkeys re-registers them.
    registerDesktopIpc({
      ipcMain,
      settings: {
        get: () => ({ ...desktopSettings }),
        set: (patch) => {
          const next = mergeDesktopSettings(desktopSettings, patch)
          const speedToggled =
            next.showTraySpeed !== desktopSettings.showTraySpeed
          desktopSettings = next
          if (desktopSettingsPath) {
            try {
              saveDesktopSettings(desktopSettingsPath, fsAdapter, next)
            } catch (err) {
              notify('Failed to save desktop settings', err)
            }
          }
          if (speedToggled) {
            if (next.showTraySpeed) {
              trafficPoller?.start()
            } else {
              trafficPoller?.stop()
              lastSpeedLine = null
              if (process.platform === 'darwin') tray?.setTitle('')
            }
          }
          return { ...desktopSettings }
        },
      },
      hotkeys: {
        get: () => ({
          bindings: { ...hotkeyBindings },
          defaults: { ...DEFAULT_HOTKEYS },
          failed: [...hotkeyFailed],
        }),
        set: (patch) => {
          const bindings = sanitizeHotkeyBindings(patch)
          try {
            saveHotkeyBindings(hotkeysPath, fsAdapter, bindings)
          } catch (err) {
            notify('Failed to save hotkeys', err)
          }
          applyHotkeys(bindings)
          return {
            bindings: { ...hotkeyBindings },
            defaults: { ...DEFAULT_HOTKEYS },
            failed: [...hotkeyFailed],
          }
        },
      },
    })

    // Silent update check (opt-out via the Desktop settings panel): delayed so
    // it never competes with boot, throttled + de-duplicated inside
    // runSilentUpdateCheck (24h between checks; one notification per release).
    // Notification-only — the app still never self-updates.
    if (desktopSettings.silentUpdateCheck) {
      setTimeout(() => {
        void runSilentUpdateCheck({
          check: () =>
            checkForUpdates(fetch, app.getVersion(), {
              githubToken: process.env.GITHUB_TOKEN,
            }),
          statePath: join(app.getPath('userData'), 'update-check-state.json'),
          fs: fsAdapter,
          notifyUpdate: (r) =>
            notify(
              'Update available',
              `MetaCubeXD ${r.latest} is out (you run ${r.current}). Download it from GitHub Releases.`,
            ),
        })
      }, 15_000)
    }

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
  // is the classic leak (spec §4). shutdownKernel() also runs the documented
  // anti-lockout teardown (release OS proxy before the kernel dies). The
  // orchestrator guarantees it runs exactly once across the overlapping exit
  // paths below, with a 5s hard cap so a wedged helper/kernel can never hang the
  // process on exit (the critical proxy-disable step normally settles well under
  // it; recoverNetwork + the helper socket close are each independently bounded).
  const shutdown = createShutdownOrchestrator({
    shutdown: shutdownKernel,
    hardCapMs: 5000,
    onFinally: () => tray?.destroy(),
    onError: (err) => notify('Shutdown failed', err),
  })

  app.on('before-quit', (event) => {
    // Mark quit so the close tip is skipped when the window is torn down.
    isQuitting = true
    if (shutdown.hasRun()) return
    event.preventDefault()
    void shutdown.runOnce().finally(() => app.quit())
  })

  // before-quit does NOT fire on SIGINT (Ctrl-C in dev), SIGTERM (OS shutdown /
  // process-manager kill) or SIGHUP. Without these handlers any of those signals
  // would skip the anti-lockout teardown and leave the OS system proxy pointing
  // at the now-dead loopback port = whole-machine internet loss, plus an
  // orphaned sidecar. Run the same shutdown, then exit. (SIGTERM is not
  // delivered on Windows, so the packaged Windows path still relies on
  // before-quit; registering is harmless there.)
  const onSignal = (): void => {
    void shutdown.runOnce().finally(() => process.exit(0))
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)
  process.on('SIGHUP', onSignal)

  // A hard uncaughtException can terminate the process WITHOUT running
  // before-quit, re-introducing the dead-proxy lockout. Reuse the same
  // anti-lockout shutdown, then exit non-zero. unhandledRejection does not
  // terminate the process on Electron, so it is logged/notified only.
  process.on('uncaughtException', (err) => {
    // Full stack into the app log (notify() only carries the message).
    appLog?.write(String(err.stack ?? err), 'uncaught')
    notify('Unexpected error', err)
    void shutdown.runOnce().finally(() => process.exit(1))
  })
  process.on('unhandledRejection', (reason) => {
    appLog?.write(
      reason instanceof Error ? String(reason.stack ?? reason) : String(reason),
      'unhandled-rejection',
    )
    notify('Unhandled rejection', reason)
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
