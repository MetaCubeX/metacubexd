// packages/ui/composables/useDnsSettings.ts
import type { Config } from '~/types'
import { toast } from 'vue-sonner'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// The subset of mihomo dns settings this card edits. mihomo can hot-apply some
// of these via PATCH /configs; the others (e.g. nameserver list) need a kernel
// reload — the card surfaces a note pointing the user at the config editor.
export interface DnsPayload {
  'enhanced-mode': string
  nameserver: string[]
  fallback: string[]
  'fake-ip-range': string
  'use-hosts': boolean
}

// Caller supplies the configs PATCH mutation (useUpdateConfigMutation) so the
// composable stays unit-testable without mounting a component / hitting net.
export interface DnsSettingsMutation {
  mutate: (vars: { key: keyof Config; value: unknown }) => unknown
}

// Split a textarea value into a trimmed, blank-free list of entries.
function linesToList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function listToLines(value: unknown): string {
  return Array.isArray(value) ? value.join('\n') : ''
}

// DNS settings editor backing the config-page card. Works against any mihomo
// backend (NOT agent-gated). Save errors surface via toast — never swallowed.
export function useDnsSettings(mutation: DnsSettingsMutation) {
  const { t } = useI18n()

  const form = reactive({
    enhancedMode: 'fake-ip',
    nameserver: '',
    fallback: '',
    fakeIpRange: '',
    useHosts: false,
  })

  const saving = ref(false)

  function syncFromConfig(config: Config | null | undefined) {
    const dns = (config?.dns ?? {}) as Partial<NonNullable<Config['dns']>>
    form.enhancedMode = dns['enhanced-mode'] || 'fake-ip'
    form.nameserver = listToLines(dns.nameserver)
    form.fallback = listToLines(dns.fallback)
    form.fakeIpRange = dns['fake-ip-range'] || ''
    form.useHosts = dns['use-hosts'] ?? false
  }

  function buildPayload(): DnsPayload {
    return {
      'enhanced-mode': form.enhancedMode,
      nameserver: linesToList(form.nameserver),
      fallback: linesToList(form.fallback),
      'fake-ip-range': form.fakeIpRange,
      'use-hosts': form.useHosts,
    }
  }

  async function save() {
    saving.value = true
    try {
      await mutation.mutate({ key: 'dns', value: buildPayload() })
      toast.success(t('dnsSettingsSaved'))
    } catch (e) {
      toast.error(t('dnsSettingsSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      saving.value = false
    }
  }

  return { form, saving, syncFromConfig, buildPayload, save }
}
