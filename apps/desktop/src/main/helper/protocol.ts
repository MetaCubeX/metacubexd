/**
 * Local IPC protocol shared by the privileged helper (server, B2-T2) and the
 * app-side client (B2-T3). Pure module — NO IO here. Transport is newline-
 * delimited JSON (NDJSON) over a unix domain socket (mac/linux) or a named pipe
 * (Windows). Every request carries a per-install shared `secret` (the helper
 * rejects mismatches) and the protocol `version` for the compatibility
 * handshake; every response echoes the helper's `version` so a stale install
 * can be detected and re-installed (B-3).
 */

/** Bump on any wire-incompatible change so old installs are detected. */
export const HELPER_PROTOCOL_VERSION = '1'

/** Fields every request shares: auth secret + protocol version. */
interface RequestEnvelope {
  /** Per-install shared secret; the helper rejects mismatches. */
  secret: string
  /** Protocol version for the compatibility handshake. */
  version: string
}

/** Liveness probe. */
export interface PingRequest extends RequestEnvelope {
  type: 'ping'
}

/** Ask the helper for its protocol version (stale-install detection). */
export interface GetVersionRequest extends RequestEnvelope {
  type: 'getVersion'
}

/** Privileged-spawn the bundled mihomo with the given paths. */
export interface StartKernelRequest extends RequestEnvelope {
  type: 'startKernel'
  /** Absolute path to the bundled mihomo binary. */
  binaryPath: string
  /** mihomo working/home directory (-d). */
  homeDir: string
  /** Absolute path to the resolved config file (-f). */
  configPath: string
}

/** Terminate the privileged mihomo and tear down the TUN. */
export interface StopKernelRequest extends RequestEnvelope {
  type: 'stopKernel'
}

/** Report whether the privileged kernel is currently running. */
export interface StatusRequest extends RequestEnvelope {
  type: 'status'
}

/** Any request the helper IPC server accepts. */
export type HelperRequest =
  | PingRequest
  | GetVersionRequest
  | StartKernelRequest
  | StopKernelRequest
  | StatusRequest

/** The request `type` discriminant. */
export type HelperRequestType = HelperRequest['type']

/** Fields every response shares: success flag + the helper's version. */
interface ResponseEnvelope {
  /** Echoes the request `type` so the client can correlate. */
  type: HelperRequestType
  /** Whether the request succeeded; on false an `error` string is present. */
  ok: boolean
  /** The helper's protocol version (for stale-install detection). */
  version: string
}

/** A successful response (optionally carrying running state for `status`). */
export interface HelperOkResponse extends ResponseEnvelope {
  ok: true
  /** Present for `status`: whether the privileged kernel is running. */
  running?: boolean
}

/** A failed response carrying a human-readable error (never swallowed). */
export interface HelperErrorResponse extends ResponseEnvelope {
  ok: false
  /** Human-readable failure reason. */
  error: string
}

/** Any response the helper IPC server emits. */
export type HelperResponse = HelperOkResponse | HelperErrorResponse

/** Any framed message on the wire (request or response). */
export type HelperMessage = HelperRequest | HelperResponse

/**
 * Encode a message as a single NDJSON frame: one JSON object + a trailing
 * newline. `JSON.stringify` never emits a raw newline, so the body is always a
 * single line and the `\n` is an unambiguous frame delimiter.
 */
export function encodeMessage(msg: HelperMessage): string {
  return `${JSON.stringify(msg)}\n`
}

/**
 * Split a (possibly coalesced and/or partial) NDJSON buffer into complete
 * messages, returning any trailing incomplete fragment in `rest`. The caller
 * prepends `rest` to the next chunk before re-parsing, so frames split across
 * socket reads reassemble correctly.
 *
 * Only the substring up to the LAST newline is complete; everything after it is
 * an in-flight frame and is returned untouched in `rest`.
 */
export function parseMessages<T extends HelperMessage = HelperMessage>(
  buffer: string,
): { messages: T[]; rest: string } {
  const lastNewline = buffer.lastIndexOf('\n')
  if (lastNewline === -1) {
    // No complete frame yet — keep the whole buffer for the next chunk.
    return { messages: [], rest: buffer }
  }

  const complete = buffer.slice(0, lastNewline)
  const rest = buffer.slice(lastNewline + 1)

  const messages = complete
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T)

  return { messages, rest }
}
