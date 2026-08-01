import type {
  ConfigObject,
  ConfigResourceReference,
  ConfigValue,
} from '@metacubexd/config-editor'
import { findResourceReferences } from '@metacubexd/config-editor'
import { useActiveProfileEditor } from './useActiveProfileEditor'

export interface RoutingResourceDraft {
  value: ConfigObject
  /** Present for persisted resources; identity is immutable in the page editor. */
  originalName?: string
}

function isConfigObject(value: ConfigValue): value is ConfigObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneValue<T extends ConfigValue>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item)) as T
  if (isConfigObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    ) as T
  }
  return value
}

function draftsFromSection(value: ConfigValue | undefined) {
  if (!Array.isArray(value)) return []
  return value.filter(isConfigObject).map((item) => ({
    value: cloneValue(item),
    originalName:
      typeof item.name === 'string' && item.name ? item.name : undefined,
  }))
}

export function useProxyConfigEditor() {
  const session = useActiveProfileEditor()
  const state = ref<
    | 'idle'
    | 'ready'
    | 'unavailable'
    | 'no-active-profile'
    | 'conflict'
    | 'error'
  >('idle')
  const proxies = ref<RoutingResourceDraft[]>([])
  const groups = ref<RoutingResourceDraft[]>([])
  const blockedReferences = ref<ConfigResourceReference[]>([])
  const blockedResourceName = ref('')

  const providerNames = computed(() => {
    const providers = session.data.value?.['proxy-providers']
    return providers &&
      !Array.isArray(providers) &&
      typeof providers === 'object'
      ? Object.keys(providers)
      : []
  })

  const sync = () => {
    session.replaceSections({
      proxies: proxies.value.map((draft) => cloneValue(draft.value)),
      'proxy-groups': groups.value.map((draft) => cloneValue(draft.value)),
    })
  }

  const load = async () => {
    const result = await session.load()
    state.value = result
    blockedReferences.value = []
    blockedResourceName.value = ''
    if (result === 'ready' || result === 'conflict') {
      proxies.value = draftsFromSection(session.data.value?.proxies)
      groups.value = draftsFromSection(session.data.value?.['proxy-groups'])
    } else {
      proxies.value = []
      groups.value = []
    }
    return result
  }

  const add = (kind: 'proxy' | 'group', value: ConfigObject) => {
    const target = kind === 'proxy' ? proxies : groups
    target.value = [...target.value, { value: cloneValue(value) }]
    sync()
  }

  const update = (
    kind: 'proxy' | 'group',
    index: number,
    value: ConfigObject,
  ) => {
    const target = kind === 'proxy' ? proxies : groups
    const current = target.value[index]
    if (!current) return
    const nextValue = cloneValue(value)
    if (current.originalName) nextValue.name = current.originalName
    target.value = target.value.map((draft, itemIndex) =>
      itemIndex === index ? { ...draft, value: nextValue } : draft,
    )
    sync()
  }

  const move = (kind: 'proxy' | 'group', from: number, to: number) => {
    const target = kind === 'proxy' ? proxies : groups
    if (to < 0 || to >= target.value.length) return
    const next = [...target.value]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    target.value = next
    sync()
  }

  const remove = (kind: 'proxy' | 'group', index: number): boolean => {
    sync()
    const target = kind === 'proxy' ? proxies : groups
    const current = target.value[index]
    if (!current) return false
    const name = String(current.value.name ?? '')
    const references = session.data.value
      ? findResourceReferences(session.data.value, name)
      : []
    if (references.length) {
      blockedResourceName.value = name
      blockedReferences.value = references
      return false
    }
    blockedResourceName.value = ''
    blockedReferences.value = []
    target.value = target.value.filter((_, itemIndex) => itemIndex !== index)
    sync()
    return true
  }

  const nameExists = (
    name: string,
    current?: { kind: 'proxy' | 'group'; index: number },
  ) => {
    const normalized = name.trim()
    return [...proxies.value, ...groups.value].some((draft) => {
      if (!normalized || draft.value.name !== normalized) return false
      if (!current) return true
      const target = current.kind === 'proxy' ? proxies.value : groups.value
      return target[current.index] !== draft
    })
  }

  const save = async () => {
    sync()
    const result = await session.save()
    if (result === 'conflict') state.value = 'conflict'
    return result
  }

  return {
    available: session.available,
    state,
    proxies,
    groups,
    providerNames,
    blockedReferences,
    blockedResourceName,
    loading: session.loading,
    saving: session.saving,
    dirty: session.dirty,
    diagnostics: session.diagnostics,
    errorMessage: session.errorMessage,
    fullEditorPath: session.fullEditorPath,
    load,
    add,
    update,
    move,
    remove,
    nameExists,
    save,
  }
}
