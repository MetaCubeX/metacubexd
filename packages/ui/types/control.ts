// packages/ui/types/control.ts

// Mirror of @metacubexd/agent KernelStatus / KernelState (SHARED CONTRACTS).
// UI-local copies: the UI builds standalone (gh-pages) and never imports the agent.
export type KernelStatus =
  'stopped' | 'starting' | 'running' | 'stopping' | 'errored'

export interface KernelState {
  status: KernelStatus
  pid?: number
  startedAt?: number // uptimeMs = Date.now() - startedAt
  version?: string
  externalController: string
  secret: string
  lastExitCode?: number | null
  lastError?: string
}

export type ProfileType = 'local' | 'remote' | 'merge' | 'script'

export interface ProfileSubscriptionInfo {
  upload: number
  download: number
  total: number
  expire: number
}

export interface ProfileMeta {
  id: string
  name: string
  type: ProfileType
  // merge/script-only: a disabled merge overlay (or script transform) is skipped
  // when composing the active config. Treat undefined as enabled (the
  // overlay/transform is applied). SHARED CONTRACTS.
  enabled?: boolean
  url?: string
  userAgent?: string
  // minutes; remote-only. Drives the AIO server's auto-update scheduler (0 or
  // undefined => auto-update off). SHARED CONTRACTS.
  updateInterval?: number
  baseProfileId?: string
  managedBy?: 'visual-editor'
  editorStatus?: 'clean' | 'conflicted'
  updatedAt: number
  subscriptionInfo?: ProfileSubscriptionInfo
  // Derived (not stored): true on the base profile the agent recorded as the
  // active one in state.json. Lets the profiles page persistently mark the
  // active card instead of losing the badge on reload (#2148).
  active?: boolean
}

// GET /api/control/info
export type ControlFeature =
  | 'profiles'
  | 'logs-sse'
  | 'kernel-control'
  | 'system-proxy'
  | 'kernel-version'
  | 'geo-assets'
  | 'webdav-backup'
  | 'runtime-config'
  | 'config-sections'
  | 'visual-config-editor'
  | 'tun'

export interface ProfileEditorSnapshot {
  profile: ProfileMeta
  active: boolean
  revision: string
  editableYaml: string
  composedYaml: string
  schemaVersion: string
  composition: ProfileMeta[]
  diagnostics: Array<{
    path: Array<string | number>
    code: string
    message: string
    severity: 'error' | 'warning'
  }>
  conflicts: Array<{
    operation: import('@metacubexd/config-editor').ConfigPatchOperation
    path: Array<string | number>
    reason: 'changed' | 'missing' | 'duplicate' | 'invalid-target'
    current?: unknown
  }>
}

export interface ProfileEditorPreview extends ProfileEditorSnapshot {
  patch: import('@metacubexd/config-editor').ConfigPatchV1
}
export interface ControlInfo {
  hasAgent: boolean
  version: string
  platform: { os: string; arch: string }
  kernel: { bundled: boolean; path: string; version?: string }
  features: ControlFeature[]
}

// One frame off the SSE stream GET /api/control/kernel/logs.
// The 'state' frame is FLAT (the agent spreads KernelState at the top level,
// matching the flat 'log' frame) — SHARED CONTRACTS.
export type ControlLogEvent =
  | { type: 'log'; stream: 'stdout' | 'stderr'; line: string; ts: number }
  | ({ type: 'state' } & KernelState)

// GET /api/control/profiles/:id
export interface ProfileDetail {
  meta: ProfileMeta
  content: string
}

// POST /api/control/profiles/:id/validate
export interface ValidateResult {
  valid: boolean
  message: string
}

// GET/POST /api/control/sysproxy (capability-gated 'system-proxy').
// The GET reflects the controller's isEnabled() + describe(); the POST body is
// { enabled, bypass? } and the response echoes the same shape (SHARED CONTRACTS).
export interface SystemProxyState {
  enabled: boolean
  port: number
  bypass: string[]
}

// GET /api/control/kernel/versions (capability-gated 'kernel-version').
// Mirror of @metacubexd/agent KernelManager.listVersions() (SHARED CONTRACTS).
export interface KernelVersions {
  versions: string[]
  current?: string
  bundled: string
}

// POST /api/control/geo/update (capability-gated 'geo-assets'). Downloads the
// geoip/geosite/mmdb databases into the kernel home dir (SHARED CONTRACTS).
export interface GeoUpdateResult {
  ok: boolean
  files: string[]
}

// WebDAV backup/restore (capability-gated 'webdav-backup'). Credentials are
// sent per-request — the agent never persists them (SHARED CONTRACTS).
export interface WebdavCredentials {
  url: string
  username: string
  password: string
  dir?: string
}

// POST /api/control/backup { webdav, uiSettings? } -> { ok, path }. The agent
// bundles every profile (meta + content) and the supplied uiSettings object.
export interface WebdavBackupResult {
  ok: boolean
  path: string
}

// POST /api/control/restore { webdav } -> { ok, restored, uiSettings? }. The
// agent recreates each backed-up profile and echoes the stored uiSettings so
// the UI can re-apply its localStorage snapshot.
export interface WebdavRestoreResult {
  ok: boolean
  restored: number
  uiSettings?: unknown
}

// GET/POST /api/control/tun (capability-gated 'tun'). Mirror of @metacubexd/agent
// TunController.status() (SHARED CONTRACTS). `mode` distinguishes the default
// in-process sidecar (no TUN) from the privileged helper-spawned TUN runtime.
// GET reflects the current state; POST body is { enabled, stack? } and the
// response echoes this same shape. Toggling installs/elevates the helper +
// (re)starts the kernel, so callers should treat it as a slow operation.
export interface TunStatus {
  enabled: boolean
  mode: 'sidecar' | 'tun'
  stack?: string
}
