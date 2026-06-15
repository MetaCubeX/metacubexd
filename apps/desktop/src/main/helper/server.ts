import type { Server, Socket } from 'node:net'
import type {
  HelperRequest,
  HelperResponse,
  StartKernelRequest,
} from './protocol'
import { createServer } from 'node:net'
import {
  encodeMessage,
  HELPER_PROTOCOL_VERSION,
  parseMessages,
} from './protocol'

/** Result of a privileged kernel start/status query, mirrored back over IPC. */
export interface HelperKernelResult {
  ok: true
  /** Whether the privileged mihomo is currently running. */
  running: boolean
}

/** Options the privileged side passes to spawn mihomo. */
export interface HelperKernelStartOptions {
  /** Absolute path to the bundled mihomo binary. */
  binaryPath: string
  /** mihomo working/home directory (-d). */
  homeDir: string
  /** Absolute path to the resolved config file (-f). */
  configPath: string
}

/**
 * The privileged kernel manager the server dispatches to. The REAL implementation
 * (helper entry, B-2/B-3) privileged-spawns the bundled mihomo behind an
 * injectable spawn; server tests inject an in-memory stub so NO real process is
 * ever created.
 */
export interface HelperKernel {
  /** Privileged-spawn mihomo with the given paths. */
  start: (opts: HelperKernelStartOptions) => Promise<HelperKernelResult>
  /** Terminate the privileged mihomo + tear down the TUN. */
  stop: () => Promise<void>
  /** Whether the privileged kernel is currently running. */
  status: () => HelperKernelResult
  /** The helper's protocol version (for stale-install detection). */
  version: () => string
}

export interface CreateHelperServerOptions {
  /**
   * Where to listen. mac/linux: a unix domain socket path. Windows: a named pipe
   * path of the form `\\.\pipe\...` — node:net's createServer/listen accepts the
   * pipe path the same way, so the dispatch logic is identical; the Windows pipe
   * branch is exercised only on Windows (NOT on this mac), see note below.
   */
  socketPath: string
  /** Per-install shared secret; requests with a mismatch are rejected. */
  secret: string
  /** Injected privileged kernel manager (real spawn lives behind this). */
  kernel: HelperKernel
}

export interface HelperServer {
  /** The underlying node:net server (loopback/local socket only). */
  server: Server
  /**
   * Stop listening and, as an anti-residual safeguard, stop the privileged
   * kernel + tear down the TUN (the app must never be able to leave a privileged
   * mihomo running after the helper goes away).
   */
  close: () => Promise<void>
}

/**
 * Build the helper-side IPC server. It listens on a LOCAL socket (unix domain
 * socket on mac/linux; a `\\.\pipe\...` named pipe on Windows — note: the
 * Windows branch is logic-only here, it cannot be exercised on macOS/CI). For
 * each newline-framed request it:
 *   1. validates the shared `secret` (reject on mismatch — no dispatch), then
 *   2. validates the protocol `version` (reject on mismatch, still echoing the
 *      helper's version so the client can trigger a re-install), then
 *   3. dispatches to the injected `kernel` (ping/getVersion/startKernel/
 *      stopKernel/status) and frames the result back.
 *
 * Anti-residual: on client disconnect AND on server close it calls
 * `kernel.stop()` so a vanished app can never leave a privileged mihomo / TUN
 * hijacking the whole machine (spec §12.6). Errors from the injected kernel are
 * surfaced as `ok:false` responses — never silently swallowed.
 */
export function createHelperServer(
  opts: CreateHelperServerOptions,
): Promise<HelperServer> {
  const { socketPath, secret, kernel } = opts

  function buildResponse(req: HelperRequest): Promise<HelperResponse> {
    const version = kernel.version()

    // Auth first: a bad secret must not reach any dispatch path.
    if (req.secret !== secret) {
      return Promise.resolve({
        type: req.type,
        ok: false,
        version,
        error: 'helper: shared secret mismatch',
      })
    }

    // Version handshake: reject incompatible wire versions, but still echo the
    // helper's own version so the client can detect a stale install (B-3).
    if (req.version !== HELPER_PROTOCOL_VERSION) {
      return Promise.resolve({
        type: req.type,
        ok: false,
        version,
        error: `helper: protocol version mismatch (helper ${version}, client ${req.version})`,
      })
    }

    return dispatch(req, version)
  }

  async function dispatch(
    req: HelperRequest,
    version: string,
  ): Promise<HelperResponse> {
    try {
      switch (req.type) {
        case 'ping':
        case 'getVersion':
          return { type: req.type, ok: true, version }
        case 'startKernel': {
          const { binaryPath, homeDir, configPath } = req as StartKernelRequest
          const result = await kernel.start({ binaryPath, homeDir, configPath })
          return { type: req.type, ok: true, version, running: result.running }
        }
        case 'stopKernel':
          await kernel.stop()
          return { type: req.type, ok: true, version }
        case 'status': {
          const result = kernel.status()
          return { type: req.type, ok: true, version, running: result.running }
        }
      }
    } catch (err) {
      // Surface (never swallow) any privileged-side failure to the client.
      return {
        type: req.type,
        ok: false,
        version,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  function onConnection(socket: Socket): void {
    let buffer = ''
    socket.setEncoding('utf8')

    socket.on('data', (chunk: string) => {
      buffer += chunk
      const { messages, rest } = parseMessages<HelperRequest>(buffer)
      buffer = rest
      for (const req of messages) {
        void buildResponse(req).then((res) => {
          if (!socket.destroyed) socket.write(encodeMessage(res))
        })
      }
    })

    // Anti-residual: a dropped client (e.g. app crash) must not leave a
    // privileged mihomo running — tear it down on disconnect.
    socket.on('close', () => {
      void kernel.stop()
    })
    // A socket error still ends the connection; the 'close' handler above runs.
    socket.on('error', () => {})
  }

  const server = createServer(onConnection)

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(socketPath, () => {
      server.removeListener('error', reject)
      resolve({
        server,
        close() {
          return new Promise<void>((resolveClose) => {
            server.close(() => {
              // Anti-residual: stop the privileged kernel when the helper goes
              // away so no TUN/mihomo is left hijacking the machine.
              void Promise.resolve(kernel.stop()).finally(() => resolveClose())
            })
          })
        },
      })
    })
  })
}
