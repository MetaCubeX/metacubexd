// packages/ui/composables/useSystemProxy.ts
import type { SystemProxyState } from '~/types/control'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

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

  const load = async () => {
    loading.value = true
    try {
      sync(await api.getSysProxy())
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
