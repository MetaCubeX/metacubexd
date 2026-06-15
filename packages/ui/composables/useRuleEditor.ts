// packages/ui/composables/useRuleEditor.ts
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// One editable rule row. A Clash rule line is `TYPE,PAYLOAD,POLICY[,...params]`;
// the no-payload form is `MATCH,POLICY`. `params` (e.g. no-resolve, src) are
// preserved verbatim so a round-trip through the editor is lossless.
export interface RuleEntry {
  type: string
  payload: string
  policy: string
  params?: string[]
}

// Rule types whose canonical line carries NO payload — their empty payload is
// valid. (MATCH is the catch-all final rule.) Everything else requires one.
const NO_PAYLOAD_TYPES = new Set(['MATCH'])

// Parse a raw rule line into a structured entry. Two tokens => no-payload form.
function parseRule(line: string): RuleEntry {
  const tokens = line.split(',').map((t) => t.trim())
  const type = tokens[0] ?? ''
  if (tokens.length <= 2) {
    return { type, payload: '', policy: tokens[1] ?? '' }
  }
  const entry: RuleEntry = {
    type,
    payload: tokens[1] ?? '',
    policy: tokens[2] ?? '',
  }
  const params = tokens.slice(3)
  if (params.length) entry.params = params
  return entry
}

// Inverse of parseRule. Empty payload collapses to the `TYPE,POLICY` form.
function serializeRule(entry: RuleEntry): string {
  const parts = entry.payload
    ? [entry.type, entry.payload, entry.policy]
    : [entry.type, entry.policy]
  if (entry.params?.length) parts.push(...entry.params)
  return parts.join(',')
}

export function useRuleEditor() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { t } = useI18n()

  // Drives the editor affordance's v-if — same capability gate as the others.
  const available = computed(() => hasFeature('config-sections'))

  const rules = ref<RuleEntry[]>([])
  const loading = ref(false)

  // type/payload/policy non-empty. The no-payload types (MATCH) skip the
  // payload requirement.
  const isValid = (entry: RuleEntry): boolean => {
    if (!entry.type.trim()) return false
    if (!entry.policy.trim()) return false
    if (!entry.payload.trim() && !NO_PAYLOAD_TYPES.has(entry.type)) return false
    return true
  }

  const load = async () => {
    loading.value = true
    try {
      const section = await api.getConfigSection<unknown>('rules')
      const lines = Array.isArray(section) ? section : []
      rules.value = lines.map((l) => parseRule(String(l)))
    } catch (e) {
      toast.error(t('rulesEditorLoadFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      loading.value = false
    }
  }

  const add = (entry: RuleEntry) => {
    rules.value = [...rules.value, entry]
  }

  const update = (index: number, entry: RuleEntry) => {
    rules.value = rules.value.map((r, i) => (i === index ? entry : r))
  }

  const remove = (index: number) => {
    rules.value = rules.value.filter((_, i) => i !== index)
  }

  // Reorder (drag): pull the entry out of `from` and splice it in at `to`.
  const move = (from: number, to: number) => {
    const next = [...rules.value]
    const [moved] = next.splice(from, 1)
    if (moved === undefined) return
    next.splice(to, 0, moved)
    rules.value = next
  }

  // Serialize every entry and PUT ONCE so the kernel restarts a single time.
  // Refuses to send when any entry is invalid. Returns success so the caller
  // can keep the editor open on failure.
  const save = async (): Promise<boolean> => {
    if (!rules.value.every(isValid)) {
      toast.error(t('rulesEditorInvalid'))
      return false
    }
    loading.value = true
    try {
      await api.setConfigSection({
        key: 'rules',
        value: rules.value.map(serializeRule),
      })
      return true
    } catch (e) {
      toast.error(t('rulesEditorSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    available,
    rules,
    loading,
    isValid,
    load,
    add,
    update,
    remove,
    move,
    save,
  }
}
