// packages/ui/composables/useWebdavBackup.ts
import type { SettingsBackup } from './useSettingsBackup'
import type { WebdavCredentials } from '~/types/control'
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'
import { useProfiles } from './useProfiles'
import { useSettingsBackup } from './useSettingsBackup'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// `useLocalStorage` is auto-imported by VueUse (typed globally by Nuxt). In
// unit tests it is provided as a global stub via test/setup.ts.

interface WebdavBackupConfig {
  url: string
  username: string
  password: string
  dir: string
}

const STORAGE_KEY = 'webdavBackupConfig'

// WebDAV backup/restore (capability-gated 'webdav-backup'). The config form
// (url/username/password/dir) persists to localStorage so the user re-enters it
// once. Backup ships the exported UI settings alongside the profile bundle;
// restore re-applies the returned uiSettings and refreshes the profiles list.
// Success/failure surface via toast — never swallowed.
export function useWebdavBackup() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { exportSettings, applySettings } = useSettingsBackup()
  const { refresh: refreshProfiles } = useProfiles()
  const { t } = useI18n()

  // Drives the card's v-if — same capability-gating pattern as the other panels.
  const available = computed(() => hasFeature('webdav-backup'))

  const config = useLocalStorage<WebdavBackupConfig>(STORAGE_KEY, {
    url: '',
    username: '',
    password: '',
    dir: '',
  })

  const busy = ref(false)

  // Build the per-request credentials from the persisted config (dir is sent so
  // the agent scopes the backup file under it).
  const credentials = (): WebdavCredentials => ({
    url: config.value.url,
    username: config.value.username,
    password: config.value.password,
    dir: config.value.dir,
  })

  const backup = async () => {
    busy.value = true
    try {
      const uiSettings = exportSettings()
      const res = await api.webdavBackup({ webdav: credentials(), uiSettings })
      toast.success(t('webdavBackupSuccess'), { description: res.path })
    } catch (e) {
      toast.error(t('webdavBackupFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  const restore = async () => {
    busy.value = true
    try {
      const res = await api.webdavRestore({ webdav: credentials() })
      // Re-apply the UI settings snapshot if the backup carried one.
      if (res.uiSettings) {
        applySettings(res.uiSettings as Partial<SettingsBackup>)
      }
      // New profiles were created server-side — refresh the list/query so the
      // profiles page reflects them without a reload.
      await refreshProfiles()
      toast.success(t('webdavRestoreSuccess'), {
        description: t('webdavRestoreCount', { count: res.restored }),
      })
    } catch (e) {
      toast.error(t('webdavRestoreFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  return { available, config, busy, backup, restore }
}
