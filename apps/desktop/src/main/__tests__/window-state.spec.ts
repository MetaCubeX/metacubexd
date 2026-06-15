import type { FsLike } from '../paths'
import type { WindowBounds } from '../window-state'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WINDOW_BOUNDS,
  loadWindowState,
  sanitizeBounds,
  saveWindowState,
} from '../window-state'

/** Build a fake FsLike from an in-memory map of path -> contents. */
function fakeFs(files: Record<string, string>): {
  fs: FsLike
  files: Record<string, string>
} {
  const fs: FsLike = {
    existsSync: (p) => p in files,
    mkdirSync: () => {},
    readFileSync: (p) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    writeFileSync: (p, data) => {
      files[p] = data
    },
  }
  return { fs, files }
}

const PATH = '/userData/window-state.json'

describe('dEFAULT_WINDOW_BOUNDS', () => {
  it('matches the historical 1280x800 window size with no fixed position', () => {
    expect(DEFAULT_WINDOW_BOUNDS).toEqual({ width: 1280, height: 800 })
  })
})

describe('loadWindowState', () => {
  it('returns the defaults when the state file is missing', () => {
    const { fs } = fakeFs({})
    expect(loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)).toEqual(
      DEFAULT_WINDOW_BOUNDS,
    )
  })

  it('returns the persisted bounds when present and valid', () => {
    const bounds: WindowBounds = { width: 1024, height: 768, x: 100, y: 200 }
    const { fs } = fakeFs({ [PATH]: JSON.stringify(bounds) })
    expect(loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)).toEqual(bounds)
  })

  it('falls back to the defaults when the JSON is malformed', () => {
    const { fs } = fakeFs({ [PATH]: '{ not json' })
    expect(loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)).toEqual(
      DEFAULT_WINDOW_BOUNDS,
    )
  })

  it('sanitizes invalid persisted values against the defaults', () => {
    const { fs } = fakeFs({
      [PATH]: JSON.stringify({ width: -50, height: 0, x: 10, y: 20 }),
    })
    expect(loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)).toEqual({
      width: DEFAULT_WINDOW_BOUNDS.width,
      height: DEFAULT_WINDOW_BOUNDS.height,
      x: 10,
      y: 20,
    })
  })

  it('drops the whole position when a coordinate is non-numeric', () => {
    const { fs } = fakeFs({
      [PATH]: JSON.stringify({ width: 800, height: 600, x: 'left', y: 20 }),
    })
    const result = loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)
    expect(result).toEqual({ width: 800, height: 600 })
    expect('x' in result).toBe(false)
    expect('y' in result).toBe(false)
  })
})

describe('saveWindowState', () => {
  it('writes the bounds as JSON to the path', () => {
    const { fs, files } = fakeFs({})
    const bounds: WindowBounds = { width: 1024, height: 768, x: 5, y: 6 }
    saveWindowState(fs, PATH, bounds)
    expect(files[PATH]).toBeDefined()
    expect(JSON.parse(files[PATH] as string)).toEqual(bounds)
  })

  it('round-trips with loadWindowState', () => {
    const { fs } = fakeFs({})
    const bounds: WindowBounds = { width: 1440, height: 900, x: 0, y: 0 }
    saveWindowState(fs, PATH, bounds)
    expect(loadWindowState(fs, PATH, DEFAULT_WINDOW_BOUNDS)).toEqual(bounds)
  })
})

describe('sanitizeBounds', () => {
  const defaults: WindowBounds = { width: 1280, height: 800 }

  it('keeps a fully valid bounds unchanged', () => {
    const bounds: WindowBounds = { width: 1024, height: 768, x: 100, y: 200 }
    expect(sanitizeBounds(bounds, defaults)).toEqual(bounds)
  })

  it('replaces NaN width/height with the defaults', () => {
    expect(
      sanitizeBounds({ width: Number.NaN, height: Number.NaN }, defaults),
    ).toEqual({ width: 1280, height: 800 })
  })

  it('replaces negative or zero size with the defaults', () => {
    expect(sanitizeBounds({ width: -1, height: 0 }, defaults)).toEqual({
      width: 1280,
      height: 800,
    })
  })

  it('replaces absurdly large size with the defaults', () => {
    expect(
      sanitizeBounds({ width: 1_000_000, height: 999_999 }, defaults),
    ).toEqual({ width: 1280, height: 800 })
  })

  it('drops a NaN or non-finite position', () => {
    expect(
      sanitizeBounds(
        { width: 800, height: 600, x: Number.NaN, y: Number.POSITIVE_INFINITY },
        defaults,
      ),
    ).toEqual({ width: 800, height: 600 })
  })

  it('keeps a valid (even negative, multi-monitor) position', () => {
    expect(
      sanitizeBounds({ width: 800, height: 600, x: -1280, y: 0 }, defaults),
    ).toEqual({ width: 800, height: 600, x: -1280, y: 0 })
  })

  it('drops the whole position when a coordinate is absurdly off-screen', () => {
    expect(
      sanitizeBounds(
        { width: 800, height: 600, x: 10_000_000, y: 50 },
        defaults,
      ),
    ).toEqual({ width: 800, height: 600 })
  })
})
