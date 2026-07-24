// packages/ui/composables/useTun.ts
import type { TunStatus } from '~/types/control'
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'
import { onControlInvalidate } from './useControlSync'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// TUN-mode control (capability-gated 'tun'). On desktop, flipping TUN cannot go
// through the unprivileged Clash API PATCH — it must route through
// /api/control/tun so the agent can install/elevate the privileged helper and
// privileged-restart mihomo. enable(stack) switches into TUN mode; disable()
// tears TUN down and returns to the in-process sidecar, doubling as the
// "recover network" escape hatch. Every call is slow (install/elevation/
// kernel restart), so `busy` gates the UI. Failures surface via toast — never
// swallowed.
export function useTun() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { t } = useI18n()

  // Drives the desktop-only UI — same capability-gating pattern as the other
  // control composables.
  const available = computed(() => hasFeature('tun'))

  // Default to the safe sidecar state until the first GET resolves.
  const status = ref<TunStatus>({ enabled: false, mode: 'sidecar' })
  const busy = ref(false)

  // Re-sync from the agent when TUN is toggled from outside the SPA (the tray
  // checkbox routes through the Control API, not this composable). (#2148)
  onControlInvalidate(() => {
    void load()
  })

  const load = async () => {
    busy.value = true
    try {
      status.value = await api.getTun()
    } catch (e) {
      toast.error(t('tunLoadFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  // Switch into TUN mode. Omit `stack` from the body when none is chosen so the
  // agent falls back to the kernel/profile default.
  const enable = async (stack?: string) => {
    busy.value = true
    try {
      status.value = await api.setTun(
        stack ? { enabled: true, stack } : { enabled: true },
      )
      toast.success(t('tunEnableSuccess'))
    } catch (e) {
      toast.error(t('tunEnableFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  // Tear TUN down + return to the sidecar. Also exposed as the recover-network
  // action (forces the kernel back into the unprivileged in-process mode).
  const disable = async () => {
    busy.value = true
    try {
      status.value = await api.setTun({ enabled: false })
      toast.success(t('tunDisableSuccess'))
    } catch (e) {
      toast.error(t('tunDisableFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  // Remove the privileged helper service entirely. The agent tears TUN down to
  // the sidecar first, then unregisters the OS service — useful to revoke the
  // elevation grant or recover from a wedged/stale install. Echoes the
  // post-uninstall status (sidecar).
  const uninstall = async () => {
    busy.value = true
    try {
      status.value = await api.uninstallTun()
      toast.success(t('tunUninstallSuccess'))
    } catch (e) {
      toast.error(t('tunUninstallFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      busy.value = false
    }
  }

  return { available, status, busy, load, enable, disable, uninstall }
}
