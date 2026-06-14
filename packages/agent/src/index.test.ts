import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AGENT_VERSION,
  createAgent,
  createControlRouter,
  createProfileStore,
  createSupervisor,
  MIHOMO_VERSION,
  mihomoAsset,
} from './index'

function opts() {
  const home = mkdtempSync(join(tmpdir(), 'mcxd-agent-'))
  return {
    binaryPath: '/fake/mihomo',
    homeDir: home,
    activeConfigPath: join(home, 'active.yaml'),
    profilesDir: join(home, 'profiles'),
    agentToken: 'tok',
  }
}

describe('createAgent', () => {
  it('returns supervisor + profiles + router + info', () => {
    const agent = createAgent(opts())
    expect(typeof agent.supervisor.start).toBe('function')
    expect(typeof agent.profiles.list).toBe('function')
    expect(agent.router).toBeDefined()
    expect(typeof agent.info).toBe('function')
  })

  it('info() matches the §3 capability shape', () => {
    const agent = createAgent(opts())
    const info = agent.info()
    expect(info).toMatchObject({
      hasAgent: true,
      version: AGENT_VERSION,
      features: ['profiles', 'logs-sse', 'kernel-control', 'geo-assets'],
    })
    expect(info.platform).toMatchObject({
      os: process.platform,
      arch: process.arch,
    })
    expect(info.kernel).toMatchObject({ bundled: true, path: '/fake/mihomo' })
  })

  it('info().features always includes geo-assets (homeDir-backed, no controller)', () => {
    const agent = createAgent(opts())
    expect(agent.info().features).toContain('geo-assets')
  })

  it('info().features excludes system-proxy when no controller is injected', () => {
    const agent = createAgent(opts())
    expect(agent.info().features).not.toContain('system-proxy')
    expect((agent as Record<string, unknown>).systemProxy).toBeUndefined()
  })

  it('info().features includes system-proxy when a controller is injected', () => {
    const systemProxy = {
      isEnabled: async () => false,
      enable: async () => {},
      disable: async () => {},
      describe: () => ({ port: 7890, bypass: [] as string[] }),
    }
    const agent = createAgent({ ...opts(), systemProxy })
    expect(agent.info().features).toContain('system-proxy')
    expect(agent.systemProxy).toBe(systemProxy)
  })

  it('info().features excludes kernel-version when no kernelManager is injected', () => {
    const agent = createAgent(opts())
    expect(agent.info().features).not.toContain('kernel-version')
    expect((agent as Record<string, unknown>).kernelManager).toBeUndefined()
  })

  it('info().features includes kernel-version when a kernelManager is injected', () => {
    const kernelManager = {
      listVersions: async () => ({
        versions: ['v1.19.27'],
        current: 'v1.19.27',
        bundled: 'v1.19.27',
      }),
      switch: async () => {},
    }
    const agent = createAgent({ ...opts(), kernelManager })
    expect(agent.info().features).toContain('kernel-version')
    expect(agent.kernelManager).toBe(kernelManager)
  })

  it('re-exports the public surface', () => {
    expect(typeof createSupervisor).toBe('function')
    expect(typeof createProfileStore).toBe('function')
    expect(typeof createControlRouter).toBe('function')
    expect(typeof mihomoAsset).toBe('function')
    expect(MIHOMO_VERSION).toMatch(/^v\d/)
  })
})
