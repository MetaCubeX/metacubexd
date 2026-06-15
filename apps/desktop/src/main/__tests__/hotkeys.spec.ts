import type { HotkeyActions, HotkeyBindings } from '../hotkeys'
import type { FsLike } from '../paths'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_HOTKEYS,
  loadHotkeyBindings,
  registerHotkeys,
} from '../hotkeys'

/** Build a fake FsLike from an in-memory map of path -> contents. */
function fakeFs(files: Record<string, string>): FsLike {
  return {
    existsSync: (p) => p in files,
    mkdirSync: () => {},
    readFileSync: (p) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    writeFileSync: () => {},
  }
}

/**
 * Fake globalShortcut: records every register(accelerator, callback) so the
 * test can fire a callback by accelerator and assert which action ran without
 * touching the real OS shortcut registry.
 */
function fakeGlobalShortcut() {
  const registered = new Map<string, () => void>()
  const unregisterAll = vi.fn()
  return {
    register: vi.fn((accelerator: string, callback: () => void) => {
      registered.set(accelerator, callback)
      return true
    }),
    unregisterAll,
    /** Fire the callback bound to an accelerator (no-op if unregistered). */
    fire: (accelerator: string) => registered.get(accelerator)?.(),
    registered,
  }
}

function makeActions(): HotkeyActions & {
  calls: string[]
} {
  const calls: string[] = []
  return {
    calls,
    toggleSystemProxy: vi.fn(() => void calls.push('toggleSystemProxy')),
    cycleProxyMode: vi.fn(() => void calls.push('cycleProxyMode')),
    toggleWindow: vi.fn(() => void calls.push('toggleWindow')),
  }
}

describe('dEFAULT_HOTKEYS', () => {
  it('binds the three actions to distinct, non-conflicting accelerators', () => {
    const accelerators = [
      DEFAULT_HOTKEYS.toggleSystemProxy,
      DEFAULT_HOTKEYS.cycleProxyMode,
      DEFAULT_HOTKEYS.toggleWindow,
    ]
    // all defined, non-empty
    for (const acc of accelerators) {
      expect(typeof acc).toBe('string')
      expect(acc.length).toBeGreaterThan(0)
    }
    // distinct (no two actions share an accelerator)
    expect(new Set(accelerators).size).toBe(3)
  })
})

describe('registerHotkeys', () => {
  it('registers each default accelerator wired to its action', () => {
    const gs = fakeGlobalShortcut()
    const actions = makeActions()

    registerHotkeys({ globalShortcut: gs, actions })

    // every default accelerator was registered
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleSystemProxy)).toBe(true)
    expect(gs.registered.has(DEFAULT_HOTKEYS.cycleProxyMode)).toBe(true)
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleWindow)).toBe(true)

    // firing each accelerator invokes exactly its action
    gs.fire(DEFAULT_HOTKEYS.toggleSystemProxy)
    gs.fire(DEFAULT_HOTKEYS.cycleProxyMode)
    gs.fire(DEFAULT_HOTKEYS.toggleWindow)
    expect(actions.calls).toEqual([
      'toggleSystemProxy',
      'cycleProxyMode',
      'toggleWindow',
    ])
  })

  it('honors custom bindings over the defaults', () => {
    const gs = fakeGlobalShortcut()
    const actions = makeActions()
    const bindings: HotkeyBindings = {
      toggleSystemProxy: 'Alt+1',
      cycleProxyMode: 'Alt+2',
      toggleWindow: 'Alt+3',
    }

    registerHotkeys({ globalShortcut: gs, actions, bindings })

    expect(gs.registered.has('Alt+1')).toBe(true)
    expect(gs.registered.has('Alt+2')).toBe(true)
    expect(gs.registered.has('Alt+3')).toBe(true)
    // defaults are NOT registered when overridden
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleSystemProxy)).toBe(false)

    gs.fire('Alt+2')
    expect(actions.cycleProxyMode).toHaveBeenCalledTimes(1)
  })

  it('merges partial custom bindings with the defaults', () => {
    const gs = fakeGlobalShortcut()
    const actions = makeActions()
    // only override one action; the others fall back to defaults
    registerHotkeys({
      globalShortcut: gs,
      actions,
      bindings: { toggleWindow: 'Alt+W' },
    })

    expect(gs.registered.has('Alt+W')).toBe(true)
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleSystemProxy)).toBe(true)
    expect(gs.registered.has(DEFAULT_HOTKEYS.cycleProxyMode)).toBe(true)
    // the default toggleWindow accelerator is NOT used (overridden)
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleWindow)).toBe(false)
  })

  it('skips a binding with an empty accelerator', () => {
    const gs = fakeGlobalShortcut()
    const actions = makeActions()
    registerHotkeys({
      globalShortcut: gs,
      actions,
      bindings: { toggleSystemProxy: '' },
    })

    // empty accelerator -> not registered, nothing thrown
    expect(gs.register).not.toHaveBeenCalledWith('', expect.any(Function))
    // the other two defaults still register
    expect(gs.registered.has(DEFAULT_HOTKEYS.cycleProxyMode)).toBe(true)
    expect(gs.registered.has(DEFAULT_HOTKEYS.toggleWindow)).toBe(true)
  })
})

describe('loadHotkeyBindings', () => {
  const PATH = '/userData/hotkeys.json'

  it('returns the defaults when the settings file is missing', () => {
    expect(loadHotkeyBindings(PATH, fakeFs({}))).toEqual(DEFAULT_HOTKEYS)
  })

  it('merges persisted overrides over the defaults', () => {
    const fs = fakeFs({
      [PATH]: JSON.stringify({ toggleWindow: 'Alt+W' }),
    })
    expect(loadHotkeyBindings(PATH, fs)).toEqual({
      ...DEFAULT_HOTKEYS,
      toggleWindow: 'Alt+W',
    })
  })

  it('falls back to the defaults when the JSON is malformed', () => {
    const fs = fakeFs({ [PATH]: '{ not json' })
    expect(loadHotkeyBindings(PATH, fs)).toEqual(DEFAULT_HOTKEYS)
  })

  it('ignores non-string override values', () => {
    const fs = fakeFs({
      [PATH]: JSON.stringify({ toggleWindow: 42, cycleProxyMode: 'Alt+M' }),
    })
    expect(loadHotkeyBindings(PATH, fs)).toEqual({
      ...DEFAULT_HOTKEYS,
      cycleProxyMode: 'Alt+M',
    })
  })
})
