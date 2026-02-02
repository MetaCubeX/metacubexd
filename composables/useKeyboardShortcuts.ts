import type { ShortcutAction } from '~/constants/shortcuts'
import { useActiveElement } from '@vueuse/core'
import { ROUTES } from '~/constants'

export function useKeyboardShortcuts() {
  const router = useRouter()
  const shortcutsStore = useShortcutsStore()

  // Track active element to disable shortcuts in input fields
  const activeElement = useActiveElement()

  // Check if focus is in an input field
  const isInputFocused = computed(() => {
    const el = activeElement.value
    if (!el) return false
    const tagName = el.tagName.toLowerCase()
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      el.getAttribute('contenteditable') === 'true'
    )
  })

  // Track "g" prefix for navigation shortcuts
  const gPrefixActive = ref(false)
  const gPrefixTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

  // Clear g prefix after timeout
  const clearGPrefix = () => {
    gPrefixActive.value = false
    if (gPrefixTimeout.value) {
      clearTimeout(gPrefixTimeout.value)
      gPrefixTimeout.value = null
    }
  }

  // Set g prefix with timeout
  const setGPrefix = () => {
    gPrefixActive.value = true
    if (gPrefixTimeout.value) {
      clearTimeout(gPrefixTimeout.value)
    }
    gPrefixTimeout.value = setTimeout(clearGPrefix, 1500) // 1.5s timeout
  }

  // Action handlers
  const actionHandlers: Record<ShortcutAction, () => void> = {
    goToOverview: () => router.push(ROUTES.Overview),
    goToProxies: () => router.push(ROUTES.Proxies),
    goToConnections: () => router.push(ROUTES.Conns),
    goToRules: () => router.push(ROUTES.Rules),
    goToLogs: () => router.push(ROUTES.Log),
    goToConfig: () => router.push(ROUTES.Config),
    refresh: () => {
      // Emit a custom event that pages can listen to
      window.dispatchEvent(new CustomEvent('shortcut:refresh'))
    },
    closeModal: () => {
      // Close help modal if open
      if (shortcutsStore.isHelpModalOpen) {
        shortcutsStore.closeHelpModal()
      }
      // Emit event for other modals
      window.dispatchEvent(new CustomEvent('shortcut:close-modal'))
    },
    showHelp: () => {
      shortcutsStore.toggleHelpModal()
    },
  }

  // Execute action by shortcut key
  const executeAction = (action: ShortcutAction) => {
    const handler = actionHandlers[action]
    if (handler) {
      handler()
    }
  }

  // Navigation key mapping
  const navigationKeyMap: Record<string, ShortcutAction> = {
    o: 'goToOverview',
    p: 'goToProxies',
    c: 'goToConnections',
    u: 'goToRules',
    l: 'goToLogs',
    s: 'goToConfig',
  }

  // Keyboard event handler
  const handleKeyDown = (event: KeyboardEvent) => {
    // Skip if in input field
    if (isInputFocused.value) return

    const key = event.key.toLowerCase()

    // Handle Escape
    if (key === 'escape') {
      executeAction('closeModal')
      return
    }

    // Handle ? (Shift + /)
    if (event.shiftKey && (key === '/' || key === '?')) {
      event.preventDefault()
      executeAction('showHelp')
      return
    }

    // Handle g prefix
    if (key === 'g' && !gPrefixActive.value) {
      setGPrefix()
      return
    }

    // Handle navigation shortcuts (g + key)
    if (gPrefixActive.value) {
      const action = navigationKeyMap[key]
      if (action) {
        event.preventDefault()
        executeAction(action)
        clearGPrefix()
        return
      }
    }

    // Handle r for refresh (only if g prefix is not active)
    if (key === 'r' && !gPrefixActive.value) {
      executeAction('refresh')
      
    }
  }

  // Setup keyboard listeners using native event listener
  const setupKeyboardListeners = () => {
    if (import.meta.client) {
      window.addEventListener('keydown', handleKeyDown)
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (import.meta.client) {
      window.removeEventListener('keydown', handleKeyDown)
    }
    clearGPrefix()
  })

  return {
    isInputFocused,
    gPrefixActive,
    setupKeyboardListeners,
    executeAction,
  }
}
