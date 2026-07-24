// packages/ui/composables/useSystemProxy.ts
import type { SystemProxyState } from '~/types/control'
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'
import { onControlInvalidate } from './useControlSync'

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

  // Re-sync from the agent when system proxy is toggled from outside the SPA
  // (the tray checkbox routes through the Control API, not this composable).
  // (#2148)
  onControlInvalidate(() => {
    void load()
  })

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

  // Returns whether the POST succeeded so callers (e.g. toggle) can revert
  // optimistic UI state on failure. The Apply button calls save() and gets a
  // success toast; toggle() passes { silent: true } since the switch already
  // mirrors state and would otherwise double-toast on every flip.
  const save = async (opts?: { silent?: boolean }): Promise<boolean> => {
    loading.value = true
    try {
      sync(
        await api.setSysProxy({
          enabled: enabled.value,
          bypass: parseBypass(bypassText.value),
        }),
      )
      if (!opts?.silent) toast.success(t('systemProxyApplied'))
      return true
    } catch (e) {
      toast.error(t('systemProxyApplyFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      loading.value = false
    }
  }

  // Flip the toggle then persist immediately (the enable/disable switch). If
  // the save fails, revert to the prior (true backend) state so the toggle
  // never stays stuck in an optimistic position.
  const toggle = async (next: boolean) => {
    const prev = enabled.value
    enabled.value = next
    if (!(await save({ silent: true }))) {
      enabled.value = prev
    }
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
