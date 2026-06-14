import type {Tray} from 'electron';
import type {ControlServer} from './control-server';
import type {FsLike} from './paths';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { createAgent } from '@metacubexd/agent'
import { app, BrowserWindow  } from 'electron'
import { resolveMihomoBinary } from './binary-path'
import {
  
  startControlServer,
  stopControlServer
} from './control-server'
import { pickFreePorts } from './free-port'
import { bootstrapDataDir  } from './paths'
import { makeToken } from './secrets'
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

function defaultConfigSource(): string {
  // packaged -> process.resourcesPath/default-config.yaml ; dev -> repo resources
  return app.isPackaged
    ? join(process.resourcesPath, 'default-config.yaml')
    : join(app.getAppPath(), 'resources', 'default-config.yaml')
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

  // Pick two distinct free loopback ports: [controlPort, clashPort].
  const [controlPort, clashPort] = (await pickFreePorts(2)) as [number, number]
  const controlToken = makeToken()
  const clashSecret = makeToken()

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
  })

  controlServer = await startControlServer(agent.router, controlPort)

  // Start the kernel; capture the bound external-controller + secret.
  const state = await agent.supervisor.start()

  // Inject the renderer bridge env (consumed by preload/index.ts).
  process.env.MCXD_CONTROL_BASE = `http://127.0.0.1:${controlPort}/api/control`
  process.env.MCXD_CONTROL_TOKEN = controlToken
  process.env.MCXD_CLASH_URL = `http://${state.externalController}`
  process.env.MCXD_CLASH_SECRET = state.secret
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  win.once('ready-to-show', () => win?.show())
  // UI is CSR + hashMode + relative baseURL -> loadFile works over file://.
  void win.loadFile(join(__dirname, '..', '..', 'renderer', 'index.html'))
}

async function shutdownKernel(): Promise<void> {
  try {
    await agent?.supervisor.stop()
  } catch {
    /* ignore */
  }
  if (controlServer) await stopControlServer(controlServer)
}

// Single-instance lock: focus the existing window on a second launch.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    await boot()
    createWindow()
    tray = createTray({
      getWindow: () => win,
      startKernel: () => void agent?.supervisor.start(),
      stopKernel: () => void agent?.supervisor.stop(),
      quit: () => app.quit(),
      iconPath: trayIconPath(),
    })
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
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
