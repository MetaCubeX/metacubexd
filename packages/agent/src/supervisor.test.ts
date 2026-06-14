import type { SupervisorOptions } from './types'
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createSupervisor } from './supervisor'

// Minimal ChildProcess double: stdout/stderr emitters + kill spy + emit-exit helper.
class FakeProc extends EventEmitter {
  pid = 4242
  killed = false
  killSignals: string[] = []
  stdout = new EventEmitter()
  stderr = new EventEmitter()
  kill(sig?: string) {
    this.killSignals.push(sig ?? 'SIGTERM')
    this.killed = true
    // Simulate OS reaping the process shortly after kill (needed for doStop's await exited).
    setImmediate(() => this.emitExit(null, sig ?? 'SIGTERM'))
    return true
  }
  // Test helper to simulate the OS reaping the process.
  emitExit(code: number | null, signal: string | null = null) {
    this.emit('exit', code, signal)
  }
}

function baseOpts(): SupervisorOptions {
  const dir = mkdtempSync(join(tmpdir(), 'mcxd-sup-'))
  return {
    binaryPath: '/fake/mihomo',
    homeDir: dir,
    activeConfigPath: join(dir, 'active.yaml'),
    startTimeoutMs: 1000,
    stopTimeoutMs: 500,
  }
}

describe('createSupervisor — initial state', () => {
  it('starts in stopped with default external-controller + a secret', () => {
    const sup = createSupervisor(baseOpts())
    const s = sup.getState()
    expect(s.status).toBe('stopped')
    expect(s.externalController).toBe('127.0.0.1:9090')
    expect(typeof s.secret).toBe('string')
    expect(s.pid).toBeUndefined()
  })

  it('honors injected externalController + secret', () => {
    const sup = createSupervisor({
      ...baseOpts(),
      externalController: '0.0.0.0:9090',
      secret: 'topsecret',
    })
    expect(sup.getState().externalController).toBe('0.0.0.0:9090')
    expect(sup.getState().secret).toBe('topsecret')
  })

  it('spawns mihomo with -d homeDir -f activeConfigPath and goes starting->running on ready', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    let versionCalls = 0
    const fetchMock = vi.fn(async (url: string) => {
      versionCalls++
      expect(url).toContain('/version')
      // First poll: 200 with version => ready.
      return new Response(JSON.stringify({ version: '1.19.27' }), {
        status: 200,
      })
    })
    const sup = createSupervisor(
      { ...opts, secret: 'sek', externalController: '127.0.0.1:9090' },
      {
        spawn: spawn as never,
        fetch: fetchMock as unknown as typeof fetch,
      },
    )

    const states: string[] = []
    sup.on('state', (st) => states.push(st.status))

    const result = await sup.start()
    expect(spawn).toHaveBeenCalledOnce()
    const [bin, args] = spawn.mock.calls[0]!
    expect(bin).toBe('/fake/mihomo')
    expect(args).toEqual(['-d', opts.homeDir, '-f', opts.activeConfigPath])
    expect(result.status).toBe('running')
    expect(result.version).toBe('1.19.27')
    expect(result.pid).toBe(4242)
    expect(states).toContain('starting')
    expect(states).toContain('running')
    expect(versionCalls).toBeGreaterThanOrEqual(1)
    await sup.dispose()
  })

  it('injects external-controller/secret/mixed-port into the active config before spawn (stripping profile values)', async () => {
    const opts = baseOpts()
    // Profile carried its own (conflicting) clash-api + mixed-port lines.
    writeFileSync(
      opts.activeConfigPath,
      'mixed-port: 1111\nexternal-controller: 1.2.3.4:1\nsecret: profilesecret\nproxies: []\n',
    )
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const sup = createSupervisor(
      {
        ...opts,
        externalController: '0.0.0.0:9090',
        secret: 'managed',
        mixedPort: 7890,
      },
      {
        spawn: spawn as never,
        fetch: (async () =>
          new Response(JSON.stringify({ version: '1' }), {
            status: 200,
          })) as unknown as typeof fetch,
      },
    )
    await sup.start()
    const written = readFileSync(opts.activeConfigPath, 'utf8')
    // Managed values are prepended exactly once...
    expect(written).toContain('external-controller: 0.0.0.0:9090')
    expect(written).toContain('secret: managed')
    expect(written).toContain('mixed-port: 7890')
    // ...and the profile's conflicting top-level values are gone.
    expect(written).not.toContain('external-controller: 1.2.3.4:1')
    expect(written).not.toContain('secret: profilesecret')
    expect(written).not.toContain('mixed-port: 1111')
    // Non-conflicting profile content survives.
    expect(written).toContain('proxies: []')
    // mixed-port is only written when mixedPort is provided.
    expect(written.match(/^external-controller:/gm)).toHaveLength(1)
    await sup.dispose()
  })

  it('omits mixed-port when mixedPort is not provided', async () => {
    const opts = baseOpts()
    writeFileSync(opts.activeConfigPath, 'proxies: []\n')
    const proc = new FakeProc()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: (async () =>
        new Response(JSON.stringify({ version: '1' }), {
          status: 200,
        })) as unknown as typeof fetch,
    })
    await sup.start()
    const written = readFileSync(opts.activeConfigPath, 'utf8')
    expect(written).toContain('external-controller: 127.0.0.1:9090')
    expect(written).not.toContain('mixed-port:')
    await sup.dispose()
  })

  it('emits log lines from stdout/stderr', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: (async () =>
        new Response(JSON.stringify({ version: '1' }), {
          status: 200,
        })) as unknown as typeof fetch,
    })
    const logs: string[] = []
    sup.on('log', (l) => logs.push(`${l.stream}:${l.line}`))
    await sup.start()
    proc.stdout.emit('data', Buffer.from('hello\nworld\n'))
    proc.stderr.emit('data', Buffer.from('oops\n'))
    expect(logs).toContain('stdout:hello')
    expect(logs).toContain('stdout:world')
    expect(logs).toContain('stderr:oops')
    await sup.dispose()
  })

  it('goes errored if the process exits before ready', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      // /version never returns 200 (simulate not-yet-up)
      fetch: (async () =>
        new Response('conn refused', {
          status: 500,
        })) as unknown as typeof fetch,
    })
    const startP = sup.start()
    // Simulate the kernel crashing on startup.
    setTimeout(() => proc.emitExit(1, null), 10)
    const st = await startP
    expect(st.status).toBe('errored')
    expect(st.lastExitCode).toBe(1)
  })
})
