import type { CreateSupervisorOptions } from './supervisor'
import type {
  KernelManager,
  SystemProxyController,
  TunController,
} from './types'
import { createControlRouter } from './http'
import { MIHOMO_VERSION } from './kernel/assets'
import { createProfileStore } from './profiles'
import { applyActiveRefresh } from './refresh-apply'
import { createProfileScheduler } from './scheduler'
import { createSupervisor } from './supervisor'

export const AGENT_VERSION = '0.0.0'

export { createControlRouter } from './http'
export type { ControlRouterDeps } from './http'
export { MIHOMO_VERSION, mihomoAsset } from './kernel/assets'
export { fetchKernel, listMihomoVersions } from './kernel/fetch-kernel'
export { fetchGeoAssets, GEO_ASSET_URLS } from './kernel/geo'
export { mergeConfigs } from './merge'
export { createProfileStore } from './profiles'
export { applyActiveRefresh } from './refresh-apply'
export { createProfileScheduler } from './scheduler'
export type {
  ProfileRefreshResult,
  ProfileScheduler,
  ProfileSchedulerDeps,
} from './scheduler'
export { createScriptRunner } from './script'
export type {
  CreateScriptRunnerOptions,
  ScriptRun,
  ScriptRunner,
} from './script'
export { createSupervisor } from './supervisor'
export type { CreateSupervisorOptions, SupervisorDeps } from './supervisor'
export { buildTunConfig, TunPreconditionError } from './tun'
export * from './types'
export { createWebdavClient } from './webdav'
export type { WebdavClient, WebdavClientOptions } from './webdav'

export type CreateAgentOptions = CreateSupervisorOptions & {
  profilesDir: string
  agentToken?: string
  systemProxy?: SystemProxyController // OS proxy controller; enables 'system-proxy'
  kernelManager?: KernelManager // kernel version mgmt; enables 'kernel-version'
  tunController?: TunController // TUN mode controller; enables 'tun'
}

export interface AgentInfo {
  hasAgent: true
  version: string
  platform: { os: string; arch: string }
  kernel: { bundled: boolean; path: string; version?: string }
  features: string[]
}

export function createAgent(opts: CreateAgentOptions) {
  const profiles = createProfileStore({
    dir: opts.profilesDir,
    activeConfigPath: opts.activeConfigPath,
  })
  const supervisor = createSupervisor(opts)
  const { systemProxy, kernelManager, tunController } = opts
  const info = (): AgentInfo => ({
    hasAgent: true,
    version: AGENT_VERSION,
    platform: { os: process.platform, arch: process.arch },
    kernel: {
      bundled: true,
      path: opts.binaryPath,
      // Fall back to the bundled kernel's version when the supervisor has not
      // observed a running kernel yet (fresh launch / stopped without ever
      // starting). Otherwise the dashboard shows "-" for the kernel version
      // until the kernel runs once, even though the bundled version is known.
      version: supervisor.getState().version ?? MIHOMO_VERSION,
    },
    features: [
      'profiles',
      'logs-sse',
      'kernel-control',
      // homeDir always exists, so geo-asset download is always available.
      'geo-assets',
      // WebDAV backup/restore is always available — credentials arrive per-request.
      'webdav-backup',
      // Runtime config viewer reads the activeConfigPath file — always available.
      'runtime-config',
      // Config-section editor reads/writes top-level keys of the active profile.
      'config-sections',
      ...(systemProxy ? ['system-proxy'] : []),
      ...(kernelManager ? ['kernel-version'] : []),
      ...(tunController ? ['tun'] : []),
    ],
  })
  const router = createControlRouter({
    supervisor,
    profiles,
    info,
    homeDir: opts.homeDir,
    activeConfigPath: opts.activeConfigPath,
    token: opts.agentToken,
    systemProxy,
    kernelManager,
    tunController,
  })
  // Wire the auto-update scheduler to the same profiles store. NOT started here
  // — the server boot plugin starts it (the desktop builds its own scheduler so
  // it can surface per-refresh notifications, and does NOT start this one).
  //
  // Auto-update should take effect, not just refresh a stored file: when a
  // scheduled refresh hits the ACTIVE base, re-compose + restart so the running
  // kernel actually picks up the new subscription (#2107). Best-effort and
  // fire-and-forget (the scheduler never awaits onResult) — a failing apply must
  // not wedge the tick loop; the next tick retries.
  const scheduler = createProfileScheduler({
    profiles,
    onResult: (r) => {
      if (!r.ok) return
      // Auto-update should take effect, not just refresh a stored file: when a
      // scheduled refresh hits the ACTIVE base, re-compose + restart so the
      // running kernel picks up the new subscription (#2107). Best-effort and
      // fire-and-forget (the scheduler never awaits onResult) — a failing apply
      // must not wedge the tick loop; the next tick retries.
      void applyActiveRefresh(profiles, supervisor, r.id).catch(() => {})
    },
  })
  return {
    supervisor,
    profiles,
    router,
    info,
    scheduler,
    systemProxy,
    kernelManager,
    tunController,
  }
}
