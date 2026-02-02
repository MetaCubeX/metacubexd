import type { ShortcutAction } from '~/constants/shortcuts'
import { useActiveElement, useMagicKeys } from '@vueuse/core'
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

  // Magic keys for keyboard detection
  const keys = useMagicKeys()

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

  // Parse shortcut string to check if it matches current key state
  const parseShortcut = (
    shortcut: string,
  ): { prefix: string | null; key: string } => {
    if (shortcut.includes('+')) {
      const [prefix, key] = shortcut.split('+')
      return { prefix: prefix ?? null, key: key ?? shortcut }
    }
    return { prefix: null, key: shortcut }
  }

  // Watch for key presses
  const setupKeyboardListeners = () => {
    const shortcuts = shortcutsStore.shortcuts

    // Watch for 'g' key to activate prefix mode
    watch(
      () => keys.g?.value,
      (pressed) => {
        if (pressed && !isInputFocused.value) {
          setGPrefix()
        }
      },
    )

    // Navigation shortcuts (g + key)
    const navigationActions: ShortcutAction[] = [
      'goToOverview',
      'goToProxies',
      'goToConnections',
      'goToRules',
      'goToLogs',
      'goToConfig',
    ]

    navigationActions.forEach((action) => {
      const shortcut = shortcuts[action]
      const parsed = parseShortcut(shortcut)

      if (parsed.prefix === 'g') {
        const keyRef = keys[parsed.key as keyof typeof keys]
        if (keyRef && typeof keyRef === 'object' && 'value' in keyRef) {
          watch(
            () => (keyRef as Ref<boolean>).value,
            (pressed) => {
              if (pressed && gPrefixActive.value && !isInputFocused.value) {
                executeAction(action)
                clearGPrefix()
              }
            },
          )
        }
      }
    })

    // Single key shortcuts
    // Refresh (r)
    watch(
      () => keys.r?.value,
      (pressed) => {
        if (pressed && !isInputFocused.value && !gPrefixActive.value) {
          executeAction('refresh')
        }
      },
    )

    // Show help (?) - using shift+slash combination
    watch(
      () => keys['?']?.value,
      (pressed) => {
        if (pressed && !isInputFocused.value) {
          executeAction('showHelp')
        }
      },
    )

    // Escape
    watch(
      () => keys.escape?.value,
      (pressed) => {
        if (pressed) {
          executeAction('closeModal')
        }
      },
    )
  }

  return {
    isInputFocused,
    gPrefixActive,
    setupKeyboardListeners,
    executeAction,
  }
}
