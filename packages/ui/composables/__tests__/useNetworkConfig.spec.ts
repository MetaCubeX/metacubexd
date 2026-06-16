// packages/ui/composables/__tests__/useNetworkConfig.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNetworkConfig } from '../useNetworkConfig'

const api = {
  getConfigSection: vi.fn(),
  setConfigSection: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

// hasFeature is driven by the gating probe; toggle it per test.
let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'config-sections',
  }),
}))

// Errors surface via toast (never swallowed).
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))

describe('composables/useNetworkConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    featurePresent = true
    // getConfigSection resolves per-key from this map.
    api.getConfigSection.mockImplementation((key: string) => {
      const sections: Record<string, unknown> = {
        tunnels: [
          {
            network: ['tcp'],
            address: '127.0.0.1:1080',
            target: 'example.com:80',
          },
        ],
        sniffer: {
          enable: true,
          'override-destination': false,
          sniff: { HTTP: { ports: [80] } },
        },
        'interface-name': 'eth0',
        'external-controller': '127.0.0.1:9090',
        secret: 's3cr3t',
      }
      return Promise.resolve(sections[key] ?? null)
    })
    api.setConfigSection.mockResolvedValue({ status: 'running' })
  })

  it('available reflects hasFeature(config-sections) — true when present', () => {
    expect(useNetworkConfig().available.value).toBe(true)
  })

  it('available is false when the config-sections feature is absent', () => {
    featurePresent = false
    expect(useNetworkConfig().available.value).toBe(false)
  })

  // ---- tunnels (array editor) ---------------------------------------------
  it('load() GETs every network section and parses tunnels into rows', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    expect(api.getConfigSection).toHaveBeenCalledWith('tunnels')
    expect(api.getConfigSection).toHaveBeenCalledWith('sniffer')
    expect(api.getConfigSection).toHaveBeenCalledWith('interface-name')
    expect(api.getConfigSection).toHaveBeenCalledWith('external-controller')
    expect(api.getConfigSection).toHaveBeenCalledWith('secret')
    expect(nc.tunnels.value).toEqual([
      {
        network: ['tcp'],
        address: '127.0.0.1:1080',
        target: 'example.com:80',
      },
    ])
  })

  it('load() tolerates a null/absent tunnels section as an empty array', async () => {
    api.getConfigSection.mockImplementation((key: string) =>
      Promise.resolve(key === 'tunnels' ? null : null),
    )
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.tunnels.value).toEqual([])
  })

  it('addTunnel() appends a blank tunnel row', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.addTunnel()
    expect(nc.tunnels.value.at(-1)).toEqual({
      network: ['tcp'],
      address: '',
      target: '',
    })
  })

  it('removeTunnel() drops the tunnel at the given index', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.addTunnel()
    nc.removeTunnel(0)
    expect(nc.tunnels.value).toEqual([
      { network: ['tcp'], address: '', target: '' },
    ])
  })

  it('saveTunnels() PUTs the tunnels section ONCE', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.addTunnel()
    const ok = await nc.saveTunnels()
    expect(ok).toBe(true)
    expect(api.setConfigSection).toHaveBeenCalledTimes(1)
    expect(api.setConfigSection).toHaveBeenCalledWith({
      key: 'tunnels',
      value: [
        {
          network: ['tcp'],
          address: '127.0.0.1:1080',
          target: 'example.com:80',
        },
        { network: ['tcp'], address: '', target: '' },
      ],
    })
  })

  it('saveTunnels() surfaces failures via toast.error and returns false', async () => {
    api.setConfigSection.mockRejectedValue(new Error('boom'))
    const nc = useNetworkConfig()
    await nc.load()
    const ok = await nc.saveTunnels()
    expect(ok).toBe(false)
    expect(toast.error).toHaveBeenCalled()
    expect(nc.saving.value).toBe(false)
  })

  it('savingKey marks only the in-flight section (not a global flag)', async () => {
    let resolveSet: (v: unknown) => void = () => {}
    api.setConfigSection.mockReturnValue(
      new Promise((res) => {
        resolveSet = res
      }),
    )
    const nc = useNetworkConfig()
    await nc.load()
    const p = nc.saveTunnels()
    expect(nc.savingKey.value).toBe('tunnels')
    expect(nc.saving.value).toBe(true)
    resolveSet({ status: 'running' })
    await p
    expect(nc.savingKey.value).toBe(null)
    expect(nc.saving.value).toBe(false)
  })

  // ---- sniffer (object editor) --------------------------------------------
  it('load() parses sniffer enable / override-destination toggles', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.sniffer.enable).toBe(true)
    expect(nc.sniffer.overrideDestination).toBe(false)
  })

  it('load() tolerates a null sniffer section with defaults (disabled)', async () => {
    api.getConfigSection.mockImplementation(() => Promise.resolve(null))
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.sniffer.enable).toBe(false)
    expect(nc.sniffer.overrideDestination).toBe(false)
  })

  it('saveSniffer() PUTs the sniffer section preserving the sniff settings', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.sniffer.enable = false
    nc.sniffer.overrideDestination = true
    const ok = await nc.saveSniffer()
    expect(ok).toBe(true)
    expect(api.setConfigSection).toHaveBeenCalledWith({
      key: 'sniffer',
      value: {
        enable: false,
        'override-destination': true,
        // the existing sniff sub-tree is preserved on round-trip.
        sniff: { HTTP: { ports: [80] } },
      },
    })
  })

  it('saveSniffer() surfaces failures via toast.error and returns false', async () => {
    api.setConfigSection.mockRejectedValue(new Error('boom'))
    const nc = useNetworkConfig()
    await nc.load()
    const ok = await nc.saveSniffer()
    expect(ok).toBe(false)
    expect(toast.error).toHaveBeenCalled()
  })

  // ---- interface-name (string editor) -------------------------------------
  it('load() parses interface-name as a string', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.interfaceName.value).toBe('eth0')
  })

  it('load() tolerates a null interface-name as empty string', async () => {
    api.getConfigSection.mockImplementation(() => Promise.resolve(null))
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.interfaceName.value).toBe('')
  })

  it('saveInterfaceName() PUTs the interface-name section', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.interfaceName.value = 'en0'
    const ok = await nc.saveInterfaceName()
    expect(ok).toBe(true)
    expect(api.setConfigSection).toHaveBeenCalledWith({
      key: 'interface-name',
      value: 'en0',
    })
  })

  it('saveInterfaceName() clears the section (null) when set to empty', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    nc.interfaceName.value = ''
    await nc.saveInterfaceName()
    expect(api.setConfigSection).toHaveBeenCalledWith({
      key: 'interface-name',
      value: null,
    })
  })

  it('saveInterfaceName() surfaces failures via toast.error and returns false', async () => {
    api.setConfigSection.mockRejectedValue(new Error('boom'))
    const nc = useNetworkConfig()
    await nc.load()
    const ok = await nc.saveInterfaceName()
    expect(ok).toBe(false)
    expect(toast.error).toHaveBeenCalled()
  })

  // ---- external-controller / secret (read-only on desktop) ----------------
  it('load() exposes external-controller / secret read-only (app-managed)', async () => {
    const nc = useNetworkConfig()
    await nc.load()
    expect(nc.externalController.value).toBe('127.0.0.1:9090')
    expect(nc.secret.value).toBe('s3cr3t')
  })

  it('load() surfaces failures via toast.error (no swallowing) and clears loading', async () => {
    api.getConfigSection.mockRejectedValue(new Error('boom'))
    const nc = useNetworkConfig()
    await nc.load()
    expect(toast.error).toHaveBeenCalled()
    expect(nc.loading.value).toBe(false)
  })
})
