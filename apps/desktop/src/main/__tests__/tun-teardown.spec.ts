import type { TunController } from '@metacubexd/agent/types'
import { describe, expect, it, vi } from 'vitest'
import { createTunTeardown } from '../tun-teardown'

/**
 * Build a fake TunController whose status()/disable() are recording stubs. None
 * of these touch the real OS: no elevation, no TUN device, no privileged spawn.
 * The default is sidecar mode; override `status` to report tun.
 */
function fakeTunController(
  overrides: Partial<TunController> = {},
): TunController {
  return {
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    status: vi.fn(async () => ({ enabled: false, mode: 'sidecar' as const })),
    ...overrides,
  }
}

describe('createTunTeardown', () => {
  describe('recoverNetwork()', () => {
    it('disables the controller when status reports tun mode', async () => {
      const tunController = fakeTunController({
        status: vi.fn(async () => ({
          enabled: true,
          mode: 'tun' as const,
          stack: 'gvisor',
        })),
      })
      const teardown = createTunTeardown({ tunController })

      await teardown.recoverNetwork()

      expect(tunController.status).toHaveBeenCalledTimes(1)
      expect(tunController.disable).toHaveBeenCalledTimes(1)
    })

    it('does nothing when status reports sidecar mode', async () => {
      const tunController = fakeTunController()
      const teardown = createTunTeardown({ tunController })

      await teardown.recoverNetwork()

      expect(tunController.status).toHaveBeenCalledTimes(1)
      expect(tunController.disable).not.toHaveBeenCalled()
    })

    it('logs a throwing disable() and does not propagate', async () => {
      const err = new Error('helper disconnect failed')
      const tunController = fakeTunController({
        status: vi.fn(async () => ({
          enabled: true,
          mode: 'tun' as const,
          stack: 'gvisor',
        })),
        disable: vi.fn(async () => {
          throw err
        }),
      })
      const logError = vi.fn()
      const teardown = createTunTeardown({ tunController, logError })

      // never throws out of recoverNetwork (anti-lockout: quit/crash must not be
      // blocked by a teardown failure)
      await expect(teardown.recoverNetwork()).resolves.toBeUndefined()

      // but the error IS surfaced to the logger (not silently swallowed)
      expect(logError).toHaveBeenCalledTimes(1)
      expect(logError).toHaveBeenCalledWith(err)
    })

    it('logs a throwing status() and does not propagate', async () => {
      const err = new Error('status read failed')
      const tunController = fakeTunController({
        status: vi.fn(async () => {
          throw err
        }),
      })
      const logError = vi.fn()
      const teardown = createTunTeardown({ tunController, logError })

      await expect(teardown.recoverNetwork()).resolves.toBeUndefined()

      expect(logError).toHaveBeenCalledTimes(1)
      expect(logError).toHaveBeenCalledWith(err)
      expect(tunController.disable).not.toHaveBeenCalled()
    })

    it('works without a logError dep (defaults to console.error)', async () => {
      const tunController = fakeTunController({
        status: vi.fn(async () => ({
          enabled: true,
          mode: 'tun' as const,
          stack: 'gvisor',
        })),
        disable: vi.fn(async () => {
          throw new Error('boom')
        }),
      })
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const teardown = createTunTeardown({ tunController })

      await expect(teardown.recoverNetwork()).resolves.toBeUndefined()

      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })
})
