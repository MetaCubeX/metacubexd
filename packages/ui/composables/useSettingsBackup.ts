// Export / import of dashboard preferences (theme, columns, shortcuts, latency
// thresholds, recommendation weights, appearance, etc.) for cross-device/browser
// migration. Preferences live in localStorage via VueUse's useLocalStorage, so a
// backup is just a snapshot of the relevant keys.

const BACKUP_VERSION = 1

// Sensitive or machine-local keys that must NEVER be exported: backend secrets,
// the currently selected endpoint, and purely local caches.
const EXCLUDED_KEYS = new Set([
  'endpointList',
  'selectedEndpoint',
  'geoIPCache',
])
const EXCLUDED_PREFIXES = ['bing', 'vue-query']

export interface SettingsBackup {
  app: 'metacubexd'
  version: number
  exportedAt: string
  settings: Record<string, string>
}

function isExcluded(key: string): boolean {
  if (EXCLUDED_KEYS.has(key)) return true
  return EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function useSettingsBackup() {
  function collectSettings(): Record<string, string> {
    const settings: Record<string, string> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || isExcluded(key)) continue
      const value = localStorage.getItem(key)
      if (value !== null) settings[key] = value
    }
    return settings
  }

  function buildBackup(): SettingsBackup {
    return {
      app: 'metacubexd',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      settings: collectSettings(),
    }
  }

  function downloadSettings() {
    const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `metacubexd-settings-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  // Snapshot the (non-excluded) settings as a plain object — the same shape
  // downloadSettings() serialises. Used by the WebDAV backup flow to ship the
  // UI settings alongside the profile bundle (no File round-trip needed).
  function exportSettings(): SettingsBackup {
    return buildBackup()
  }

  // Validate a backup bundle and write its settings back to localStorage.
  // Returns the number of keys imported. Caller is expected to reload the app
  // (or refresh the relevant stores) so every store re-reads localStorage.
  function applySettings(backup: Partial<SettingsBackup>): number {
    if (
      !backup ||
      backup.app !== 'metacubexd' ||
      typeof backup.settings !== 'object' ||
      backup.settings === null
    ) {
      throw new Error('Not a valid metacubexd settings backup')
    }

    let count = 0
    for (const [key, value] of Object.entries(backup.settings)) {
      if (isExcluded(key) || typeof value !== 'string') continue
      localStorage.setItem(key, value)
      count++
    }
    return count
  }

  // Parse + validate a backup file and write its settings back to localStorage.
  // Returns the number of keys imported. Caller is expected to reload the app so
  // every store re-reads localStorage.
  async function importSettings(file: File): Promise<number> {
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON file')
    }
    return applySettings(parsed as Partial<SettingsBackup>)
  }

  return { downloadSettings, importSettings, exportSettings, applySettings }
}
