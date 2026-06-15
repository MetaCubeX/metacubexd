// packages/ui/composables/__tests__/useWebdavBackup.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWebdavBackup } from '../useWebdavBackup'

const api = {
  webdavBackup: vi.fn(),
  webdavRestore: vi.fn(),
}
vi.mock('../useControlApi', () => ({ useControlApi: () => api }))

let featurePresent = true
vi.mock('../useControlInfo', () => ({
  useControlInfo: () => ({
    hasFeature: (f: string) => featurePresent && f === 'webdav-backup',
  }),
}))

// useSettingsBackup is auto-imported in the app; mock it here so backup pulls a
// known uiSettings object and restore can assert the apply path runs.
const exportSettings = vi.fn()
const applySettings = vi.fn()
vi.mock('../useSettingsBackup', () => ({
  useSettingsBackup: () => ({ exportSettings, applySettings }),
}))

// Profiles list must refresh after a restore (new profiles were created).
const refreshProfiles = vi.fn()
vi.mock('../useProfiles', () => ({
  useProfiles: () => ({ refresh: refreshProfiles }),
}))

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))
// useI18n() is provided as a global stub via test/setup.ts (returns the key).

const sampleUiSettings = {
  app: 'metacubexd' as const,
  version: 1,
  exportedAt: '2026-01-01T00:00:00.000Z',
  settings: { theme: 'dark' },
}

describe('composables/useWebdavBackup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    featurePresent = true
    exportSettings.mockReturnValue(sampleUiSettings)
    api.webdavBackup.mockResolvedValue({ ok: true, path: 'metacubexd/x.json' })
    api.webdavRestore.mockResolvedValue({
      ok: true,
      restored: 2,
      uiSettings: sampleUiSettings,
    })
  })

  it('available reflects hasFeature(webdav-backup) — true when present', () => {
    expect(useWebdavBackup().available.value).toBe(true)
  })

  it('available is false when the webdav-backup feature is absent', () => {
    featurePresent = false
    expect(useWebdavBackup().available.value).toBe(false)
  })

  it('config is persisted to localStorage (url/username/password/dir)', async () => {
    const w = useWebdavBackup()
    w.config.value = {
      url: 'https://dav.example.com',
      username: 'user',
      password: 'secret',
      dir: 'metacubexd',
    }
    // useLocalStorage flushes the write on the next tick.
    await nextTick()
    expect(localStorage.getItem('webdavBackupConfig')).toContain(
      'dav.example.com',
    )
  })

  it('backup() POSTs { webdav, uiSettings } with the exported settings and toasts success', async () => {
    const w = useWebdavBackup()
    w.config.value.url = 'https://dav.example.com'
    w.config.value.username = 'user'
    w.config.value.password = 'secret'
    w.config.value.dir = 'metacubexd'
    await w.backup()
    expect(exportSettings).toHaveBeenCalledOnce()
    expect(api.webdavBackup).toHaveBeenCalledWith({
      webdav: {
        url: 'https://dav.example.com',
        username: 'user',
        password: 'secret',
        dir: 'metacubexd',
      },
      uiSettings: sampleUiSettings,
    })
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('busy() reflects the in-flight backup (buttons disable while running)', async () => {
    let resolveBackup: (v: unknown) => void = () => {}
    api.webdavBackup.mockReturnValue(
      new Promise((res) => {
        resolveBackup = res
      }),
    )
    const w = useWebdavBackup()
    const p = w.backup()
    expect(w.busy.value).toBe(true)
    resolveBackup({ ok: true, path: 'x' })
    await p
    expect(w.busy.value).toBe(false)
  })

  it('restore() POSTs { webdav }, applies the returned uiSettings, refreshes profiles, toasts success', async () => {
    const w = useWebdavBackup()
    w.config.value.url = 'https://dav.example.com'
    w.config.value.username = 'user'
    w.config.value.password = 'secret'
    await w.restore()
    expect(api.webdavRestore).toHaveBeenCalledWith({
      webdav: {
        url: 'https://dav.example.com',
        username: 'user',
        password: 'secret',
        dir: '',
      },
    })
    expect(applySettings).toHaveBeenCalledWith(sampleUiSettings)
    expect(refreshProfiles).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('restore() skips applySettings when the backup carried no uiSettings', async () => {
    api.webdavRestore.mockResolvedValue({ ok: true, restored: 1 })
    const w = useWebdavBackup()
    await w.restore()
    expect(applySettings).not.toHaveBeenCalled()
    expect(refreshProfiles).toHaveBeenCalledOnce()
    expect(toast.success).toHaveBeenCalled()
  })

  it('backup() surfaces failures via toast.error and clears busy (no swallowing)', async () => {
    api.webdavBackup.mockRejectedValue(new Error('401 Unauthorized'))
    const w = useWebdavBackup()
    await w.backup()
    expect(toast.error).toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(w.busy.value).toBe(false)
  })

  it('restore() surfaces failures via toast.error and clears busy (no swallowing)', async () => {
    api.webdavRestore.mockRejectedValue(new Error('404 Not Found'))
    const w = useWebdavBackup()
    await w.restore()
    expect(toast.error).toHaveBeenCalled()
    expect(applySettings).not.toHaveBeenCalled()
    expect(w.busy.value).toBe(false)
  })
})
