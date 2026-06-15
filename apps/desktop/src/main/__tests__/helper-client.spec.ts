import type { HelperKernel, HelperServer } from '../helper/server'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHelperClient } from '../helper/client'
import { HELPER_PROTOCOL_VERSION } from '../helper/protocol'
import { createHelperServer } from '../helper/server'

const SECRET = 'shared-install-secret'

/**
 * In-memory injected kernel stub standing in for the privileged mihomo spawn.
 * The client tests run end-to-end against the REAL T2 server over a REAL unix
 * socket — but NEVER spawn a real process; every side effect is recorded here.
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

describe('createHelperClient', () => {
  let dir: string
  let socketPath: string
  let server: HelperServer | undefined

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mcxd-helper-client-'))
    socketPath = join(dir, 'helper.sock')
    server = undefined
  })

  afterEach(async () => {
    if (server) await server.close()
    await rm(dir, { recursive: true, force: true })
  })

  it('ping() round-trips against the real server', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      const res = await client.ping()
      expect(res).toEqual({
        type: 'ping',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
      })
    } finally {
      await client.close()
    }
  })

  it('getVersion() returns the helper version', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      const res = await client.getVersion()
      expect(res.ok).toBe(true)
      expect(res.version).toBe(HELPER_PROTOCOL_VERSION)
    } finally {
      await client.close()
    }
  })

  it('startKernel() forwards opts and resolves the running result', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      const res = await client.startKernel({
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
    } finally {
      await client.close()
    }
  })

  it('status() reflects the kernel running state over ONE connection', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      await client.startKernel({
        binaryPath: '/opt/mihomo',
        homeDir: '/home',
        configPath: '/home/config.yaml',
      })
      const res = await client.status()
      expect(res).toEqual({
        type: 'status',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
        running: true,
      })
    } finally {
      await client.close()
    }
  })

  it('stopKernel() dispatches to the injected kernel', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      await client.startKernel({
        binaryPath: '/opt/mihomo',
        homeDir: '/home',
        configPath: '/home/config.yaml',
      })
      const res = await client.stopKernel()
      expect(kernel.stop).toHaveBeenCalled()
      expect(res).toEqual({
        type: 'stopKernel',
        ok: true,
        version: HELPER_PROTOCOL_VERSION,
      })
    } finally {
      await client.close()
    }
  })

  it('sequences multiple requests over ONE persistent connection (FIFO correlation)', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      const [a, b, c] = await Promise.all([
        client.ping(),
        client.getVersion(),
        client.status(),
      ])
      expect(a.type).toBe('ping')
      expect(b.type).toBe('getVersion')
      expect(c.type).toBe('status')
    } finally {
      await client.close()
    }
  })

  it('rejects (does not swallow) when the server returns a secret mismatch', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    // Client carries the WRONG secret — the server replies ok:false.
    const client = createHelperClient({ socketPath, secret: 'WRONG' })
    try {
      await expect(
        client.startKernel({
          binaryPath: '/opt/mihomo',
          homeDir: '/home',
          configPath: '/home/config.yaml',
        }),
      ).rejects.toThrow(/secret/i)
      // The injected kernel must NOT have been touched on auth failure.
      expect(kernel.start).not.toHaveBeenCalled()
    } finally {
      await client.close()
    }
  })

  it('getVersion() throws a clear version-mismatch error when the helper is stale', async () => {
    // Helper reports a DIFFERENT protocol version than the client speaks.
    const kernel = fakeKernel({ version: () => 'stale-helper-999' })
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({ socketPath, secret: SECRET })
    try {
      await expect(client.getVersion()).rejects.toThrow(/version/i)
    } finally {
      await client.close()
    }
  })

  it('request() rejects on timeout when the server never responds', async () => {
    // A server that accepts the connection but never replies to any frame.
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })
    // Replace the connection handler so incoming requests are read but ignored.
    server.server.removeAllListeners('connection')
    server.server.on('connection', (socket) => {
      socket.setEncoding('utf8')
      socket.on('data', () => {})
      socket.on('error', () => {})
    })

    const client = createHelperClient({
      socketPath,
      secret: SECRET,
      timeoutMs: 50,
    })
    try {
      await expect(client.ping()).rejects.toThrow(/timeout|timed out/i)
    } finally {
      await client.close()
    }
  })

  it('rejects in-flight requests (never swallows) when the socket errors', async () => {
    const kernel = fakeKernel()
    server = await createHelperServer({ socketPath, secret: SECRET, kernel })

    const client = createHelperClient({
      socketPath,
      secret: SECRET,
      timeoutMs: 1000,
    })
    try {
      const pending = client.status()
      // Drop the server out from under the in-flight request.
      await server.close()
      server = undefined
      await expect(pending).rejects.toThrow()
    } finally {
      await client.close()
    }
  })
})
