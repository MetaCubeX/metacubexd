// packages/ui/composables/useProfiles.ts
import type {
  KernelState,
  ProfileDetail,
  ProfileMeta,
  ValidateResult,
} from '~/types/control'
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// `useProxiesStore` is auto-imported (Pinia store). In unit tests it is
// provided as a global stub.
declare function useProxiesStore(): { closeAllConnections: () => Promise<void> }

export function useProfiles() {
  const api = useControlApi()
  const proxiesStore = useProxiesStore()
  const { t } = useI18n()
  const profiles = ref<ProfileMeta[]>([])
  const loading = ref(false)

  // Base (local/remote) profiles drive the activate flow; merge overlays and
  // script transforms are composed onto whichever base is active. Keep them in
  // separate lists so the page can render them in distinct sections.
  const baseProfiles = computed(() =>
    profiles.value.filter((p) => p.type !== 'merge' && p.type !== 'script'),
  )
  const mergeProfiles = computed(() =>
    profiles.value.filter((p) => p.type === 'merge'),
  )
  // Script transforms run after merges during composition (config -> config).
  const scriptProfiles = computed(() =>
    profiles.value.filter((p) => p.type === 'script'),
  )

  // The last activated non-merge base — needed to re-compose the active config
  // after a merge overlay is toggled or edited. Undefined until the user
  // activates a base this session (the agent does not expose the active id).
  const activeBaseId = ref<string | undefined>(undefined)

  const refresh = async () => {
    loading.value = true
    try {
      profiles.value = await api.listProfiles()
    } finally {
      loading.value = false
    }
  }

  const create = async (body: {
    name: string
    content?: string
    type?: 'local' | 'merge' | 'script'
  }) => {
    await api.createProfile(body)
    await refresh()
  }
  // Mint a new merge overlay (YAML composed onto the active base).
  const createMerge = async (name: string) => {
    await create({ name, type: 'merge' })
  }
  // Mint a new script transform (JS run after merges during composition).
  const createScript = async (name: string) => {
    await create({ name, type: 'script' })
  }
  const duplicate = async (id: string, name?: string) => {
    await api.duplicateProfile(id, name)
    await refresh()
  }
  const remove = async (id: string) => {
    await api.deleteProfile(id)
    await refresh()
  }
  const importUrl = async (url: string, name?: string) => {
    await api.importProfile(url, name)
    await refresh()
  }
  // Re-fetch a remote subscription in place: the agent overwrites the stored
  // content + subscriptionInfo + updatedAt under the same id, so a re-list shows
  // the fresh traffic/expiry numbers. The agent throws for non-remote profiles
  // (or on a network failure) — surface it via toast and return whether it
  // succeeded so the caller can react, never swallow it silently.
  const refreshRemote = async (id: string): Promise<boolean> => {
    try {
      await api.refreshProfile(id)
      await refresh()
      toast.success(t('profilesRefreshed'))
      return true
    } catch (e) {
      toast.error(t('profilesRefreshFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    }
  }
  const save = async (id: string, content: string) => {
    await api.updateProfile(id, { content })
    await refresh()
  }
  const load = (id: string): Promise<ProfileDetail> => api.getProfile(id)
  const validate = (id: string): Promise<ValidateResult> =>
    api.validateProfile(id)
  const activate = async (id: string): Promise<KernelState> => {
    const state = await api.activateProfile(id)
    activeBaseId.value = id
    await refresh()
    // A profile switch can re-route any connection, so drop the existing ones
    // (when the user opted into autoCloseConns) for the change to take effect
    // immediately instead of waiting for live connections to die naturally.
    await proxiesStore.closeAllConnections()
    return state
  }

  // Re-run setActive on the current base so enabled merge overlays re-compose
  // onto it. If no base is active this session, tell the user to activate one.
  const recompose = async () => {
    if (!activeBaseId.value) {
      toast.info(t('profilesMergeNoActiveBase'))
      return
    }
    await api.activateProfile(activeBaseId.value)
  }

  // Enable/disable a merge overlay, then re-compose the active config so the
  // change takes effect. Failures surface via toast — never swallowed.
  const setEnabled = async (id: string, enabled: boolean) => {
    try {
      await api.updateProfile(id, { enabled })
      await refresh()
      await recompose()
    } catch (e) {
      toast.error(t('profilesMergeUpdateFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Save merge overlay content, then re-compose the active config.
  const saveMerge = async (id: string, content: string) => {
    try {
      await api.updateProfile(id, { content })
      await refresh()
      await recompose()
    } catch (e) {
      toast.error(t('profilesMergeUpdateFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Enable/disable a script transform, then re-compose the active config so the
  // change takes effect. Failures surface via toast — never swallowed.
  const setScriptEnabled = async (id: string, enabled: boolean) => {
    try {
      await api.updateProfile(id, { enabled })
      await refresh()
      await recompose()
    } catch (e) {
      toast.error(t('profilesScriptUpdateFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Save script transform content, then re-compose the active config.
  const saveScript = async (id: string, content: string) => {
    try {
      await api.updateProfile(id, { content })
      await refresh()
      await recompose()
    } catch (e) {
      toast.error(t('profilesScriptUpdateFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return {
    profiles,
    baseProfiles,
    mergeProfiles,
    scriptProfiles,
    activeBaseId,
    loading,
    refresh,
    create,
    createMerge,
    createScript,
    duplicate,
    remove,
    importUrl,
    refreshRemote,
    save,
    saveMerge,
    saveScript,
    setEnabled,
    setScriptEnabled,
    load,
    validate,
    activate,
  }
}
