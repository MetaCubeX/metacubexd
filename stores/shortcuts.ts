import type {ShortcutConfig} from '~/constants/shortcuts';
import { defineStore } from 'pinia'
import { DEFAULT_SHORTCUTS  } from '~/constants/shortcuts'

export const useShortcutsStore = defineStore('shortcuts', () => {
  // Custom shortcuts configuration (persisted to localStorage)
  const customShortcuts = useLocalStorage<Partial<ShortcutConfig>>(
    'customShortcuts',
    {},
  )

  // Computed: merge default shortcuts with custom overrides
  const shortcuts = computed<ShortcutConfig>(() => ({
    ...DEFAULT_SHORTCUTS,
    ...customShortcuts.value,
  }))

  // Help modal visibility
  const isHelpModalOpen = ref(false)

  // Open help modal
  const openHelpModal = () => {
    isHelpModalOpen.value = true
  }

  // Close help modal
  const closeHelpModal = () => {
    isHelpModalOpen.value = false
  }

  // Toggle help modal
  const toggleHelpModal = () => {
    isHelpModalOpen.value = !isHelpModalOpen.value
  }

  // Update a specific shortcut
  const updateShortcut = (key: keyof ShortcutConfig, value: string) => {
    customShortcuts.value = {
      ...customShortcuts.value,
      [key]: value,
    }
  }

  // Check if a shortcut key combination is already in use
  const findConflict = (
    newKey: string,
    excludeKey?: keyof ShortcutConfig,
  ): keyof ShortcutConfig | null => {
    const allShortcuts = shortcuts.value
    for (const [key, value] of Object.entries(allShortcuts)) {
      if (key !== excludeKey && value === newKey) {
        return key as keyof ShortcutConfig
      }
    }
    return null
  }

  // Reset all shortcuts to defaults
  const resetToDefaults = () => {
    customShortcuts.value = {}
  }

  // Reset a specific shortcut to default
  const resetShortcut = (key: keyof ShortcutConfig) => {
    const { [key]: _, ...rest } = customShortcuts.value
    customShortcuts.value = rest
  }

  // Check if a shortcut has been customized
  const isCustomized = (key: keyof ShortcutConfig): boolean => {
    return key in customShortcuts.value
  }

  return {
    // State
    shortcuts,
    customShortcuts,
    isHelpModalOpen,
    // Actions
    openHelpModal,
    closeHelpModal,
    toggleHelpModal,
    updateShortcut,
    findConflict,
    resetToDefaults,
    resetShortcut,
    isCustomized,
  }
})
