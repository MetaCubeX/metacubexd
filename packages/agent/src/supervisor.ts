import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import type {
  KernelLogLine,
  KernelState,
  MihomoSupervisor,
  SupervisorOptions,
} from './types'
import { spawn as nodeSpawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import treeKillDefault from 'tree-kill'

export interface SupervisorDeps {
  spawn?: (cmd: string, args: string[], opts?: object) => ChildProcess
  fetch?: typeof fetch
  treeKill?: (pid: number, signal: string, cb?: (err?: Error) => void) => void
  now?: () => number
  platform?: NodeJS.Platform
}

export type CreateSupervisorOptions = SupervisorOptions & {
  externalController?: string
  secret?: string
  mixedPort?: number // optional: injected as `mixed-port:` into the active YAML before spawn
}

// Tiny async mutex: serializes lifecycle ops so two tabs can't double-spawn.
function createMutex() {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(fn, fn)
    tail = result.catch(() => {})
    return result
  }
}

function sleep(ms: number, now: () => number): Promise<void> {
  // now() is only used elsewhere; sleep stays real-time for ready-poll cadence.
  void now
  return new Promise((r) => setTimeout(r, ms))
}

export function createSupervisor(
  opts: CreateSupervisorOptions,
  deps: SupervisorDeps = {},
): MihomoSupervisor {
  const spawn =
    deps.spawn ?? (nodeSpawn as unknown as NonNullable<SupervisorDeps['spawn']>)
  const doFetch = deps.fetch ?? fetch
  const treeKill =
    deps.treeKill ??
    (treeKillDefault as unknown as NonNullable<SupervisorDeps['treeKill']>)
  const now = deps.now ?? Date.now
  const platform = deps.platform ?? process.platform

  const startTimeoutMs = opts.startTimeoutMs ?? 10_000
  const stopTimeoutMs = opts.stopTimeoutMs ?? 5_000
  const mixedPort = opts.mixedPort

  const state: KernelState = {
    status: 'stopped',
    externalController: opts.externalController ?? '127.0.0.1:9090',
    secret: opts.secret ?? randomBytes(16).toString('hex'),
  }

  const logCbs = new Set<(l: KernelLogLine) => void>()
  const stateCbs = new Set<(s: KernelState) => void>()
  let child: ChildProcess | undefined
  const run = createMutex()

  function setState(patch: Partial<KernelState>): void {
    Object.assign(state, patch)
    const snapshot = { ...state }
    for (const cb of stateCbs) cb(snapshot)
  }

  function emitLines(stream: 'stdout' | 'stderr', chunk: Buffer): void {
    const text = chunk.toString('utf8')
    for (const line of text.split('\n')) {
      if (line.length === 0) continue
      const l: KernelLogLine = { stream, line, ts: now() }
      for (const cb of logCbs) cb(l)
    }
  }

  function versionUrl(): string {
    const base = state.externalController.startsWith('http')
      ? state.externalController
      : `http://${state.externalController}`
    return `${base}/version`
  }

  async function pollReady(deadline: number): Promise<boolean> {
    while (now() < deadline) {
      if (state.status === 'errored') return false
      try {
        const res = await doFetch(versionUrl(), {
          headers: state.secret
            ? { Authorization: `Bearer ${state.secret}` }
            : undefined,
        })
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            version?: string
          }
          setState({ status: 'running', version: body.version })
          return true
        }
      } catch {
        // not up yet
      }
      await sleep(200, now)
    }
    return false
  }

  function killProc(signal: 'SIGTERM' | 'SIGKILL'): void {
    if (!child?.pid) return
    if (platform === 'win32') {
      treeKill(child.pid, signal)
    } else {
      child.kill(signal)
    }
  }

  // Before spawn, force mihomo to bind the Clash API where the supervisor polls.
  // We rewrite the active YAML in place: strip any top-level external-controller/
  // secret/mixed-port lines the profile carried, then prepend our managed values
  // so state.externalController/secret (and the optional mixedPort) are authoritative.
  async function injectClashConfig(): Promise<void> {
    let existing = ''
    if (existsSync(opts.activeConfigPath)) {
      existing = await readFile(opts.activeConfigPath, 'utf8')
    }
    const STRIP = /^(?:external-controller|secret|mixed-port)\s*:/
    const kept = existing
      .split('\n')
      .filter((line) => !STRIP.test(line))
      .join('\n')
    const header = [
      `external-controller: ${state.externalController}`,
      `secret: ${state.secret}`,
      ...(mixedPort != null ? [`mixed-port: ${mixedPort}`] : []),
      '',
    ].join('\n')
    await writeFile(opts.activeConfigPath, header + kept)
  }

  async function doStart(): Promise<KernelState> {
    if (state.status === 'running' || state.status === 'starting')
      return { ...state }
    setState({
      status: 'starting',
      pid: undefined,
      version: undefined,
      lastError: undefined,
      lastExitCode: undefined,
    })

    await injectClashConfig()

    const proc = spawn(opts.binaryPath, [
      '-d',
      opts.homeDir,
      '-f',
      opts.activeConfigPath,
    ])
    child = proc
    setState({ pid: proc.pid ?? undefined, startedAt: now() })

    proc.stdout?.on('data', (c: Buffer) => emitLines('stdout', c))
    proc.stderr?.on('data', (c: Buffer) => emitLines('stderr', c))
    proc.on('exit', (code: number | null) => {
      child = undefined
      if (state.status === 'starting' || state.status === 'running') {
        setState({
          status: 'errored',
          lastExitCode: code,
          pid: undefined,
        })
      } else {
        setState({ status: 'stopped', lastExitCode: code, pid: undefined })
      }
    })
    proc.on('error', (err: Error) => {
      setState({ status: 'errored', lastError: err.message })
    })

    const ready = await pollReady(now() + startTimeoutMs)
    if (!ready && state.status !== 'errored') {
      setState({ status: 'errored', lastError: 'ready timeout' })
      killProc('SIGKILL')
    }
    return { ...state }
  }

  async function doStop(): Promise<KernelState> {
    if (!child || state.status === 'stopped') {
      setState({ status: 'stopped' })
      return { ...state }
    }
    setState({ status: 'stopping' })
    const proc = child
    const exited = new Promise<void>((resolve) =>
      proc.once('exit', () => resolve()),
    )
    killProc('SIGTERM')
    const timer = sleep(stopTimeoutMs, now).then(() => 'timeout' as const)
    const winner = await Promise.race([
      exited.then(() => 'exited' as const),
      timer,
    ])
    if (winner === 'timeout') killProc('SIGKILL')
    await exited
    child = undefined
    setState({ status: 'stopped', pid: undefined })
    return { ...state }
  }

  const supervisor: MihomoSupervisor = {
    getState() {
      return { ...state }
    },
    start() {
      return run(doStart)
    },
    stop() {
      return run(doStop)
    },
    restart() {
      return run(async () => {
        await doStop()
        return doStart()
      })
    },
    async validate(configPath) {
      return new Promise((resolve) => {
        const proc = spawn(opts.binaryPath, [
          '-t',
          '-d',
          opts.homeDir,
          '-f',
          configPath,
        ])
        let out = ''
        proc.stdout?.on('data', (c: Buffer) => (out += c.toString()))
        proc.stderr?.on('data', (c: Buffer) => (out += c.toString()))
        const t = setTimeout(() => {
          if (proc.pid) killProcOf(proc, 'SIGKILL')
          resolve({ valid: false, message: 'validate timeout' })
        }, 3000)
        proc.on('exit', (code: number | null) => {
          clearTimeout(t)
          resolve({ valid: code === 0, message: out.trim() })
        })
        proc.on('error', (err: Error) => {
          clearTimeout(t)
          resolve({ valid: false, message: err.message })
        })
      })
    },
    on(event: 'log' | 'state', cb: (arg: never) => void) {
      if (event === 'log') logCbs.add(cb as (l: KernelLogLine) => void)
      else stateCbs.add(cb as (s: KernelState) => void)
    },
    async dispose() {
      logCbs.clear()
      stateCbs.clear()
      if (child) {
        try {
          await run(doStop)
        } catch {
          // best effort
        }
      }
    },
  }

  function killProcOf(proc: ChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
    if (!proc.pid) return
    if (platform === 'win32') treeKill(proc.pid, signal)
    else proc.kill(signal)
  }

  return supervisor
}

export function createSupervisorDefault(
  opts: CreateSupervisorOptions,
): MihomoSupervisor {
  return createSupervisor(opts)
}
