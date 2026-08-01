import type {
  ConfigDiagnostic,
  ConfigObject,
  ConfigValue,
} from '@metacubexd/config-editor'
import type { ProfileEditorSnapshot } from '~/types/control'
import {
  diffDocument,
  openDocument,
  replaceDocumentData,
} from '@metacubexd/config-editor'
import { controlErrorMessage } from '~/utils/controlError'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

export type ActiveProfileEditorLoadResult =
  'ready' | 'unavailable' | 'no-active-profile' | 'conflict' | 'error'

export type ActiveProfileEditorSaveResult =
  'saved' | 'unchanged' | 'invalid' | 'conflict' | 'error'

function cloneValue<T extends ConfigValue>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneValue(item as ConfigValue),
      ]),
    ) as T
  }
  return value
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as Record<string, unknown>
  const response = record.response
  if (
    response &&
    typeof response === 'object' &&
    (response as { status?: number }).status === 409
  )
    return true
  const data = record.data
  return (
    !!data &&
    typeof data === 'object' &&
    ((data as { statusCode?: number }).statusCode === 409 ||
      (data as { status?: number }).status === 409)
  )
}

/**
 * Deep module for editing the currently active managed Profile. Callers only
 * replace top-level sections; profile discovery, optimistic patches, remote
 * overlays, validation, one-restart apply and conflict detection stay hidden.
 */
export function useActiveProfileEditor() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const available = computed(() => hasFeature('visual-config-editor'))
  const snapshot = shallowRef<ProfileEditorSnapshot | null>(null)
  const draftDocument = shallowRef<ReturnType<typeof openDocument> | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const errorMessage = ref('')

  const data = computed<ConfigObject | null>(
    () => draftDocument.value?.data ?? null,
  )
  const diagnostics = computed<ConfigDiagnostic[]>(
    () => draftDocument.value?.diagnostics ?? [],
  )
  const hasErrors = computed(() =>
    diagnostics.value.some((item) => item.severity === 'error'),
  )
  const conflicted = computed(() => Boolean(snapshot.value?.conflicts.length))
  const dirty = computed(() => {
    if (!snapshot.value || !draftDocument.value) return false
    return (
      diffDocument(snapshot.value.editableYaml, draftDocument.value).operations
        .length > 0
    )
  })
  const fullEditorPath = computed(() =>
    snapshot.value
      ? `/profiles/${snapshot.value.profile.id}/edit`
      : '/profiles',
  )

  const load = async (): Promise<ActiveProfileEditorLoadResult> => {
    if (!available.value) return 'unavailable'
    loading.value = true
    errorMessage.value = ''
    snapshot.value = null
    draftDocument.value = null
    try {
      const profiles = await api.listProfiles()
      const active = profiles.find(
        (profile) =>
          profile.active &&
          profile.type !== 'merge' &&
          profile.type !== 'script',
      )
      if (!active) return 'no-active-profile'
      const next = await api.getProfileEditor(active.id)
      snapshot.value = next
      draftDocument.value = openDocument(next.editableYaml)
      return next.conflicts.length ? 'conflict' : 'ready'
    } catch (error) {
      errorMessage.value = controlErrorMessage(error)
      return 'error'
    } finally {
      loading.value = false
    }
  }

  const replaceSections = (
    sections: Record<string, ConfigValue | undefined>,
  ): void => {
    if (!draftDocument.value) return
    const next: ConfigObject = { ...draftDocument.value.data }
    for (const [key, value] of Object.entries(sections)) {
      if (value === undefined) delete next[key]
      else next[key] = cloneValue(value)
    }
    draftDocument.value = replaceDocumentData(draftDocument.value, next)
  }

  const save = async (): Promise<ActiveProfileEditorSaveResult> => {
    const currentSnapshot = snapshot.value
    const currentDocument = draftDocument.value
    if (!currentSnapshot || !currentDocument) return 'error'
    if (currentSnapshot.conflicts.length) return 'conflict'
    if (currentDocument.diagnostics.some((item) => item.severity === 'error'))
      return 'invalid'

    const patch = diffDocument(currentSnapshot.editableYaml, currentDocument)
    if (!patch.operations.length) return 'unchanged'

    saving.value = true
    errorMessage.value = ''
    try {
      await api.applyProfileEditor(currentSnapshot.profile.id, patch)
      return 'saved'
    } catch (error) {
      errorMessage.value = controlErrorMessage(error)
      return isConflictError(error) ? 'conflict' : 'error'
    } finally {
      saving.value = false
    }
  }

  return {
    available,
    snapshot,
    data,
    diagnostics,
    hasErrors,
    conflicted,
    dirty,
    loading,
    saving,
    errorMessage,
    fullEditorPath,
    load,
    replaceSections,
    save,
  }
}
