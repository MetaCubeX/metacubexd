import { splitRuleFields } from '@metacubexd/config-editor'
import { toast } from 'vue-sonner'
import { useActiveProfileEditor } from './useActiveProfileEditor'

declare function useI18n(): { t: (key: string, named?: object) => string }

export function useRuleEditor() {
  const session = useActiveProfileEditor()
  const { t } = useI18n()
  const rules = ref<string[]>([])
  const state = ref<
    | 'idle'
    | 'ready'
    | 'unavailable'
    | 'no-active-profile'
    | 'conflict'
    | 'error'
  >('idle')

  const sync = () => session.replaceSections({ rules: rules.value })
  const isValid = (line: string): boolean => {
    if (!line.trim()) return false
    const fields = splitRuleFields(line)
    const minimumFields = fields[0]?.toUpperCase() === 'MATCH' ? 2 : 3
    return (
      fields.length >= minimumFields &&
      fields.every((field) => field.length > 0)
    )
  }

  const load = async () => {
    const result = await session.load()
    state.value = result
    if (result === 'ready' || result === 'conflict') {
      const section = session.data.value?.rules
      rules.value = Array.isArray(section)
        ? section.map((line) => String(line))
        : []
    } else {
      rules.value = []
    }
    if (result === 'error') {
      toast.error(t('rulesEditorLoadFailed'), {
        description: session.errorMessage.value,
      })
    }
    return result
  }

  const add = (line = '') => {
    rules.value = [...rules.value, line]
    sync()
  }

  const update = (index: number, line: string) => {
    rules.value = rules.value.map((rule, itemIndex) =>
      itemIndex === index ? line : rule,
    )
    sync()
  }

  const remove = (index: number) => {
    rules.value = rules.value.filter((_, itemIndex) => itemIndex !== index)
    sync()
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rules.value.length) return
    const next = [...rules.value]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    rules.value = next
    sync()
  }

  const save = async (): Promise<boolean> => {
    if (!rules.value.every(isValid)) {
      toast.error(t('rulesEditorInvalid'))
      return false
    }
    sync()
    const result = await session.save()
    if (result === 'saved' || result === 'unchanged') return true
    if (result === 'conflict') {
      state.value = 'conflict'
      toast.error(t('routingEditorConflict'))
      return false
    }
    if (result === 'invalid') {
      toast.error(t('rulesEditorInvalid'))
      return false
    }
    toast.error(t('rulesEditorSaveFailed'), {
      description: session.errorMessage.value,
    })
    return false
  }

  return {
    available: session.available,
    rules,
    state,
    loading: session.loading,
    saving: session.saving,
    dirty: session.dirty,
    diagnostics: session.diagnostics,
    fullEditorPath: session.fullEditorPath,
    isValid,
    load,
    add,
    update,
    remove,
    move,
    save,
  }
}
