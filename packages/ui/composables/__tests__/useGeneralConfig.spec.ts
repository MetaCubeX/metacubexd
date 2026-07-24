// packages/ui/composables/__tests__/useGeneralConfig.spec.ts
import type { Config } from '~/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PORT_FIELDS, useGeneralConfig } from '../useGeneralConfig'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    'allow-lan': true,
    mode: 'global',
    'unified-delay': true,
    'interface-name': 'eth0',
    'mixed-port': 7890,
    port: 7891,
    'socks-port': 7892,
    'redir-port': 7893,
    'tproxy-port': 7894,
    'mode-list': ['rule', 'direct', 'global', 'script'],
    ...overrides,
  } as unknown as Config
}

describe('composables/useGeneralConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncFromConfig populates the form from the loaded config', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(makeConfig())

    expect(g.form.allowLan).toBe(true)
    expect(g.form.mode).toBe('global')
    expect(g.form.unifiedDelay).toBe(true)
    expect(g.form.interfaceName).toBe('eth0')
    expect(g.form.mixedPort).toBe(7890)
    expect(g.form.port).toBe(7891)
    expect(g.form.socksPort).toBe(7892)
    expect(g.form.redirPort).toBe(7893)
    expect(g.form.tproxyPort).toBe(7894)
    expect(g.modes.value).toEqual(['rule', 'global', 'direct', 'script'])
  })

  it('syncFromConfig coerces missing ports to 0 and tolerates an empty config', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig({} as Config)

    expect(g.form.allowLan).toBe(false)
    expect(g.form.mode).toBe('rule')
    expect(g.form.interfaceName).toBe('')
    expect(g.form.mixedPort).toBe(0)
    expect(g.form.tproxyPort).toBe(0)
    // Canonical order (rule -> global -> direct), matching the tray. (#2148)
    expect(g.modes.value).toEqual(['rule', 'global', 'direct'])
  })

  it('syncFromConfig honors the legacy UnifiedDelay fallback when unified-delay is absent', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(
      makeConfig({ 'unified-delay': undefined, UnifiedDelay: true } as any),
    )

    expect(g.form.unifiedDelay).toBe(true)
  })

  it('syncFromConfig falls back mode-list -> modes -> default', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(
      makeConfig({ 'mode-list': undefined, modes: ['rule', 'script'] } as any),
    )
    expect(g.modes.value).toEqual(['rule', 'script'])
  })

  it('save dispatches a per-key PATCH through the injected mutate', () => {
    const mutate = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate } })
    g.syncFromConfig(makeConfig())
    g.save('allow-lan', false)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({ key: 'allow-lan', value: false })
  })

  it('saveMode PATCHes mode and fires onModeChange on success only', () => {
    // mutate mock that simulates a SUCCESSFUL mutation by invoking onSuccess.
    const mutate = vi.fn((_vars, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    )
    const onModeChange = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate }, onModeChange })
    g.form.mode = 'global'
    g.saveMode()

    expect(mutate).toHaveBeenCalledWith(
      { key: 'mode', value: 'global' },
      { onSuccess: onModeChange },
    )
    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  it('saveMode does NOT fire onModeChange when the mutation does not succeed', () => {
    // mutate mock that does NOT invoke onSuccess (simulates a failed/pending save).
    const mutate = vi.fn()
    const onModeChange = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate }, onModeChange })
    g.saveMode()

    expect(onModeChange).not.toHaveBeenCalled()
  })

  it('port fields map every listener port to its config key', () => {
    expect(PORT_FIELDS.map((p) => [p.key, p.configKey])).toEqual([
      ['mixedPort', 'mixed-port'],
      ['port', 'port'],
      ['socksPort', 'socks-port'],
      ['redirPort', 'redir-port'],
      ['tproxyPort', 'tproxy-port'],
    ])
  })
})
