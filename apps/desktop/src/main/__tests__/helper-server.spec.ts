import type { HelperRequest, HelperResponse } from '../helper/protocol'
import type { HelperKernel, HelperServer } from '../helper/server'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  lstat,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
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

  it('allows an unprivileged app to connect to the service socket on Unix', async () => {
    server = await createHelperServer({
      socketPath,
      secret: SECRET,
      kernel: fakeKernel(),
    })

    expect((await lstat(socketPath)).mode & 0o777).toBe(0o666)
  })

  it('recovers a socket left by a crashed helper', async () => {
    const child = spawn(
      process.execPath,
      [
        '-e',
        `
      require('node:net').createServer().listen(process.argv[1], () => {
        process.stdout.write('ready');
      });
    `,
        socketPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    try {
      await once(child.stdout!, 'data')
    } finally {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
    expect((await lstat(socketPath)).isSocket()).toBe(true)

    server = await createHelperServer({
      socketPath,
      secret: SECRET,
      kernel: fakeKernel(),
    })
    expect(
      await roundTrip(socketPath, {
        type: 'ping',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      }),
    ).toMatchObject({ ok: true })
  })

  it('preserves a live helper and its kernel during a concurrent startup', async () => {
    const kernel = fakeKernel()
    kernel.running.value = true
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    await expect(
      createHelperServer({ socketPath, secret: SECRET, kernel: fakeKernel() }),
    ).rejects.toMatchObject({ code: 'EADDRINUSE' })
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(kernel.stop).not.toHaveBeenCalled()
    expect(kernel.running.value).toBe(true)
    expect(
      await roundTrip(socketPath, {
        type: 'ping',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      }),
    ).toMatchObject({ ok: true })
  })

  it('does not delete a regular file or symlink at the socket path', async () => {
    await writeFile(socketPath, 'preserve me')
    await expect(
      createHelperServer({ socketPath, secret: SECRET, kernel: fakeKernel() }),
    ).rejects.toThrow('non-socket')
    expect(await readFile(socketPath, 'utf8')).toBe('preserve me')

    await rm(socketPath)
    const target = join(dir, 'target')
    await writeFile(target, 'preserve target')
    await symlink(target, socketPath)
    await expect(
      createHelperServer({ socketPath, secret: SECRET, kernel: fakeKernel() }),
    ).rejects.toThrow('non-socket')
    expect((await lstat(socketPath)).isSymbolicLink()).toBe(true)
    expect(await readFile(target, 'utf8')).toBe('preserve target')
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
    expect(res).toMatchObject({ instanceId: expect.any(String) })
    expect(
      await roundTrip(socketPath, {
        type: 'getVersion',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      }),
    ).toMatchObject({ instanceId: res.ok ? res.instanceId : undefined })
  })

  it('allows an authenticated version probe from a different protocol version', async () => {
    server = await createHelperServer({
      socketPath,
      secret: SECRET,
      kernel: fakeKernel(),
    })

    expect(
      await roundTrip(socketPath, {
        type: 'getVersion',
        secret: SECRET,
        version: 'older-version',
      }),
    ).toEqual({
      type: 'getVersion',
      ok: true,
      version: HELPER_PROTOCOL_VERSION,
      instanceId: expect.any(String),
    })
    expect(
      await roundTrip(socketPath, {
        type: 'getVersion',
        secret: 'WRONG',
        version: 'older-version',
      }),
    ).toEqual({
      type: 'getVersion',
      ok: false,
      version: HELPER_PROTOCOL_VERSION,
      error: 'helper: shared secret mismatch',
    })
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
    expect((res as { error: string }).error.toLowerCase()).toContain('secret')
    // The injected kernel must NOT have been touched on auth failure.
    expect(kernel.start).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(kernel.stop).not.toHaveBeenCalled()
  })

  it('rejects malformed unauthenticated frames without stopping the kernel or server', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    for (const frame of ['invalid JSON\n', 'null\n']) {
      const client = connect(socketPath)
      const closed = once(client, 'close')
      client.write(frame)
      await closed
    }

    expect(kernel.stop).not.toHaveBeenCalled()
    expect(
      await roundTrip(socketPath, {
        type: 'ping',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      }),
    ).toMatchObject({ ok: true })
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
    expect((res as { error: string }).error.toLowerCase()).toContain('version')
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

  it("does not stop another connection's kernel when an authenticated probe disconnects", async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })
    const owner = openClient(socketPath)
    try {
      await owner.send({
        type: 'startKernel',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
        binaryPath: '/opt/mihomo',
        homeDir: '/home',
        configPath: '/home/config.yaml',
      })
      await roundTrip(socketPath, {
        type: 'getVersion',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
      })
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(kernel.stop).not.toHaveBeenCalled()
      expect(kernel.running.value).toBe(true)
    } finally {
      owner.close()
    }
  })

  it('logs disconnect cleanup failures instead of rejecting without a handler', async () => {
    const error = new Error('kernel did not exit')
    const kernel = fakeKernel({
      stop: vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined),
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      server = await createHelperServer({ socketPath, secret: SECRET, kernel })
      await roundTrip(socketPath, {
        type: 'startKernel',
        secret: SECRET,
        version: HELPER_PROTOCOL_VERSION,
        binaryPath: '/opt/mihomo',
        homeDir: '/home',
        configPath: '/home/config.yaml',
      })
      await vi.waitFor(() => expect(log).toHaveBeenCalledWith(error))
    } finally {
      log.mockRestore()
    }
  })

  it('stops the kernel when the server is closed (anti-residual)', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    await server.close()
    server = undefined

    expect(kernel.stop).toHaveBeenCalled()
  })

  it('propagates kernel cleanup failures on explicit server close', async () => {
    server = await createHelperServer({
      socketPath,
      secret: SECRET,
      kernel: fakeKernel({
        stop: vi.fn().mockRejectedValue(new Error('cannot stop kernel')),
      }),
    })

    await expect(server.close()).rejects.toThrow('cannot stop kernel')
    server = undefined
  })
})
