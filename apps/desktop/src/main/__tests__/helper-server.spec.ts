import type { HelperRequest, HelperResponse } from '../helper/protocol'
import type { HelperKernel, HelperServer } from '../helper/server'
import { mkdtemp, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  encodeMessage,
  HELPER_PROTOCOL_VERSION,
  parseMessages,
} from '../helper/protocol'
import { createHelperServer } from '../helper/server'

const SECRET = 'shared-install-secret'

/**
 * In-memory injected kernel stub standing in for the privileged mihomo spawn.
 * Tests NEVER spawn a real process — every side effect is recorded here.
 */
function fakeKernel(overrides: Partial<HelperKernel> = {}): HelperKernel & {
  running: { value: boolean }
} {
  const running = { value: false }
  return {
    running,
    start: vi.fn(async () => {
      running.value = true
      return { ok: true as const, running: true }
    }),
    stop: vi.fn(async () => {
      running.value = false
    }),
    status: vi.fn(() => ({ ok: true as const, running: running.value })),
    version: vi.fn(() => HELPER_PROTOCOL_VERSION),
    ...overrides,
  }
}

/**
 * A persistent client connection that sequences requests over ONE socket, the
 * way the real app holds a single connection for the kernel's lifetime. Each
 * `send` resolves with the next response frame; `close` ends the connection.
 */
function openClient(socketPath: string): {
  send: (request: HelperRequest) => Promise<HelperResponse>
  close: () => void
} {
  const socket = connect(socketPath)
  let buffer = ''
  const pending: Array<(res: HelperResponse) => void> = []

  socket.setEncoding('utf8')
  socket.on('data', (chunk: string) => {
    buffer += chunk
    const { messages, rest } = parseMessages<HelperResponse>(buffer)
    buffer = rest
    for (const msg of messages) {
      const resolve = pending.shift()
      if (resolve) resolve(msg)
    }
  })

  return {
    send(request) {
      return new Promise((resolve) => {
        pending.push(resolve)
        socket.write(encodeMessage(request))
      })
    },
    close() {
      socket.end()
    },
  }
}

/** A short-lived client connection that sends one request and reads one response. */
async function roundTrip(
  socketPath: string,
  request: HelperRequest,
): Promise<HelperResponse> {
  const client = openClient(socketPath)
  try {
    return await client.send(request)
  } finally {
    client.close()
  }
}

describe('createHelperServer', () => {
  let dir: string
  let socketPath: string
  let server: HelperServer | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcxd-helper-'))
    socketPath = join(dir, 'helper.sock')
    server = undefined
  })

  afterEach(async () => {
    if (server) await server.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('answers ping over a real unix socket', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'ping',
      secret: SECRET,
      version: HELPER_PROTOCOL_VERSION,
    })

    expect(res).toEqual({
      type: 'ping',
      ok: true,
      version: HELPER_PROTOCOL_VERSION,
    })
  })

  it('reports the kernel version on getVersion', async () => {
    const kernel = fakeKernel({ version: () => '7' })
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'getVersion',
      secret: SECRET,
      version: HELPER_PROTOCOL_VERSION,
    })

    expect(res.type).toBe('getVersion')
    expect(res.ok).toBe(true)
    expect(res.version).toBe('7')
  })

  it('dispatches startKernel to the injected kernel and returns its result', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'startKernel',
      secret: SECRET,
      version: HELPER_PROTOCOL_VERSION,
      binaryPath: '/opt/mihomo',
      homeDir: '/home/.config/mihomo',
      configPath: '/home/.config/mihomo/config.yaml',
    })

    expect(kernel.start).toHaveBeenCalledWith({
      binaryPath: '/opt/mihomo',
      homeDir: '/home/.config/mihomo',
      configPath: '/home/.config/mihomo/config.yaml',
    })
    expect(res).toEqual({
      type: 'startKernel',
      ok: true,
      version: HELPER_PROTOCOL_VERSION,
      running: true,
    })
  })

  it('returns the kernel running state on status', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    // start + status share ONE connection (real usage), so the anti-residual
    // disconnect-stop does not fire between the two requests.
    const client = openClient(socketPath)
    try {
      await client.send({
        type: 'startKernel',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
        binaryPath: '/opt/mihomo',
        homeDir: '/home',
        configPath: '/home/config.yaml',
      })

      const res = await client.send({
        type: 'status',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      })

      expect(res).toEqual({
        type: 'status',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
        running: true,
      })
    } finally {
      client.close()
    }
  })

  it('dispatches stopKernel to the injected kernel', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'stopKernel',
      secret: SECRET,
      version: HELPER_PROTOCOL_VERSION,
    })

    expect(kernel.stop).toHaveBeenCalledTimes(1)
    expect(res).toEqual({
      type: 'stopKernel',
      ok: true,
      version: HELPER_PROTOCOL_VERSION,
    })
  })

  it('rejects a request whose secret does not match (no dispatch)', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'startKernel',
      secret: 'WRONG',
      version: HELPER_PROTOCOL_VERSION,
      binaryPath: '/opt/mihomo',
      homeDir: '/home',
      configPath: '/home/config.yaml',
    })

    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/secret/i)
    // The injected kernel must NOT have been touched on auth failure.
    expect(kernel.start).not.toHaveBeenCalled()
  })

  it('rejects a request whose protocol version does not match', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const res = await roundTrip(socketPath, {
      type: 'ping',
      secret: SECRET,
      version: 'incompatible-999',
    })

    expect(res.ok).toBe(false)
    expect((res as { error: string }).error).toMatch(/version/i)
    // The helper still reports ITS version so the client can detect the mismatch.
    expect(res.version).toBe(HELPER_PROTOCOL_VERSION)
  })

  it('stops the kernel when a client disconnects (anti-residual)', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    // Start the kernel, then drop the connection without sending stopKernel.
    await roundTrip(socketPath, {
      type: 'startKernel',
      secret: SECRET,
      version: HELPER_PROTOCOL_VERSION,
      binaryPath: '/opt/mihomo',
      homeDir: '/home',
      configPath: '/home/config.yaml',
    })

    await vi.waitFor(() => {
      expect(kernel.stop).toHaveBeenCalled()
    })
    expect(kernel.running.value).toBe(false)
  })

  it('stops the kernel when the server is closed (anti-residual)', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    await server.close()
    server = undefined

    expect(kernel.stop).toHaveBeenCalled()
  })
})
