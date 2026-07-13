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
    const [bin, args] = (
      spawn.mock.calls as unknown as [string, string[]][]
    )[0]!
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

  it('polls loopback, not the 0.0.0.0 wildcard bind host, for readiness (#2098)', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const urls: string[] = []
    const sup = createSupervisor(
      { ...opts, externalController: '0.0.0.0:9090' },
      {
        spawn: (() => proc) as never,
        fetch: (async (url: string) => {
          urls.push(url)
          return new Response(JSON.stringify({ version: '1' }), { status: 200 })
        }) as unknown as typeof fetch,
      },
    )
    await sup.start()
    // The bind address stays 0.0.0.0, but the client poll must hit loopback,
    // else a host that can't connect to 0.0.0.0 SIGKILLs a healthy kernel.
    expect(urls[0]).toBe('http://127.0.0.1:9090/version')
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
    expect(
      written
        .split('\n')
        .filter((line) => line.startsWith('external-controller:')),
    ).toHaveLength(1)
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

  it('off() stops delivering log/state events to an unregistered callback', async () => {
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
    const onLog = (l: { stream: string; line: string }) =>
      logs.push(`${l.stream}:${l.line}`)
    sup.on('log', onLog)
    await sup.start()
    proc.stdout.emit('data', Buffer.from('first\n'))
    expect(logs).toContain('stdout:first')
    // After off(), further log lines must not reach the callback.
    sup.off('log', onLog)
    proc.stdout.emit('data', Buffer.from('second\n'))
    expect(logs).not.toContain('stdout:second')
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
    // Crash the process only once it has actually spawned (state carries a
    // pid, so doStart has already wired its exit handler). A wall-clock
    // setTimeout raced doStart's async config-inject: under load the exit fired
    // before the listener was attached, was dropped, and the supervisor timed
    // out reporting errored with NO exit code (flaky #242).
    sup.on('state', (s) => {
      if (s.status === 'starting' && s.pid !== undefined) {
        queueMicrotask(() => proc.emitExit(1, null))
      }
    })
    const st = await sup.start()
    expect(st.status).toBe('errored')
    expect(st.lastExitCode).toBe(1)
    await sup.dispose()
  })
})

