// packages/ui/composables/__tests__/useSettingsBackup.spec.ts
import { beforeEach, describe, expect, it } from 'vitest'

import { useSettingsBackup } from '../useSettingsBackup'

describe('composables/useSettingsBackup object export/import', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('exportSettings() returns a versioned bundle of non-excluded localStorage keys', () => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('fontFamily', "'MiSans'")
    // excluded: machine-local / secret keys must never be exported.
    localStorage.setItem('selectedEndpoint', 'local-mihomo')
    localStorage.setItem('endpointList', '[]')

    const bundle = useSettingsBackup().exportSettings()
    expect(bundle.app).toBe('metacubexd')
    expect(bundle.version).toBe(1)
    expect(bundle.settings.theme).toBe('dark')
    expect(bundle.settings.fontFamily).toBe("'MiSans'")
    expect(bundle.settings.selectedEndpoint).toBeUndefined()
    expect(bundle.settings.endpointList).toBeUndefined()
  })

  it('applySettings() writes a bundle back to localStorage and returns the count', () => {
    const count = useSettingsBackup().applySettings({
      app: 'metacubexd',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: { theme: 'light', fontFamily: "'Fira Sans'" },
    })
    expect(count).toBe(2)
    expect(localStorage.getItem('theme')).toBe('light')
    expect(localStorage.getItem('fontFamily')).toBe("'Fira Sans'")
  })

  it('applySettings() skips excluded keys and non-string values', () => {
    const count = useSettingsBackup().applySettings({
      app: 'metacubexd',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        theme: 'dim',
        selectedEndpoint: 'x',
        // @ts-expect-error – non-string values are rejected at runtime
        bogus: 123,
      },
    })
    expect(count).toBe(1)
    expect(localStorage.getItem('theme')).toBe('dim')
    expect(localStorage.getItem('selectedEndpoint')).toBeNull()
  })

  it('applySettings() rejects a bundle that is not a metacubexd backup', () => {
    expect(() =>
      useSettingsBackup().applySettings({ app: 'something-else' } as never),
    ).toThrow()
  })
})
