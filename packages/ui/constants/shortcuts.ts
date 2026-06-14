// Shortcut action identifiers
export type ShortcutAction =
  // Navigation shortcuts (g + key sequence)
  | 'goToOverview'
  | 'goToProxies'
  | 'goToConnections'
  | 'goToRules'
  | 'goToLogs'
  | 'goToConfig'
  // Action shortcuts
  | 'refresh'
  | 'closeModal'
  | 'showHelp'

// Shortcut configuration type
export type ShortcutConfig = Record<ShortcutAction, string>

// Default keyboard shortcuts
export const DEFAULT_SHORTCUTS: ShortcutConfig = {
  // Navigation (g + key sequence, like GitHub)
  goToOverview: 'g+o',
  goToProxies: 'g+p',
  goToConnections: 'g+c',
  goToRules: 'g+r',
  goToLogs: 'g+l',
  goToConfig: 'g+s',
  // Actions
  refresh: 'r',
  closeModal: 'Escape',
  showHelp: '?',
}

// Shortcut categories for help panel display
export interface ShortcutCategory {
  id: string
  labelKey: string // i18n key
  shortcuts: ShortcutAction[]
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    id: 'navigation',
    labelKey: 'shortcuts.category.navigation',
    shortcuts: [
      'goToOverview',
      'goToProxies',
      'goToConnections',
      'goToRules',
      'goToLogs',
      'goToConfig',
    ],
  },
  {
    id: 'actions',
    labelKey: 'shortcuts.category.actions',
    shortcuts: ['refresh', 'closeModal', 'showHelp'],
  },
]

// Shortcut display names (i18n keys)
export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  goToOverview: 'shortcuts.goToOverview',
  goToProxies: 'shortcuts.goToProxies',
  goToConnections: 'shortcuts.goToConnections',
  goToRules: 'shortcuts.goToRules',
  goToLogs: 'shortcuts.goToLogs',
  goToConfig: 'shortcuts.goToConfig',
  refresh: 'shortcuts.refresh',
  closeModal: 'shortcuts.closeModal',
  showHelp: 'shortcuts.showHelp',
}

// Format shortcut key for display (e.g., "g+p" -> "G then P")
export const formatShortcutKey = (key: string): string => {
  if (key.includes('+')) {
    const parts = key.split('+')
    return parts.map((p) => p.toUpperCase()).join(' then ')
  }
  if (key === 'Escape') return 'Esc'
  if (key === '?') return '?'
  return key.toUpperCase()
}