describe('createSupervisor — stop / restart / tree-kill / mutex', () => {
  function ready200() {
    return (async () =>
      new Response(JSON.stringify({ version: '1.19.27' }), {
        status: 200,
      })) as unknown as typeof fetch
  }

  it('stop sends SIGTERM then resolves stopped when the process exits in time', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
    })
    await sup.start()
    const stopP = sup.stop()
    // Process exits shortly after SIGTERM (before stopTimeoutMs).
    setTimeout(() => proc.emitExit(0, 'SIGTERM'), 5)
    const st = await stopP
    expect(proc.killSignals[0]).toBe('SIGTERM')
    expect(proc.killSignals).not.toContain('SIGKILL')
    expect(st.status).toBe('stopped')
    expect(st.pid).toBeUndefined()
  })

  it('stop escalates to SIGKILL after stopTimeoutMs if the process ignores SIGTERM', async () => {
    const opts = { ...baseOpts(), stopTimeoutMs: 30 }
    const proc = new FakeProc()
    // Override kill so SIGTERM is ignored (no auto-exit) but SIGKILL exits the process.
    proc.kill = (sig?: string) => {
      const s = sig ?? 'SIGTERM'
      proc.killSignals.push(s)
      proc.killed = true
      if (s === 'SIGKILL') {
        // Only exit on SIGKILL, not SIGTERM — simulates a process that ignores SIGTERM.
        setImmediate(() => proc.emitExit(null, 'SIGKILL'))
      }
      return true
    }
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
    })
    await sup.start()
    const st = await sup.stop()
    expect(proc.killSignals[0]).toBe('SIGTERM')
    expect(proc.killSignals).toContain('SIGKILL')
    expect(st.status).toBe('stopped')
  })

  it('on win32 stop routes through tree-kill instead of child.kill', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const treeKill = vi.fn(
      (_pid: number, _sig: string, cb?: (e?: Error) => void) => cb?.(),
    )
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
      treeKill,
      platform: 'win32',
    })
    await sup.start()
    const stopP = sup.stop()
    setTimeout(() => proc.emitExit(0, null), 5)
    await stopP
    expect(treeKill).toHaveBeenCalledWith(4242, 'SIGTERM')
    expect(proc.killSignals).toEqual([]) // child.kill NOT used on win32
  })

  it('restart = stop then start through one mutex', async () => {
    const opts = baseOpts()
    const procs: FakeProc[] = []
    const spawn = vi.fn(() => {
      const p = new FakeProc()
      p.pid = 1000 + procs.length
      procs.push(p)
      // Override kill so it emits exit exactly once (don't call the inherited auto-exit
      // to avoid double-emission that corrupts the second doStart).
      p.kill = (sig?: string) => {
        p.killSignals.push(sig ?? 'SIGTERM')
        p.killed = true
        setImmediate(() => p.emitExit(0, sig ?? null))
        return true
      }
      return p
    })
    const sup = createSupervisor(opts, {
      spawn: spawn as never,
      fetch: ready200(),
    })
    await sup.start()
    const st = await sup.restart()
    expect(spawn).toHaveBeenCalledTimes(2)
    expect(st.status).toBe('running')
    expect(st.pid).toBe(1001)
    await sup.dispose()
  })

  it('setBinaryPath makes the NEXT start spawn the new path', async () => {
    const opts = baseOpts()
    const procs: FakeProc[] = []
    const spawn = vi.fn(() => {
      const p = new FakeProc()
      p.pid = 5000 + procs.length
      procs.push(p)
      p.kill = (sig?: string) => {
        p.killSignals.push(sig ?? 'SIGTERM')
        p.killed = true
        setImmediate(() => p.emitExit(0, sig ?? null))
        return true
      }
      return p
    })
    const sup = createSupervisor(opts, {
      spawn: spawn as never,
      fetch: ready200(),
    })
    await sup.start()
    const [firstBin] = (spawn.mock.calls as unknown as [string, string[]][])[0]!
    expect(firstBin).toBe(opts.binaryPath)

    // Switch the binary; current run keeps the old path, the next start uses the new one.
    sup.setBinaryPath('/new/mihomo')
    await sup.restart()
    const [secondBin, secondArgs] = (
      spawn.mock.calls as unknown as [string, string[]][]
    )[1]!
    expect(secondBin).toBe('/new/mihomo')
    expect(secondArgs).toEqual([
      '-d',
      opts.homeDir,
      '-f',
      opts.activeConfigPath,
    ])
    await sup.dispose()
  })

  it('setBinaryPath also changes the binary validate spawns', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const sup = createSupervisor(opts, {
      spawn: spawn as never,
      fetch: ready200(),
    })
    sup.setBinaryPath('/new/mihomo')
    const p = sup.validate(opts.activeConfigPath)
    const [bin] = (spawn.mock.calls as unknown as [string, string[]][])[0]!
    expect(bin).toBe('/new/mihomo')
    proc.emitExit(0, null)
    await p
  })

  it('mutex serializes concurrent start calls (single spawn)', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const sup = createSupervisor(opts, {
      spawn: spawn as never,
      fetch: ready200(),
    })
    // Fire two starts at once; the mutex must serialize so only one spawn happens.
    const [a, b] = await Promise.all([sup.start(), sup.start()])
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(a.status).toBe('running')
    expect(b.status).toBe('running')
    await sup.dispose()
  })

  it('validate resolves valid:true when mihomo -t exits 0', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const sup = createSupervisor(opts, {
      spawn: spawn as never,
      fetch: ready200(),
    })
    const p = sup.validate(opts.activeConfigPath)
    const [, args] = (spawn.mock.calls as unknown as [string, string[]][])[0]!
    expect(args).toEqual([
      '-t',
      '-d',
      opts.homeDir,
      '-f',
      opts.activeConfigPath,
    ])
    proc.stdout.emit(
      'data',
      Buffer.from('configuration file test is successful'),
    )
    proc.emitExit(0, null)
    const r = await p
    expect(r.valid).toBe(true)
    expect(r.message).toContain('successful')
  })

  it('validate resolves valid:false when mihomo -t exits non-zero', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
    })
    const p = sup.validate(opts.activeConfigPath)
    proc.stderr.emit('data', Buffer.from('parse error near line 3'))
    proc.emitExit(1, null)
    const r = await p
    expect(r.valid).toBe(false)
    expect(r.message).toContain('parse error')
  })

  it('gives sequential first-run GEO downloads a 300s validation window (#2118, #2121)', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const setTimer = vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>)
    const clearTimer = vi.fn()
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
      setTimer,
      clearTimer,
    })

    const result = sup.validate(opts.activeConfigPath)
    expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 300_000)
    proc.emitExit(0, null)
    await expect(result).resolves.toEqual({ valid: true, message: '' })
    expect(clearTimer).toHaveBeenCalledOnce()
  })

  it('kills a timed-out validator and keeps its diagnostic output', async () => {
    const opts = { ...baseOpts(), validateTimeoutMs: 25 }
    const proc = new FakeProc()
    const timers: Array<{ fn: () => void; ms: number }> = []
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
      setTimer: ((fn: () => void, ms: number) => {
        timers.push({ fn, ms })
        return timers.length as unknown as ReturnType<typeof setTimeout>
      }) as never,
      clearTimer: vi.fn(),
    })

    const result = sup.validate(opts.activeConfigPath)
    proc.stderr.emit(
      'data',
      Buffer.from("Can't find GeoIP.dat, start download"),
    )
    expect(timers[0]?.ms).toBe(25)
    timers[0]?.fn()

    // Timeout sends SIGKILL but does not release the caller while the validator
    // may still own the candidate file or write GEO data in the shared homeDir.
    let resolved = false
    void result.then(() => {
      resolved = true
    })
    await Promise.resolve()
    expect(resolved).toBe(false)
    expect(proc.killSignals).toEqual(['SIGKILL'])
    expect(timers[1]?.ms).toBe(5_000)

    proc.emitExit(null, 'SIGKILL')

    const validation = await result
    expect(validation.valid).toBe(false)
    expect(validation.message).toContain('validate timeout after 25ms')
    expect(validation.message).toContain('GeoIP.dat')
  })

  it('keeps the timeout verdict when kill emits exit synchronously', async () => {
    const opts = { ...baseOpts(), validateTimeoutMs: 25 }
    const proc = new FakeProc()
    proc.kill = (signal?: string) => {
      proc.killSignals.push(signal ?? 'SIGTERM')
      proc.emitExit(0, signal ?? 'SIGTERM')
      return true
    }
    let fireTimeout: (() => void) | undefined
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
      setTimer: ((fn: () => void) => {
        fireTimeout = fn
        return 1 as unknown as ReturnType<typeof setTimeout>
      }) as never,
      clearTimer: vi.fn(),
    })

    const result = sup.validate(opts.activeConfigPath)
    fireTimeout?.()

    await expect(result).resolves.toMatchObject({
      valid: false,
      message: 'validate timeout after 25ms',
    })
  })

  it('releases a timed-out validator after the kill grace if exit never arrives', async () => {
    const opts = { ...baseOpts(), validateTimeoutMs: 25 }
    const proc = new FakeProc()
    proc.kill = (signal?: string) => {
      proc.killSignals.push(signal ?? 'SIGTERM')
      return true
    }
    const timers: Array<{ fn: () => void; ms: number }> = []
    const sup = createSupervisor(opts, {
      spawn: (() => proc) as never,
      fetch: ready200(),
      setTimer: ((fn: () => void, ms: number) => {
        timers.push({ fn, ms })
        return timers.length as unknown as ReturnType<typeof setTimeout>
      }) as never,
      clearTimer: vi.fn(),
    })

    const result = sup.validate(opts.activeConfigPath)
    timers[0]?.fn()
    expect(timers[1]?.ms).toBe(5_000)
    timers[1]?.fn()

    await expect(result).resolves.toMatchObject({
      valid: false,
      message: 'validate timeout after 25ms',
    })
  })
})

