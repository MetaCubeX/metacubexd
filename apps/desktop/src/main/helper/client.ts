import type { Socket } from 'node:net'
import type {
  HelperOkResponse,
  HelperRequest,
  HelperRequestType,
  HelperResponse,
} from './protocol'
import type { HelperKernelStartOptions } from './server'
import { connect } from 'node:net'
import {
  encodeMessage,
  HELPER_PROTOCOL_VERSION,
  parseMessages,
} from './protocol'

/** How long (ms) to wait for a single response before rejecting. */
const DEFAULT_TIMEOUT_MS = 10_000

export interface CreateHelperClientOptions {
  /**
   * Where to connect. mac/linux: the unix domain socket path; Windows: the
   * `\\.\pipe\...` named pipe path (node:net's connect accepts the pipe path
   * the same way, so this logic is identical — the Windows pipe branch is NOT
   * exercised on macOS/CI, see the server note).
   */
  socketPath: string
  /** Per-install shared secret stamped onto every request. */
  secret: string
  /** Per-request response timeout in ms (defaults to 10s). */
  timeoutMs?: number
  /**
   * Fired exactly once when the connection to the helper drops UNEXPECTEDLY
   * (helper crash/kill/socket error) — i.e. NOT from a deliberate `close()`.
   * In TUN mode the app uses this to recover the network (tear the TUN down,
   * fall back to the sidecar) rather than keep believing it's still routing
   * through a dead helper. A deliberate `close()` (during a mode switch /
   * shutdown) never triggers it. Optional: sidecar callers omit it.
   */
  onDisconnect?: (err?: Error) => void
}

/** A type-narrowed `startKernel` response (carries the running state). */
export type HelperStartKernelResponse = HelperOkResponse & {
  type: 'startKernel'
  running: boolean
}

/** A type-narrowed `status` response (carries the running state). */
export type HelperStatusResponse = HelperOkResponse & {
  type: 'status'
  running: boolean
}

export interface HelperClient {
  /** Liveness probe. */
  ping: () => Promise<HelperResponse>
  /**
   * Fetch the helper's protocol version. Throws a clear version-mismatch error
   * if the helper's version differs from what this client speaks, so B-3 can
   * prompt a re-install rather than talk to a stale helper.
   */
  getVersion: () => Promise<HelperResponse>
  /** Privileged-spawn mihomo with the given paths. */
  startKernel: (
    opts: HelperKernelStartOptions,
  ) => Promise<HelperStartKernelResponse>
  /** Terminate the privileged mihomo + tear down the TUN. */
  stopKernel: () => Promise<HelperResponse>
  /** Query whether the privileged kernel is running. */
  status: () => Promise<HelperStatusResponse>
  /** Close the underlying connection (the server tears down the kernel). */
  close: () => Promise<void>
}

/** A connected request thrown back at us as `ok:false`, surfaced (never swallowed). */
class HelperRequestError extends Error {
  constructor(
    message: string,
    /** The response `type` this error correlates to. */
    public readonly responseType: HelperRequestType,
  ) {
    super(message)
    this.name = 'HelperRequestError'
  }
}

/**
 * Build the app-side IPC client. It holds ONE persistent connection for its
 * lifetime (the server's anti-residual teardown stops the kernel the moment we
 * disconnect, so we must keep the socket open across start/status/stop) and
 * correlates responses to requests by FIFO order — the protocol is strictly
 * request/response over a single socket, mirroring the server.
 *
 * Every request carries the shared `secret` + this client's protocol version.
 * `request` rejects (never swallows) on: an `ok:false` server response, a
 * per-request timeout, or a socket/connect error that drops in-flight requests.
 * `getVersion` additionally throws a clear version-mismatch error when the
 * helper reports a different protocol version, so B-3 can trigger a re-install.
 */
