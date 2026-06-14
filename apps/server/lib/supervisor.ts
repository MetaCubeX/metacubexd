import { join } from 'node:path'
import { createAgent } from '@metacubexd/agent'

/** Parsed server runtime config, sourced entirely from env. */
export interface ServerEnv {
  controlPort: number
  clashApiPort: number
  mixedPort: number
  dataDir: string
  mihomoBin: string
  controlToken: string
  clashSecret: string
}

function int(value: string | undefined, fallback: number): number {
  const n = value == null ? Number.NaN : Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Read process.env into a typed ServerEnv with documented defaults. */
export function serverEnv(): ServerEnv {
  return {
    controlPort: int(process.env.CONTROL_PORT, 8080),
    clashApiPort: int(process.env.CLASH_API_PORT, 9090),
    mixedPort: int(process.env.MIXED_PORT, 7890),
    dataDir: process.env.DATA_DIR ?? '/data',
    mihomoBin: process.env.MIHOMO_BIN ?? '/usr/local/bin/mihomo',
    controlToken: process.env.CONTROL_TOKEN ?? '',
    clashSecret: process.env.CLASH_SECRET ?? '',
  }
}

export type Agent = ReturnType<typeof createAgent>

let agentSingleton: Agent | undefined

/**
 * Module-singleton agent. Built once per process from serverEnv():
 * homeDir/profilesDir/activeConfigPath live under DATA_DIR; the kernel binary
 * is MIHOMO_BIN; agentToken comes from CONTROL_TOKEN (empty => unauthenticated,
 * which the auth middleware treats as "no token configured").
 */
export function getAgent(): Agent {
  if (agentSingleton) return agentSingleton
  const env = serverEnv()
  agentSingleton = createAgent({
    binaryPath: env.mihomoBin,
    homeDir: env.dataDir,
    profilesDir: join(env.dataDir, 'profiles'),
    activeConfigPath: join(env.dataDir, 'active.yaml'),
    agentToken: env.controlToken || undefined,
    // The agent's supervisor injects these into the active config before
    // spawning mihomo (per Plan 02). external-controller must bind 0.0.0.0 so
    // the published container port is reachable; secret is CLASH_SECRET.
    externalController: `0.0.0.0:${env.clashApiPort}`,
    secret: env.clashSecret,
  })
  return agentSingleton
}

/** Test-only reset hook. */
export function __resetAgentForTests(): void {
  agentSingleton = undefined
}
