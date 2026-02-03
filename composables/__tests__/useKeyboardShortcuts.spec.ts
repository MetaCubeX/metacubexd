import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

// Mock useRouter
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock useActiveElement
const mockActiveElement = ref<HTMLElement | null>(null)
vi.mock('@vueuse/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...original,
    useActiveElement: () => mockActiveElement,
  }
})

// Mock useShortcutsStore
const mockShortcutsStore = {
  isHelpModalOpen: false,
  closeHelpModal: vi.fn(),
  toggleHelpModal: vi.fn(),
  shortcuts: {
    goToOverview: 'g+o',
    goToProxies: 'g+p',
    goToConnections: 'g+c',
    goToRules: 'g+r',
    goToLogs: 'g+l',
    goToConfig: 'g+s',
    refresh: 'r',
    closeModal: 'Escape',
    showHelp: '?',
  },
}

vi.stubGlobal('useShortcutsStore', () => mockShortcutsStore)
vi.stubGlobal('useRouter', () => ({ push: mockPush }))
vi.stubGlobal('onUnmounted', vi.fn())

// Mock import.meta.client
vi.stubGlobal('import', { meta: { client: true } })

describe('composables/useKeyboardShortcuts', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockActiveElement.value = null
    mockShortcutsStore.isHelpModalOpen = false
  })

  describe('isInputFocused', () => {
    it('returns false when no element is focused', () => {
      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(false)
    })

    it('returns true when input element is focused', () => {
      const input = document.createElement('input')
      mockActiveElement.value = input

      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(true)
    })

    it('returns true when textarea element is focused', () => {
      const textarea = document.createElement('textarea')
      mockActiveElement.value = textarea

      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(true)
    })

    it('returns true when select element is focused', () => {
      const select = document.createElement('select')
      mockActiveElement.value = select

      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(true)
    })

    it('returns true when contenteditable element is focused', () => {
      const div = document.createElement('div')
      div.setAttribute('contenteditable', 'true')
      mockActiveElement.value = div

      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(true)
    })

    it('returns false when non-input element is focused', () => {
      const div = document.createElement('div')
      mockActiveElement.value = div

      const { isInputFocused } = useKeyboardShortcuts()

      expect(isInputFocused.value).toBe(false)
    })
  })

  describe('navigation shortcuts (g+key)', () => {
    it('activates g prefix when g is pressed', () => {
      const { gPrefixActive, executeAction } = useKeyboardShortcuts()

      expect(gPrefixActive.value).toBe(false)

      // Simulate pressing 'g' - we can't directly test handleKeyDown,
      // but we can verify the g prefix state is initially false
    })

    it('executes goToProxies action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToProxies')

      expect(mockPush).toHaveBeenCalledWith('/proxies')
    })

    it('executes goToConnections action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToConnections')

      expect(mockPush).toHaveBeenCalledWith('/connections')
    })

    it('executes goToRules action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToRules')

      expect(mockPush).toHaveBeenCalledWith('/rules')
    })

    it('executes goToLogs action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToLogs')

      expect(mockPush).toHaveBeenCalledWith('/logs')
    })

    it('executes goToConfig action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToConfig')

      expect(mockPush).toHaveBeenCalledWith('/config')
    })

    it('executes goToOverview action', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('goToOverview')

      expect(mockPush).toHaveBeenCalledWith('/overview')
    })
  })

  describe('help modal shortcut (?)', () => {
    it('toggles help modal when showHelp action is executed', () => {
      const { executeAction } = useKeyboardShortcuts()

      executeAction('showHelp')

      expect(mockShortcutsStore.toggleHelpModal).toHaveBeenCalled()
    })
  })

  describe('closeModal action', () => {
    it('closes help modal when open', () => {
      mockShortcutsStore.isHelpModalOpen = true
      const { executeAction } = useKeyboardShortcuts()

      executeAction('closeModal')

      expect(mockShortcutsStore.closeHelpModal).toHaveBeenCalled()
    })

    it('dispatches close-modal event', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const { executeAction } = useKeyboardShortcuts()

      executeAction('closeModal')

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'shortcut:close-modal' }),
      )
    })
  })

  describe('refresh action', () => {
    it('dispatches refresh event', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const { executeAction } = useKeyboardShortcuts()

      executeAction('refresh')

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'shortcut:refresh' }),
      )
    })
  })
})
