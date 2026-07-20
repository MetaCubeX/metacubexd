import type { FsLike } from '../paths'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HOTKEYS,
  sanitizeHotkeyBindings,
  saveHotkeyBindings,
} from '../hotkeys'

describe('sanitizeHotkeyBindings', () => {
  it('merges string overrides over the defaults and trims them', () => {
    const result = sanitizeHotkeyBindings({
      toggleWindow: '  CommandOrControl+Shift+X  ',
    })
    expect(result.toggleWindow).toBe('CommandOrControl+Shift+X')
    // Untouched actions keep their defaults.
    expect(result.toggleSystemProxy).toBe(DEFAULT_HOTKEYS.toggleSystemProxy)
    expect(result.cycleProxyMode).toBe(DEFAULT_HOTKEYS.cycleProxyMode)
  })

  it('keeps an empty string (a disabled hotkey)', () => {
    const result = sanitizeHotkeyBindings({ cycleProxyMode: '' })
    expect(result.cycleProxyMode).toBe('')
  })

  it('ignores non-string values and unknown keys', () => {
    const result = sanitizeHotkeyBindings({
      toggleWindow: 123,
      bogusAction: 'Ctrl+Q',
    })
    expect(result).toEqual(DEFAULT_HOTKEYS)
  })

  it('falls back to the full defaults on garbage input', () => {
    expect(sanitizeHotkeyBindings(null)).toEqual(DEFAULT_HOTKEYS)
    expect(sanitizeHotkeyBindings('nope')).toEqual(DEFAULT_HOTKEYS)
  })
})

describe('saveHotkeyBindings', () => {
  it('writes the full record as pretty JSON', () => {
    const writes: Record<string, string> = {}
    const fs: FsLike = {
      existsSync: () => false,
      mkdirSync: () => {},
      readFileSync: () => '',
      writeFileSync: vi.fn((p: string, data: string) => {
        writes[p] = data
      }),
    }
    saveHotkeyBindings('/data/hotkeys.json', fs, DEFAULT_HOTKEYS)
    expect(JSON.parse(writes['/data/hotkeys.json']!)).toEqual(DEFAULT_HOTKEYS)
  })
})
