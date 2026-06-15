// packages/ui/composables/useSystemProxy.ts
import type { SystemProxyState } from '~/types/control'
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// Parse the editable textarea (one bypass entry per line) into the array the
// agent expects: trimmed, blank lines dropped. The inverse of stringifyBypass.
function parseBypass(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function stringifyBypass(list: string[]): string {
  return list.join('\n')
}

export function useSystemProxy() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { t } = useI18n()

  // Drives the card's v-if — same capability-gating pattern as KernelControlPanel.
  const available = computed(() => hasFeature('system-proxy'))

  const enabled = ref(false)
  const port = ref(0)
  const bypassText = ref('')
  const loading = ref(false)

  const sync = (s: SystemProxyState) => {
    enabled.value = s.enabled
    port.value = s.port
    bypassText.value = stringifyBypass(s.bypass)
  }

  // Surface failures via toast — never swallowed (the panel previously hid
  // these behind .catch(() => {})).
  const load = async () => {
    loading.value = true
    try {
      sync(await api.getSysProxy())
    } catch (e) {
      toast.error(t('systemProxyLoadFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      loading.value = false
    }
  }

  const save = async () => {
    loading.value = true
    try {
      sync(
        await api.setSysProxy({
          enabled: enabled.value,
          bypass: parseBypass(bypassText.value),
        }),
      )
    } catch (e) {
      toast.error(t('systemProxyApplyFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      loading.value = false
    }
  }

  // Flip the toggle then persist immediately (the enable/disable switch).
  const toggle = async (next: boolean) => {
    enabled.value = next
    await save()
  }

  return {
    available,
    enabled,
    port,
    bypassText,
    loading,
    load,
    save,
    toggle,
  }
}
