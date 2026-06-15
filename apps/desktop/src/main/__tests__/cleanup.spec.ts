import type { SystemProxyController } from '@metacubexd/agent/types'
import { describe, expect, it, vi } from 'vitest'
import { runShutdownCleanup } from '../cleanup'

function fakeSysProxy(
  overrides: Partial<SystemProxyController> = {},
): SystemProxyController {
  return {
    isEnabled: vi.fn(async () => false),
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    setAutoProxy: vi.fn(async () => {}),
    disableAutoProxy: vi.fn(async () => {}),
    describe: vi.fn(() => ({ port: 7890, bypass: [] })),
    ...overrides,
  }
}

describe('runShutdownCleanup', () => {
  it('disables the system proxy, stops the kernel and stops the control server', async () => {
    const order: string[] = []
    const systemProxy = fakeSysProxy({
      disable: vi.fn(async () => {
        order.push('sysproxy.disable')
      }),
    })
    const stopKernel = vi.fn(async () => {
      order.push('stopKernel')
    })
    const stopControlServer = vi.fn(async () => {
      order.push('stopControlServer')
    })

    await runShutdownCleanup({
      systemProxy,
      stopKernel,
      stopControlServer,
    })

    expect(systemProxy.disable).toHaveBeenCalledTimes(1)
    expect(stopKernel).toHaveBeenCalledTimes(1)
    expect(stopControlServer).toHaveBeenCalledTimes(1)
    // Anti-lockout: the OS proxy must be released alongside the kernel stop.
    expect(order).toContain('sysproxy.disable')
  })

  it('still stops the kernel + control server when disabling the proxy throws', async () => {
    const systemProxy = fakeSysProxy({
      disable: vi.fn(async () => {
        throw new Error('networksetup blew up')
      }),
    })
    const stopKernel = vi.fn(async () => {})
    const stopControlServer = vi.fn(async () => {})

    await expect(
      runShutdownCleanup({ systemProxy, stopKernel, stopControlServer }),
    ).resolves.toBeUndefined()

    expect(stopKernel).toHaveBeenCalledTimes(1)
    expect(stopControlServer).toHaveBeenCalledTimes(1)
  })

  it('is a no-op-safe when no system proxy controller is provided', async () => {
    const stopKernel = vi.fn(async () => {})
    const stopControlServer = vi.fn(async () => {})

    await expect(
      runShutdownCleanup({ stopKernel, stopControlServer }),
    ).resolves.toBeUndefined()

    expect(stopKernel).toHaveBeenCalledTimes(1)
    expect(stopControlServer).toHaveBeenCalledTimes(1)
  })

  it('still stops the control server when stopping the kernel throws', async () => {
    const systemProxy = fakeSysProxy()
    const stopKernel = vi.fn(async () => {
      throw new Error('kernel stop failed')
    })
    const stopControlServer = vi.fn(async () => {})

    await expect(
      runShutdownCleanup({ systemProxy, stopKernel, stopControlServer }),
    ).resolves.toBeUndefined()

    expect(systemProxy.disable).toHaveBeenCalledTimes(1)
    expect(stopControlServer).toHaveBeenCalledTimes(1)
  })
})
