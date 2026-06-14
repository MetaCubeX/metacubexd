// packages/ui/composables/useProfiles.ts
import type {
  KernelState,
  ProfileDetail,
  ProfileMeta,
  ValidateResult,
} from '~/types/control'
import { useControlApi } from './useControlApi'

export function useProfiles() {
  const api = useControlApi()
  const profiles = ref<ProfileMeta[]>([])
  const loading = ref(false)

  const refresh = async () => {
    loading.value = true
    try {
      profiles.value = await api.listProfiles()
    } finally {
      loading.value = false
    }
  }

  const create = async (body: { name: string; content?: string }) => {
    await api.createProfile(body)
    await refresh()
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
  const save = async (id: string, content: string) => {
    await api.updateProfile(id, { content })
    await refresh()
  }
  const load = (id: string): Promise<ProfileDetail> => api.getProfile(id)
  const validate = (id: string): Promise<ValidateResult> =>
    api.validateProfile(id)
  const activate = async (id: string): Promise<KernelState> => {
    const state = await api.activateProfile(id)
    await refresh()
    return state
  }

  return {
    profiles,
    loading,
    refresh,
    create,
    duplicate,
    remove,
    importUrl,
    save,
    load,
    validate,
    activate,
  }
}
