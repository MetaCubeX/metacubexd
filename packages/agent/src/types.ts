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
  version?: string // captured from Clash GET /version once ready
  externalController: string // e.g. '127.0.0.1:9090' — UI points here
  secret: string // Clash API secret (also written into config)
  lastExitCode?: number | null
  lastError?: string
}

export interface SupervisorOptions {
  binaryPath: string // resolved mihomo (.exe on win)
  homeDir: string // mihomo -d working dir (writable)
  activeConfigPath: string // mihomo -f target (managed by ProfileStore)
  startTimeoutMs?: number // default 10_000
  stopTimeoutMs?: number // default 5_000
  autoRestart?: boolean // crash watchdog; default true
  maxRestarts?: number // consecutive auto-restarts before giving up; default 3
  restartBackoffMs?: number // delay before each auto-restart; default 1_000
  stableRestartMs?: number // running this long resets the crash counter; default 30_000
}

export interface KernelLogLine {
  stream: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface MihomoSupervisor {
  getState: () => KernelState
  start: () => Promise<KernelState>
  stop: () => Promise<KernelState>
  restart: () => Promise<KernelState>
  validate: (configPath: string) => Promise<{ valid: boolean; message: string }>
  on: ((event: 'log', cb: (l: KernelLogLine) => void) => void) &
    ((event: 'state', cb: (s: KernelState) => void) => void)
  dispose: () => Promise<void>
}

export interface SystemProxyController {
  isEnabled: () => Promise<boolean>
  enable: (bypass?: string[]) => Promise<void> // uses host:port configured at construction
  disable: () => Promise<void>
  describe: () => { port: number; bypass: string[] }
}

export type ProfileType = 'local' | 'remote'

export interface ProfileMeta {
  id: string
  name: string
  type: ProfileType
  url?: string
  userAgent?: string
  updateInterval?: number // minutes; only meaningful for remote profiles
  updatedAt: number
  subscriptionInfo?: {
    upload: number
    download: number
    total: number
    expire: number
  }
}

export interface ProfileStore {
  list: () => Promise<ProfileMeta[]>
  read: (id: string) => Promise<string> // raw YAML
  create: (i: { name: string; content?: string }) => Promise<ProfileMeta>
  update: (
    id: string,
    p: { name?: string; content?: string },
  ) => Promise<ProfileMeta>
  delete: (id: string) => Promise<void>
  duplicate: (id: string, name?: string) => Promise<ProfileMeta>
  importFromUrl: (url: string, name?: string) => Promise<ProfileMeta> // UA 'clash.meta'
  refresh: (id: string) => Promise<ProfileMeta> // re-fetch a remote profile in place
  getActiveId: () => Promise<string | undefined>
  setActive: (id: string) => Promise<void> // validate + write activeConfigPath
}