describe('createSupervisor — crash auto-restart watchdog', () => {
  function ready200() {
    return (async () =>
      new Response(JSON.stringify({ version: '1.19.27' }), {
        status: 200,
      })) as unknown as typeof fetch
  }

  // Captures the watchdog's timer callbacks (backoff restart + stability reset)
  // so tests can fire them deterministically without waiting real milliseconds.
  // Timers are identified by their ms value: restart-backoff vs stability window.
  function makeTimerHarness() {
    interface Pending {
      id: number
      fn: () => void
      ms: number
    }
    let nextId = 1
    const pending: Pending[] = []
    async function flush() {
      // Let the scheduled async run(doStart) settle: the mutex chain ->
      // injectClashConfig (file I/O) -> spawn -> pollReady all need a few
      // macrotask turns to flush before assertions.
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    }
    return {
      pending,
      setTimer: ((fn: () => void, ms: number) => {
        const id = nextId++
        pending.push({ id, fn, ms })
        return id as unknown as ReturnType<typeof setTimeout>
      }) as (fn: () => void, ms: number) => ReturnType<typeof setTimeout>,
      clearTimer: ((h: ReturnType<typeof setTimeout>) => {
        const idx = pending.findIndex((p) => p.id === (h as unknown as number))
        if (idx >= 0) pending.splice(idx, 1)
      }) as (h: ReturnType<typeof setTimeout>) => void,
      // Fire the first pending timer matching ms (and remove it).
      async fireMs(ms: number) {
        const idx = pending.findIndex((p) => p.ms === ms)
        if (idx < 0) throw new Error(`no pending timer with ms=${ms} to fire`)
        const [t] = pending.splice(idx, 1)
        t!.fn()
        await flush()
      },
      msList() {
        return pending.map((p) => p.ms)
      },
    }
  }

  // Distinct timer durations so fireMs() can target the right timer:
  // BACKOFF = the restart backoff, STABLE = the post-running stability window.
  const BACKOFF = 1000
  const STABLE = 7000

  it('auto-restarts after backoff when the process exits unexpectedly while running', async () => {
    const opts = baseOpts()
    const procs: FakeProc[] = []
    const spawn = vi.fn(() => {
      const p = new FakeProc()
      p.pid = 2000 + procs.length
      procs.push(p)
      return p
    })
    const timers = makeTimerHarness()
    const sup = createSupervisor(
      { ...opts, restartBackoffMs: BACKOFF, stableRestartMs: STABLE },
      {
        spawn: spawn as never,
        fetch: ready200(),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      },
    )
    await sup.start()
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(sup.getState().status).toBe('running')
    // Reaching running armed a stability timer (not a restart).
    expect(timers.msList()).toContain(STABLE)

    // Simulate an unexpected crash while running.
    procs[0]!.emitExit(137, null)
    await new Promise((r) => setImmediate(r))
    // Watchdog scheduled a backoff timer; the stability timer was cancelled.
    expect(timers.msList()).toEqual([BACKOFF])
    expect(spawn).toHaveBeenCalledTimes(1)

    // Fire the backoff timer -> respawn. The restart chain does real config-file
    // I/O before spawn, so wait for it to settle instead of a fixed turn count.
    await timers.fireMs(BACKOFF)
    await vi.waitFor(
      () => {
        expect(spawn).toHaveBeenCalledTimes(2)
        expect(sup.getState().status).toBe('running')
      },
      { timeout: 3000 },
    )
    await sup.dispose()
  })

  it('does NOT restart when the user calls stop()', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const timers = makeTimerHarness()
    const sup = createSupervisor(
      { ...opts, stableRestartMs: STABLE },
      {
        spawn: spawn as never,
        fetch: ready200(),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      },
    )
    await sup.start()
    const stopP = sup.stop()
    setTimeout(() => proc.emitExit(0, 'SIGTERM'), 5)
    const st = await stopP
    await new Promise((r) => setImmediate(r))
    expect(st.status).toBe('stopped')
    // No watchdog restart scheduled for an intentional stop; stability timer cleared too.
    expect(timers.pending).toHaveLength(0)
    expect(spawn).toHaveBeenCalledTimes(1)
    await sup.dispose()
  })

  it('stops at errored once maxRestarts is exceeded (crash loop, never stabilizes)', async () => {
    const opts = baseOpts()
    const procs: FakeProc[] = []
    const spawn = vi.fn(() => {
      const p = new FakeProc()
      p.pid = 3000 + procs.length
      procs.push(p)
      return p
    })
    const timers = makeTimerHarness()
    const sup = createSupervisor(
      {
        ...opts,
        maxRestarts: 2,
        restartBackoffMs: BACKOFF,
        stableRestartMs: STABLE,
      },
      {
        spawn: spawn as never,
        fetch: ready200(),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      },
    )
    await sup.start()
    expect(spawn).toHaveBeenCalledTimes(1)

    // Crash #1 -> restart #1 (count 1). It reaches running but we never let the
    // stability window elapse, so the counter is NOT reset. Wait for the restart
    // to fully reach running before the next crash (the chain does real I/O).
    procs[procs.length - 1]!.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    await timers.fireMs(BACKOFF)
    await vi.waitFor(
      () => {
        expect(spawn).toHaveBeenCalledTimes(2)
        expect(sup.getState().status).toBe('running')
      },
      { timeout: 3000 },
    )

    // Crash #2 -> restart #2 (count 2 == maxRestarts)
    procs[procs.length - 1]!.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    await timers.fireMs(BACKOFF)
    await vi.waitFor(
      () => {
        expect(spawn).toHaveBeenCalledTimes(3)
        expect(sup.getState().status).toBe('running')
      },
      { timeout: 3000 },
    )

    // Crash #3 -> exceeds maxRestarts -> no further restart, stay errored.
    procs[procs.length - 1]!.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    expect(timers.msList()).not.toContain(BACKOFF)
    expect(spawn).toHaveBeenCalledTimes(3)
    expect(sup.getState().status).toBe('errored')
    await sup.dispose()
  })

  it('resets the restart counter once a restart stays running for the stability window', async () => {
    const opts = baseOpts()
    const procs: FakeProc[] = []
    const spawn = vi.fn(() => {
      const p = new FakeProc()
      p.pid = 4000 + procs.length
      procs.push(p)
      return p
    })
    const timers = makeTimerHarness()
    const sup = createSupervisor(
      {
        ...opts,
        maxRestarts: 1,
        restartBackoffMs: BACKOFF,
        stableRestartMs: STABLE,
      },
      {
        spawn: spawn as never,
        fetch: ready200(),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      },
    )
    await sup.start()

    // Crash #1 -> restart (count 1 == maxRestarts), reaches running.
    procs[procs.length - 1]!.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    await timers.fireMs(BACKOFF)
    await vi.waitFor(
      () => {
        expect(spawn).toHaveBeenCalledTimes(2)
        expect(sup.getState().status).toBe('running')
      },
      { timeout: 3000 },
    )

    // Let the stability window elapse -> counter resets to 0.
    await timers.fireMs(STABLE)

    // Because the counter reset, another crash is allowed to restart again.
    procs[procs.length - 1]!.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    expect(timers.msList()).toEqual([BACKOFF])
    await timers.fireMs(BACKOFF)
    await vi.waitFor(
      () => {
        expect(spawn).toHaveBeenCalledTimes(3)
        expect(sup.getState().status).toBe('running')
      },
      { timeout: 3000 },
    )
    await sup.dispose()
  })

  it('autoRestart:false disables the watchdog entirely', async () => {
    const opts = baseOpts()
    const proc = new FakeProc()
    const spawn = vi.fn(() => proc)
    const timers = makeTimerHarness()
    const sup = createSupervisor(
      { ...opts, autoRestart: false, stableRestartMs: STABLE },
      {
        spawn: spawn as never,
        fetch: ready200(),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
      },
    )
    await sup.start()
    // A stability timer may be armed, but no restart backoff must ever appear.
    proc.emitExit(1, null)
    await new Promise((r) => setImmediate(r))
    expect(timers.msList()).not.toContain(BACKOFF)
    expect(spawn).toHaveBeenCalledTimes(1)
    expect(sup.getState().status).toBe('errored')
    await sup.dispose()
  })
})
