import type { FsLike } from '../paths'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DESKTOP_SETTINGS,
  loadDesktopSettings,
  mergeDesktopSettings,
  saveDesktopSettings,
} from '../desktop-settings'

const PATH = '/data/desktop-settings.json'

function fakeFs(files: Record<string, string>): FsLike {
  return {
    existsSync: (p) => p in files,
    mkdirSync: () => {},
    readFileSync: (p) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    writeFileSync: vi.fn((p: string, data: string) => {
      files[p] = data
    }),
  }
}

describe('loadDesktopSettings', () => {
  it('returns the defaults when the file is missing', () => {
    expect(loadDesktopSettings(PATH, fakeFs({}))).toEqual(
      DEFAULT_DESKTOP_SETTINGS,
    )
  })

  it('merges persisted booleans over the defaults', () => {
    const fs = fakeFs({
      [PATH]: JSON.stringify({ tunAutoRestore: true, showTraySpeed: false }),
    })
    expect(loadDesktopSettings(PATH, fs)).toEqual({
      silentUpdateCheck: true,
      tunAutoRestore: true,
      showTraySpeed: false,
    })
  })

  it('ignores non-boolean values and unknown keys', () => {
    const fs = fakeFs({
      [PATH]: JSON.stringify({
        silentUpdateCheck: 'nope',
        tunAutoRestore: 1,
        bogus: true,
      }),
    })
    expect(loadDesktopSettings(PATH, fs)).toEqual(DEFAULT_DESKTOP_SETTINGS)
  })

  it('falls back to defaults on malformed JSON', () => {
    const fs = fakeFs({ [PATH]: '{oops' })
    expect(loadDesktopSettings(PATH, fs)).toEqual(DEFAULT_DESKTOP_SETTINGS)
  })
})

describe('mergeDesktopSettings', () => {
  it('applies known boolean keys from an untyped patch', () => {
    const next = mergeDesktopSettings(DEFAULT_DESKTOP_SETTINGS, {
      silentUpdateCheck: false,
    })
    expect(next.silentUpdateCheck).toBe(false)
    expect(next.tunAutoRestore).toBe(false)
    expect(next.showTraySpeed).toBe(true)
  })

  it('ignores garbage patches without throwing', () => {
    expect(mergeDesktopSettings(DEFAULT_DESKTOP_SETTINGS, null)).toEqual(
      DEFAULT_DESKTOP_SETTINGS,
    )
    expect(mergeDesktopSettings(DEFAULT_DESKTOP_SETTINGS, 'str')).toEqual(
      DEFAULT_DESKTOP_SETTINGS,
    )
    expect(
      mergeDesktopSettings(DEFAULT_DESKTOP_SETTINGS, { showTraySpeed: 'x' }),
    ).toEqual(DEFAULT_DESKTOP_SETTINGS)
  })

  it('does not mutate the current settings object', () => {
    const current = { ...DEFAULT_DESKTOP_SETTINGS }
    mergeDesktopSettings(current, { tunAutoRestore: true })
    expect(current.tunAutoRestore).toBe(false)
  })
})

describe('saveDesktopSettings', () => {
  it('round-trips through loadDesktopSettings', () => {
    const files: Record<string, string> = {}
    const fs = fakeFs(files)
    const settings = {
      silentUpdateCheck: false,
      tunAutoRestore: true,
      showTraySpeed: false,
    }
    saveDesktopSettings(PATH, fs, settings)
    expect(loadDesktopSettings(PATH, fs)).toEqual(settings)
  })
})
