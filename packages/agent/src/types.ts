export type KernelStatus =
  'stopped' | 'starting' | 'running' | 'stopping' | 'errored'

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
  setBinaryPath: (path: string) => void // takes effect on the NEXT start/validate
  validate: (configPath: string) => Promise<{ valid: boolean; message: string }>
  on: ((event: 'log', cb: (l: KernelLogLine) => void) => void) &
    ((event: 'state', cb: (s: KernelState) => void) => void)
  // Unregister a callback previously passed to on(). Symmetric to on() so
  // long-lived subscribers (the SSE /kernel/logs handler) can detach on
  // disconnect instead of leaking a closure into the callback set per request.
  off: ((event: 'log', cb: (l: KernelLogLine) => void) => void) &
    ((event: 'state', cb: (s: KernelState) => void) => void)
  dispose: () => Promise<void>
}

// Manages the mihomo kernel binary: enumerate downloaded/bundled versions and
// switch the active one (download + persist + live swap is the impl's concern).
export interface KernelManager {
  listVersions: () => Promise<{
    versions: string[]
    current?: string
    bundled: string
  }>
  switch: (version: string) => Promise<void>
}

// Controls TUN mode: inject/remove the mihomo `tun:` block and (re)start the
// kernel with the privilege needed to build the virtual device. Every OS /
// privilege / process side effect lives behind this interface — the desktop
// impl injects the real elevation/helper-IPC; tests use a fake.
export interface TunController {
  enable: (opts: { stack: string }) => Promise<void>
  disable: () => Promise<void>
  status: () => Promise<{
    enabled: boolean
    mode: 'sidecar' | 'tun'
    stack?: string
  }>
  /**
   * Remove the privileged helper service entirely. Tears TUN down to the sidecar
   * first if it is active (never unregister a service that's still owning the
   * kernel), then unregisters the OS service. Optional: a controller built
   * without the uninstall dependency omits it, and the control router exposes the
   * `/tun/uninstall` route only when it is present (clean 404 otherwise).
   */
  uninstall?: () => Promise<void>
}

export interface SystemProxyController {
  isEnabled: () => Promise<boolean>
  enable: (bypass?: string[]) => Promise<void> // uses host:port configured at construction
  disable: () => Promise<void> // clears BOTH fixed and PAC/auto-config state (anti-lockout)
  // PAC (auto-config) mode: point the OS at a proxy-auto-config URL.
  setAutoProxy: (url: string) => Promise<void>
  disableAutoProxy: () => Promise<void>
  describe: () => { port: number; bypass: string[] }
}

export type ProfileType = 'local' | 'remote' | 'merge' | 'script'

export interface ProfileMeta {
  id: string
  name: string
  type: ProfileType
  enabled?: boolean // merge/script-only; treat undefined as true (overlay/transform is applied)
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
  create: (i: {
    name: string
    content?: string
    type?: 'local' | 'merge' | 'script'
  }) => Promise<ProfileMeta>
  update: (
    id: string,
    p: {
      name?: string
      content?: string
      enabled?: boolean
      // minutes; only meaningful for remote profiles (drives the scheduler).
      // 0 disables auto-update; omit leaves the stored value untouched.
      updateInterval?: number
    },
  ) => Promise<ProfileMeta>
  delete: (id: string) => Promise<void>
  duplicate: (id: string, name?: string) => Promise<ProfileMeta>
  importFromUrl: (url: string, name?: string) => Promise<ProfileMeta> // UA 'clash.meta'
  refresh: (id: string) => Promise<ProfileMeta> // re-fetch a remote profile in place
  getActiveId: () => Promise<string | undefined>
  setActive: (id: string) => Promise<void> // validate + write activeConfigPath
  // Restore the last-known-good active config (activeConfigPath.bak written by
  // the previous setActive). Returns false when no backup exists (#2109).
  rollback: () => Promise<boolean>
  // Clear the active config to a minimal (header-only) file and drop activeId so
  // a broken persisted config can't keep bricking the kernel on boot (#2109).
  resetActive: () => Promise<void>
  // Read a single top-level key from a profile's parsed YAML (null if absent /
  // the content is not a mapping).
  getSection: (id: string, key: string) => Promise<unknown>
  // Replace a single top-level key in a profile's YAML and persist it back,
  // preserving every other key. A null/undefined value deletes the key.
  setSection: (id: string, key: string, value: unknown) => Promise<void>
}
