import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useShortcutsStore } from '../shortcuts'

describe('stores/shortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('updateShortcut', () => {
    it('updates a specific shortcut', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      expect(store.shortcuts.goToProxies).toBe('g+x')
    })

    it('preserves other shortcuts when updating one', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      expect(store.shortcuts.goToOverview).toBe('g+o') // unchanged
      expect(store.shortcuts.refresh).toBe('r') // unchanged
    })

    it('stores custom shortcuts separately from defaults', () => {
      const store = useShortcutsStore()

      store.updateShortcut('refresh', 'ctrl+r')

      expect(store.customShortcuts.refresh).toBe('ctrl+r')
      expect(store.shortcuts.refresh).toBe('ctrl+r')
    })

    it('allows multiple shortcuts to be updated', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+1')
      store.updateShortcut('goToConnections', 'g+2')

      expect(store.shortcuts.goToProxies).toBe('g+1')
      expect(store.shortcuts.goToConnections).toBe('g+2')
    })
  })

  describe('findConflict', () => {
    it('returns null when no conflict exists', () => {
      const store = useShortcutsStore()

      const conflict = store.findConflict('g+x')

      expect(conflict).toBeNull()
    })

    it('returns conflicting action when key is already in use', () => {
      const store = useShortcutsStore()

      // 'g+p' is default for goToProxies
      const conflict = store.findConflict('g+p')

      expect(conflict).toBe('goToProxies')
    })

    it('excludes specified key from conflict check', () => {
      const store = useShortcutsStore()

      // Check if 'g+p' conflicts, excluding goToProxies itself
      const conflict = store.findConflict('g+p', 'goToProxies')

      expect(conflict).toBeNull()
    })

    it('detects conflicts with custom shortcuts', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      const conflict = store.findConflict('g+x')

      expect(conflict).toBe('goToProxies')
    })

    it('returns first conflicting action when multiple could match', () => {
      const store = useShortcutsStore()

      const conflict = store.findConflict('r')

      expect(conflict).toBe('refresh')
    })
  })

  describe('resetToDefaults', () => {
    it('clears all custom shortcuts', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')
      store.updateShortcut('refresh', 'ctrl+r')

      store.resetToDefaults()

      expect(store.customShortcuts).toEqual({})
    })

    it('restores shortcuts to default values', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      store.resetToDefaults()

      expect(store.shortcuts.goToProxies).toBe('g+p') // default value
    })
  })

  describe('resetShortcut', () => {
    it('resets a single shortcut to default', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')
      store.updateShortcut('refresh', 'ctrl+r')

      store.resetShortcut('goToProxies')

      expect(store.shortcuts.goToProxies).toBe('g+p') // default
      expect(store.shortcuts.refresh).toBe('ctrl+r') // still customized
    })

    it('removes the shortcut from customShortcuts', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      store.resetShortcut('goToProxies')

      expect(store.customShortcuts.goToProxies).toBeUndefined()
    })
  })

  describe('isCustomized', () => {
    it('returns false for default shortcuts', () => {
      const store = useShortcutsStore()

      expect(store.isCustomized('goToProxies')).toBe(false)
    })

    it('returns true for customized shortcuts', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')

      expect(store.isCustomized('goToProxies')).toBe(true)
    })

    it('returns false after reset', () => {
      const store = useShortcutsStore()

      store.updateShortcut('goToProxies', 'g+x')
      store.resetShortcut('goToProxies')

      expect(store.isCustomized('goToProxies')).toBe(false)
    })
  })

  describe('help modal', () => {
    it('opens help modal', () => {
      const store = useShortcutsStore()

      expect(store.isHelpModalOpen).toBe(false)

      store.openHelpModal()

      expect(store.isHelpModalOpen).toBe(true)
    })

    it('closes help modal', () => {
      const store = useShortcutsStore()

      store.openHelpModal()
      store.closeHelpModal()

      expect(store.isHelpModalOpen).toBe(false)
    })

    it('toggles help modal', () => {
      const store = useShortcutsStore()

      store.toggleHelpModal()
      expect(store.isHelpModalOpen).toBe(true)

      store.toggleHelpModal()
      expect(store.isHelpModalOpen).toBe(false)
    })
  })
})
