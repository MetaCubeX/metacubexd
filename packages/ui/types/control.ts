// packages/ui/types/control.ts

// Mirror of @metacubexd/agent KernelStatus / KernelState (SHARED CONTRACTS).
// UI-local copies: the UI builds standalone (gh-pages) and never imports the agent.
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
  version?: string
  externalController: string
  secret: string
  lastExitCode?: number | null
  lastError?: string
}

export type ProfileType = 'local' | 'remote' | 'merge'

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
  // merge-only: a disabled merge overlay is skipped when composing the active
  // config. Treat undefined as enabled (the overlay is applied). SHARED CONTRACTS.
  enabled?: boolean
  url?: string
  userAgent?: string
  updatedAt: number
  subscriptionInfo?: ProfileSubscriptionInfo
}

// GET /api/control/info
export type ControlFeature =
  | 'profiles'
  | 'logs-sse'
  | 'kernel-control'
  | 'system-proxy'
  | 'kernel-version'
  | 'geo-assets'
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
