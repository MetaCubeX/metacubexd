// packages/ui/composables/__tests__/useDnsSettings.spec.ts
import type { Config } from '~/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDnsSettings } from '../useDnsSettings'

// Hoisted so the vue-sonner mock factory (runs before the module body) can
// reference it.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    dns: {
      enable: true,
      'enhanced-mode': 'fake-ip',
      nameserver: ['223.5.5.5', '119.29.29.29'],
      fallback: ['8.8.8.8', '1.1.1.1'],
      'fake-ip-range': '198.18.0.1/16',
      'use-hosts': true,
    },
    ...overrides,
  } as unknown as Config
}

describe('composables/useDnsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncFromConfig populates the form from the loaded config dns object', () => {
    const dns = useDnsSettings({ mutate: vi.fn() })
    dns.syncFromConfig(makeConfig())

    expect(dns.form.enhancedMode).toBe('fake-ip')
    // multiline lists join the array with newlines for textarea editing
    expect(dns.form.nameserver).toBe('223.5.5.5\n119.29.29.29')
    expect(dns.form.fallback).toBe('8.8.8.8\n1.1.1.1')
    expect(dns.form.fakeIpRange).toBe('198.18.0.1/16')
    expect(dns.form.useHosts).toBe(true)
  })

  it('syncFromConfig tolerates a config without a dns object (defaults)', () => {
    const dns = useDnsSettings({ mutate: vi.fn() })
    dns.syncFromConfig(makeConfig({ dns: undefined as any }))

    expect(dns.form.enhancedMode).toBe('fake-ip')
    expect(dns.form.nameserver).toBe('')
    expect(dns.form.fallback).toBe('')
    expect(dns.form.fakeIpRange).toBe('')
    expect(dns.form.useHosts).toBe(false)
  })

  it('buildPayload maps the form to the mihomo dns config keys', () => {
    const dns = useDnsSettings({ mutate: vi.fn() })
    dns.syncFromConfig(makeConfig())
    dns.form.nameserver = '1.1.1.1\n8.8.8.8'
    dns.form.fallback = ''
    dns.form.enhancedMode = 'redir-host'
    dns.form.fakeIpRange = '198.18.0.1/16'
    dns.form.useHosts = false

    expect(dns.buildPayload()).toEqual({
      'enhanced-mode': 'redir-host',
      nameserver: ['1.1.1.1', '8.8.8.8'],
      fallback: [],
      'fake-ip-range': '198.18.0.1/16',
      'use-hosts': false,
    })
  })

  it('buildPayload trims and drops blank lines in the nameserver/fallback lists', () => {
    const dns = useDnsSettings({ mutate: vi.fn() })
    dns.form.nameserver = '  1.1.1.1  \n\n   \n 8.8.8.8'
    dns.form.fallback = '\n9.9.9.9\n'

    const payload = dns.buildPayload()
    expect(payload.nameserver).toEqual(['1.1.1.1', '8.8.8.8'])
    expect(payload.fallback).toEqual(['9.9.9.9'])
  })

  it('save PATCHes { dns } via the update mutation with the built payload', async () => {
    const mutate = vi.fn().mockResolvedValue(undefined)
    const dns = useDnsSettings({ mutate })
    dns.syncFromConfig(makeConfig())
    dns.form.enhancedMode = 'redir-host'

    await dns.save()

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({
      key: 'dns',
      value: {
        'enhanced-mode': 'redir-host',
        nameserver: ['223.5.5.5', '119.29.29.29'],
        fallback: ['8.8.8.8', '1.1.1.1'],
        'fake-ip-range': '198.18.0.1/16',
        'use-hosts': true,
      },
    })
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('save surfaces failures via toast.error and does not swallow them', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('patch failed'))
    const dns = useDnsSettings({ mutate })
    dns.syncFromConfig(makeConfig())

    await dns.save()

    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(dns.saving.value).toBe(false)
  })

  it('saving() reflects the in-flight mutation so the save button can disable', async () => {
    let resolveMutate: (v: unknown) => void = () => {}
    const mutate = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveMutate = res
      }),
    )
    const dns = useDnsSettings({ mutate })
    dns.syncFromConfig(makeConfig())

    const p = dns.save()
    expect(dns.saving.value).toBe(true)
    resolveMutate(undefined)
    await p
    expect(dns.saving.value).toBe(false)
  })
})