export function createHelperClient(
  opts: CreateHelperClientOptions,
): HelperClient {
  const { socketPath, secret, onDisconnect } = opts
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // FIFO queue of in-flight requests awaiting their response frame.
  interface Pending {
    resolve: (res: HelperResponse) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }
  const pending: Pending[] = []
  let buffer = ''
  /** Set once the socket dies so later requests fail fast instead of hanging. */
  let fatal: Error | undefined
  /** Set when WE end the socket so the close/error isn't read as a crash. */
  let closing = false
  /** Guards onDisconnect to fire at most once (error + close can both arrive). */
  let disconnected = false

  /**
   * Notify the owner of an UNEXPECTED drop exactly once. A deliberate `close()`
   * sets `closing` first, so the resulting close/error is never misreported as a
   * helper crash. No-op when no callback was supplied (sidecar callers).
   */
  function reportDisconnect(err?: Error): void {
    if (closing || disconnected) return
    disconnected = true
    onDisconnect?.(err)
  }

  const socket: Socket = connect(socketPath)
  socket.setEncoding('utf8')

  socket.on('data', (chunk: string) => {
    buffer += chunk
    const { messages, rest } = parseMessages<HelperResponse>(buffer)
    buffer = rest
    for (const res of messages) {
      const next = pending.shift()
      if (!next) continue
      clearTimeout(next.timer)
      if (res.ok) {
        next.resolve(res)
      } else {
        // Surface the server's failure — never swallow it.
        next.reject(
          new HelperRequestError(
            (res as { error?: string }).error ?? 'helper: request failed',
            res.type,
          ),
        )
      }
    }
  })

  /** Reject every in-flight request when the connection is lost. */
  function failAll(err: Error): void {
    fatal = err
    while (pending.length > 0) {
      const next = pending.shift()
      if (!next) break
      clearTimeout(next.timer)
      next.reject(err)
    }
  }

  socket.on('error', (err: Error) => {
    failAll(err)
    // An unexpected socket error means the helper connection is gone — surface
    // it so a TUN session can recover the network (suppressed for a deliberate
    // close()).
    reportDisconnect(err)
  })
  socket.on('close', () => {
    if (pending.length > 0) {
      failAll(fatal ?? new Error('helper: connection closed'))
    }
    // The connection is gone; tell the owner unless we ended it ourselves.
    reportDisconnect(fatal)
  })

  function request(
    payload: Omit<HelperRequest, 'secret' | 'version'>,
  ): Promise<HelperResponse> {
    if (fatal) return Promise.reject(fatal)

    return new Promise<HelperResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Drop this request from the queue so a late frame is not mis-matched.
        const idx = pending.findIndex((p) => p.timer === timer)
        if (idx !== -1) pending.splice(idx, 1)
        reject(
          new Error(
            `helper: request "${payload.type}" timed out after ${timeoutMs}ms`,
          ),
        )
      }, timeoutMs)

      pending.push({ resolve, reject, timer })

      const frame = encodeMessage({
        ...payload,
        secret,
        version: HELPER_PROTOCOL_VERSION,
      } as HelperRequest)
      socket.write(frame)
    })
  }

  return {
    ping() {
      return request({ type: 'ping' })
    },
    async getVersion() {
      const res = await request({ type: 'getVersion' })
      // Stale-install detection: a helper speaking a different protocol version
      // must surface a clear error so B-3 can prompt a re-install.
      if (res.version !== HELPER_PROTOCOL_VERSION) {
        throw new Error(
          `helper: protocol version mismatch (helper ${res.version}, client ${HELPER_PROTOCOL_VERSION})`,
        )
      }
      return res
    },
    async startKernel(startOpts: HelperKernelStartOptions) {
      const res = await request({ type: 'startKernel', ...startOpts })
      return res as HelperStartKernelResponse
    },
    stopKernel() {
      return request({ type: 'stopKernel' })
    },
    async status() {
      const res = await request({ type: 'status' })
      return res as HelperStatusResponse
    },
    close() {
      // Mark this teardown as deliberate so the resulting close/error event is
      // not misreported as a helper crash via onDisconnect.
      closing = true
      return new Promise<void>((resolve) => {
        if (socket.destroyed) {
          resolve()
          return
        }
        socket.once('close', () => resolve())
        socket.end()
      })
    },
  }
}
