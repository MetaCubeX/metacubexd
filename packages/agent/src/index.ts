import type { CreateSupervisorOptions } from './supervisor'
import { createControlRouter } from './http'
import { createProfileStore } from './profiles'
import { createSupervisor } from './supervisor'

export const AGENT_VERSION = '0.0.0'

export { createControlRouter } from './http'
export type { ControlRouterDeps } from './http'
export { MIHOMO_VERSION, mihomoAsset } from './kernel/assets'
export { fetchKernel } from './kernel/fetch-kernel'
export { createProfileStore } from './profiles'
export { createSupervisor } from './supervisor'
export type { CreateSupervisorOptions, SupervisorDeps } from './supervisor'
export * from './types'

export type CreateAgentOptions = CreateSupervisorOptions & {
  profilesDir: string
  agentToken?: string
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
  const info = (): AgentInfo => ({
    hasAgent: true,
    version: AGENT_VERSION,
    platform: { os: process.platform, arch: process.arch },
    kernel: {
      bundled: true,
      path: opts.binaryPath,
      version: supervisor.getState().version,
    },
    features: ['profiles', 'logs-sse', 'kernel-control'],
  })
  const router = createControlRouter({
    supervisor,
    profiles,
    info,
    homeDir: opts.homeDir,
    token: opts.agentToken,
  })
  return { supervisor, profiles, router, info }
}
