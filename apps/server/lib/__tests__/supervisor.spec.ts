import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the agent so we can assert how the server wires env -> createAgent,
// without spawning a real kernel.
const createAgentMock = vi.fn((_opts: Record<string, unknown>) => ({
  supervisor: { getState: () => ({ status: 'stopped' }) },
  profiles: {},
  router: { __isRouter: true },
  info: () => ({ hasAgent: true }),
}))
vi.mock('@metacubexd/agent', () => ({
  createAgent: createAgentMock,
}))

describe('apps/server lib/supervisor', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    createAgentMock.mockClear()
    process.env = { ...ORIGINAL }
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  it('reads server env into a typed config with documented defaults', async () => {
    delete process.env.CONTROL_PORT
    delete process.env.CLASH_API_PORT
    delete process.env.MIXED_PORT
    delete process.env.DATA_DIR
    delete process.env.MIHOMO_BIN
    delete process.env.CLASH_SECRET
    delete process.env.CONTROL_TOKEN
    delete process.env.GITHUB_TOKEN
    const { serverEnv } = await import('../supervisor')
    const env = serverEnv()
    expect(env.controlPort).toBe(8080)
    expect(env.clashApiPort).toBe(9090)
    expect(env.mixedPort).toBe(7890)
    expect(env.dataDir).toBe('/data')
    expect(env.mihomoBin).toBe('/usr/local/bin/mihomo')
    expect(env.githubToken).toBe('')
  })

  it('honours overridden ports/paths from env', async () => {
    process.env.CONTROL_PORT = '18080'
    process.env.CLASH_API_PORT = '19090'
    process.env.MIXED_PORT = '17890'
    process.env.DATA_DIR = '/srv/data'
    process.env.MIHOMO_BIN = '/opt/mihomo'
    process.env.GITHUB_TOKEN = 'github-token'
    const { serverEnv } = await import('../supervisor')
    const env = serverEnv()
    expect(env.controlPort).toBe(18080)
    expect(env.clashApiPort).toBe(19090)
    expect(env.mixedPort).toBe(17890)
    expect(env.dataDir).toBe('/srv/data')
    expect(env.mihomoBin).toBe('/opt/mihomo')
    expect(env.githubToken).toBe('github-token')
  })

  it('builds the agent exactly once with env-derived options (singleton)', async () => {
    process.env.DATA_DIR = '/data'
    process.env.MIHOMO_BIN = '/usr/local/bin/mihomo'
    process.env.CLASH_API_PORT = '9090'
    process.env.CLASH_SECRET = 'clash-x'
    process.env.CONTROL_TOKEN = 'agent-tok'
    const { getAgent } = await import('../supervisor')
    const a = getAgent()
    const b = getAgent()
    expect(a).toBe(b)
    expect(createAgentMock).toHaveBeenCalledTimes(1)
    const opts = createAgentMock.mock.calls[0]![0]
    expect(opts.binaryPath).toBe('/usr/local/bin/mihomo')
    expect(opts.homeDir).toBe('/data')
    expect(opts.profilesDir).toBe('/data/profiles')
    expect(opts.activeConfigPath).toBe('/data/active.yaml')
    expect(opts.agentToken).toBe('agent-tok')
    expect(opts.externalController).toBe('0.0.0.0:9090')
    expect(opts.secret).toBe('clash-x')
    // MIXED_PORT must reach the supervisor or the published 7890 stays closed (#2067).
    expect(opts.mixedPort).toBe(7890)
  })
})
