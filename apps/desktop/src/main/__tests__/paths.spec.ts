import { describe, expect, it } from 'vitest'
import { bootstrapDataDir, dataPaths } from '../paths'

describe('dataPaths', () => {
  it('derives the home/profiles/active/state layout under userData', () => {
    const p = dataPaths('/u/data')
    expect(p).toEqual({
      homeDir: '/u/data/mihomo-home',
      profilesDir: '/u/data/mihomo-home/profiles',
      activeConfigPath: '/u/data/mihomo-home/config.yaml',
      stateFile: '/u/data/mihomo-home/state.json',
    })
  })
})

function fakeFs(existing: Set<string>) {
  const writes: Record<string, string> = {}
  const made: string[] = []
  return {
    writes,
    made,
    io: {
      existsSync: (p: string) => existing.has(p),
      mkdirSync: (p: string) => {
        made.push(p)
        existing.add(p)
      },
      readFileSync: (p: string) => {
        if (p === '/res/default-config.yaml') return 'mixed-port: 7890\n'
        throw new Error(`unexpected read ${p}`)
      },
      writeFileSync: (p: string, data: string) => {
        writes[p] = data
        existing.add(p)
      },
    },
  }
}

describe('bootstrapDataDir', () => {
  it('creates dirs and copies default config on first run', () => {
    const { io, writes, made } = fakeFs(new Set())
    const result = bootstrapDataDir('/u/data', '/res/default-config.yaml', io)

    expect(made).toContain('/u/data/mihomo-home')
    expect(made).toContain('/u/data/mihomo-home/profiles')
    expect(writes['/u/data/mihomo-home/config.yaml']).toBe('mixed-port: 7890\n')
    expect(result.copiedDefault).toBe(true)
    expect(result.activeConfigPath).toBe('/u/data/mihomo-home/config.yaml')
  })

  it('does NOT overwrite an existing active config (idempotent)', () => {
    const existing = new Set([
      '/u/data/mihomo-home',
      '/u/data/mihomo-home/profiles',
      '/u/data/mihomo-home/config.yaml',
    ])
    const { io, writes } = fakeFs(existing)
    const result = bootstrapDataDir('/u/data', '/res/default-config.yaml', io)

    expect(writes['/u/data/mihomo-home/config.yaml']).toBeUndefined()
    expect(result.copiedDefault).toBe(false)
  })
})
