import type { Server, Socket } from 'node:net'
import type {
  HelperRequest,
  HelperResponse,
  StartKernelRequest,
} from './protocol'
import { randomUUID } from 'node:crypto'
import { chmod, lstat, unlink } from 'node:fs/promises'
import { connect, createServer } from 'node:net'
import {
  encodeMessage,
  HELPER_PROTOCOL_VERSION,
  parseMessages,
} from './protocol'

// Stable for this process, different after a service restart. This is not an
// authentication secret and is only returned after the request authenticates.
const PROCESS_INSTANCE_ID = randomUUID()

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
   * pipe path the same way, so the dispatch logic is identical. The Windows
   * packaging smoke test exercises the named-pipe branch on Windows CI.
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

/** Recover a socket left by a crashed process, without replacing a live helper. */
async function removeStaleSocket(socketPath: string): Promise<void> {
  const previous = await lstat(socketPath).catch(
    (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return undefined
      throw err
    },
  )
  if (!previous) return
  if (!previous.isSocket()) {
    throw new Error(
      `helper: refusing to replace a non-socket path: ${socketPath}`,
    )
  }

  await new Promise<void>((resolve, reject) => {
    const probe = connect(socketPath)
    probe.setTimeout(1000)
    probe.once('connect', () => {
      probe.destroy()
      reject(
        Object.assign(
          new Error(`helper: socket already in use: ${socketPath}`),
          {
            code: 'EADDRINUSE',
          },
        ),
      )
    })
    probe.once('timeout', () => {
      probe.destroy()
      reject(
        new Error(`helper: timed out checking existing socket: ${socketPath}`),
      )
    })
    probe.once('error', (err: NodeJS.ErrnoException) => {
      probe.destroy()
      // Only a refused connection proves that no process is listening. Other
      // errors (including permissions) must not remove another service's socket.
      if (err.code === 'ECONNREFUSED') resolve()
      else reject(err)
    })
  })

  // A concurrent restart may have replaced it while the probe was in flight.
  const current = await lstat(socketPath)
  if (
    !current.isSocket() ||
    current.dev !== previous.dev ||
    current.ino !== previous.ino
  ) {
    throw new Error(`helper: socket changed while checking it: ${socketPath}`)
  }
  await unlink(socketPath)
}

/**
 * Build the helper-side IPC server. It listens on a LOCAL socket (unix domain
 * socket on mac/linux; a `\\.\pipe\...` named pipe on Windows). For each
 * newline-framed request it:
 *   1. validates the shared `secret` (reject on mismatch — no dispatch), then
 *   2. validates the protocol `version` (reject on mismatch, still echoing the
 *      helper's version so the client can trigger a re-install), then
 *   3. dispatches to the injected `kernel` (ping/getVersion/startKernel/
 *      stopKernel/status) and frames the result back.
 *
 * Anti-residual: on the kernel-owning client's disconnect AND on server close
 * it calls `kernel.stop()` so a vanished app cannot leave a privileged mihomo / TUN
 * hijacking the whole machine (spec §12.6). Errors from the injected kernel are
 * surfaced as `ok:false` responses — never silently swallowed.
 */
export async function createHelperServer(
  opts: CreateHelperServerOptions,
): Promise<HelperServer> {
  const { socketPath, secret, kernel } = opts
  let kernelOwner: Socket | undefined

  function buildResponse(
    req: HelperRequest,
    socket: Socket,
  ): Promise<HelperResponse> {
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
    if (req.type !== 'getVersion' && req.version !== HELPER_PROTOCOL_VERSION) {
      return Promise.resolve({
        type: req.type,
        ok: false,
        version,
        error: `helper: protocol version mismatch (helper ${version}, client ${req.version})`,
      })
    }

    return dispatch(req, version, socket)
  }

  async function dispatch(
    req: HelperRequest,
    version: string,
    socket: Socket,
  ): Promise<HelperResponse> {
    try {
      switch (req.type) {
        case 'ping':
          return { type: req.type, ok: true, version }
        case 'getVersion':
          return {
            type: req.type,
            ok: true,
            version,
            instanceId: PROCESS_INSTANCE_ID,
          }
        case 'startKernel': {
          const { binaryPath, homeDir, configPath } = req as StartKernelRequest
          const result = await kernel.start({ binaryPath, homeDir, configPath })
          kernelOwner = result.running ? socket : undefined
          if (socket.destroyed && kernelOwner === socket) {
            kernelOwner = undefined
            await kernel.stop()
          }
          return { type: req.type, ok: true, version, running: result.running }
        }
        case 'stopKernel':
          await kernel.stop()
          kernelOwner = undefined
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
      let parsed: ReturnType<typeof parseMessages<HelperRequest>>
      try {
        parsed = parseMessages<HelperRequest>(buffer)
      } catch {
        socket.destroy()
        return
      }
      const { messages, rest } = parsed
      buffer = rest
      for (const req of messages) {
        if (!req || typeof req !== 'object') {
          socket.destroy()
          return
        }
        void buildResponse(req, socket).then((res) => {
          if (!socket.destroyed) socket.write(encodeMessage(res))
        })
      }
    })

    // Anti-residual: a dropped client (e.g. app crash) must not leave a
    // privileged mihomo running — tear it down on disconnect.
    socket.on('close', () => {
      // Version/liveness probes and rejected clients never own the kernel.
      if (kernelOwner === socket) {
        kernelOwner = undefined
        void kernel.stop().catch((err) => console.error(err))
      }
    })
    // A socket error still ends the connection; the 'close' handler above runs.
    socket.on('error', () => {})
  }

  const server = createServer(onConnection)

  if (process.platform !== 'win32') await removeStaleSocket(socketPath)

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    // On Windows these options update the named pipe's DACL; the default SYSTEM
    // service pipe otherwise prevents an unprivileged app from writing to it.
    server.listen(
      { path: socketPath, readableAll: true, writableAll: true },
      async () => {
        try {
          // The service runs as root, but the desktop client is unprivileged.
          // Linux requires write permission on the socket to connect. The shared
          // install secret authenticates requests; filesystem access alone does not.
          if (process.platform !== 'win32') await chmod(socketPath, 0o666)
        } catch (err) {
          server.close()
          reject(err)
          return
        }
        server.removeListener('error', reject)
        resolve({
          server,
          close() {
            return new Promise<void>((resolveClose, rejectClose) => {
              server.close(() => {
                // Anti-residual: stop the privileged kernel when the helper goes
                // away so no TUN/mihomo is left hijacking the machine.
                void kernel.stop().then(resolveClose, rejectClose)
              })
            })
          },
        })
      },
    )
  })
}
