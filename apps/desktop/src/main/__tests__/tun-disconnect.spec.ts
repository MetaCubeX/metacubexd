import type { Socket } from 'node:net'
import type { HelperKernel } from '../helper/server'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createHelperClient } from '../helper/client'
import { createHelperServer } from '../helper/server'
import { createTunRuntime } from '../tun-runtime'

describe('tun recovery over a real helper connection', () => {
  it.each(['changed', 'legacy'])(
    'does not replace a possibly orphaned kernel after a %s helper handshake',
    async (scenario) => {
      let instanceId = scenario === 'legacy' ? undefined : 'original-helper'
      let disconnected!: () => void
      const startSidecar = vi.fn(async () => {})
      const stopKernel = vi.fn(async () => ({
        type: 'stopKernel' as const,
        ok: true as const,
        version: '1',
      }))
      const logError = vi.fn()
      const runtime = createTunRuntime({
        installer: {
          isInstalled: async () => true,
          install: async () => {},
          uninstall: async () => {},
          installedVersion: async () => '1',
        },
        connectClient: (callback) => {
          disconnected = callback
          return {
            ping: async () => ({ type: 'ping', ok: true, version: '1' }),
            getVersion: async () => ({
              type: 'getVersion',
              ok: true,
              version: '1',
              instanceId,
            }),
            startKernel: async () => ({
              type: 'startKernel',
              ok: true,
              version: '1',
              running: true,
            }),
            stopKernel,
            status: async () => ({
              type: 'status',
              ok: true,
              version: '1',
              running: true,
            }),
            close: async () => {},
          }
        },
        supervisor: { start: startSidecar, stop: async () => {} },
        setSection: async () => {},
        kernelOptions: () => ({
          binaryPath: '/fake/mihomo',
          homeDir: '/fake/home',
          configPath: '/fake/config',
        }),
        installOptions: () => ({
          electronBin: '/fake/electron',
          helperEntry: '/fake/helper',
          socketPath: '/fake/socket',
          secret: 'test-only',
        }),
        logError,
      })
      await runtime.controller.enable({ stack: 'mixed' })
      instanceId = scenario === 'legacy' ? undefined : 'replacement-helper'
      disconnected()
      await runtime.teardown.recoverNetwork()
      expect(startSidecar).not.toHaveBeenCalled()
      expect(stopKernel).not.toHaveBeenCalled()
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('instance'),
        }),
      )
      expect(runtime.isTunMode()).toBe(true)
    },
  )

  it('reconnects and confirms the privileged kernel stopped before starting the sidecar', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcxd-tun-recovery-'))
    const socketPath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\mcxd-tun-recovery-${process.pid}-${Date.now()}`
        : join(dir, 'helper.sock')
    const sockets: Socket[] = []
    let running = false
    let confirmStopped!: () => void
    const stopped = new Promise<void>((resolve) => {
      confirmStopped = resolve
    })
    const kernel: HelperKernel = {
      start: async () => {
        running = true
        return { ok: true, running }
      },
      stop: vi.fn(async () => {
        await stopped
        running = false
      }),
      status: () => ({ ok: true, running }),
      version: () => '1',
    }
    const server = await createHelperServer({
      socketPath,
      secret: 'test-only',
      kernel,
    })
    server.server.on('connection', (socket) => sockets.push(socket))
    const startSidecar = vi.fn(async () => {
      expect(running).toBe(false)
    })
    const setSection = vi.fn(async () => {})
    const errors: unknown[] = []
    const runtime = createTunRuntime({
      installer: {
        isInstalled: async () => true,
        install: async () => {},
        uninstall: async () => {},
        installedVersion: async () => '1',
      },
      connectClient: (onDisconnect) =>
        createHelperClient({
          socketPath,
          secret: 'test-only',
          timeoutMs: 100,
          onDisconnect,
        }),
      supervisor: { start: startSidecar, stop: async () => {} },
      setSection,
      kernelOptions: () => ({
        binaryPath: '/fake/mihomo',
        homeDir: '/fake/home',
        configPath: '/fake/config',
      }),
      installOptions: () => ({
        electronBin: '/fake/electron',
        helperEntry: '/fake/helper',
        socketPath,
        secret: 'test-only',
      }),
      onHelperDisconnect: () => {
        void runtime.teardown.recoverNetwork()
      },
      logError: (error) => errors.push(error),
    })
    try {
      await runtime.controller.enable({ stack: 'mixed' })
      sockets[0]!.destroy()
      await vi.waitFor(() => expect(sockets).toHaveLength(2))
      expect(startSidecar).not.toHaveBeenCalled()
      expect(running).toBe(true)
      confirmStopped()
      await vi.waitFor(() => expect(startSidecar).toHaveBeenCalledOnce(), {
        timeout: 1500,
      })
      expect(await runtime.controller.status()).toEqual({
        enabled: false,
        mode: 'sidecar',
      })
      expect(runtime.isTunMode()).toBe(false)
      expect(setSection).toHaveBeenLastCalledWith('tun', null)
      expect(errors).toEqual([])
    } finally {
      confirmStopped()
      for (const socket of sockets) socket.destroy()
      await server.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps ownership when the reconnected helper cannot confirm a stop, then permits a retry', async () => {
    let disconnected!: () => void
    let stopFails = true
    const stopKernel = vi.fn(async () => {
      if (stopFails) throw new Error('kernel still running')
      return { type: 'stopKernel' as const, ok: true as const, version: '1' }
    })
    const startSidecar = vi.fn(async () => {})
    const removeTun = vi.fn(async () => {})
    const logError = vi.fn()
    const runtime = createTunRuntime({
      installer: {
        isInstalled: async () => true,
        install: async () => {},
        uninstall: async () => {},
        installedVersion: async () => '1',
      },
      connectClient: (callback) => {
        disconnected = callback
        return {
          ping: async () => ({ type: 'ping', ok: true, version: '1' }),
          getVersion: async () => ({
            type: 'getVersion',
            ok: true,
            version: '1',
            instanceId: 'same-helper',
          }),
          startKernel: async () => ({
            type: 'startKernel',
            ok: true,
            running: true,
            version: '1',
          }),
          stopKernel,
          status: async () => ({
            type: 'status',
            ok: true,
            running: true,
            version: '1',
          }),
          close: async () => {},
        }
      },
      supervisor: { start: startSidecar, stop: async () => {} },
      setSection: async (_key, value) => {
        if (value === null) await removeTun()
      },
      kernelOptions: () => ({
        binaryPath: '/fake/mihomo',
        homeDir: '/fake/home',
        configPath: '/fake/config',
      }),
      installOptions: () => ({
        electronBin: '/fake/electron',
        helperEntry: '/fake/helper',
        socketPath: '/fake/socket',
        secret: 'test-only',
      }),
      logError,
    })
    await runtime.controller.enable({ stack: 'mixed' })
    disconnected()
    await runtime.teardown.recoverNetwork()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'kernel still running' }),
    )
    expect(startSidecar).not.toHaveBeenCalled()
    expect(removeTun).not.toHaveBeenCalled()
    expect(runtime.isTunMode()).toBe(true)
    stopFails = false
    await runtime.controller.disable()
    expect(startSidecar).toHaveBeenCalledOnce()
    expect(runtime.isTunMode()).toBe(false)
  })
})
