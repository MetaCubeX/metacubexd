// packages/ui/composables/useKernelVersions.ts
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// Kernel version manager (capability-gated 'kernel-version'). Lists the
// downloaded + bundled mihomo versions, lets the user pick one and switch to
// it (download + persist + live restart on the agent side). Failures surface
// via toast — never swallowed.
export function useKernelVersions() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { t } = useI18n()

  // Drives the panel's v-if — same capability-gating pattern as the other panels.
  const available = computed(() => hasFeature('kernel-version'))

  const versions = ref<string[]>([])
  const current = ref<string | undefined>(undefined)
  const bundled = ref('')
  const selected = ref('')
  const loading = ref(false)
  const switching = ref(false)

  const load = async () => {
    loading.value = true
    try {
      const res = await api.getKernelVersions()
      versions.value = res.versions
      current.value = res.current
      bundled.value = res.bundled
      // Default the <select> to the currently active version.
      selected.value = res.current ?? res.versions[0] ?? ''
    } catch (e) {
      toast.error(t('kernelVersionLoadFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      loading.value = false
    }
  }

  const switch_ = async () => {
    const version = selected.value
    if (!version) return
    switching.value = true
    try {
      await api.switchKernel(version)
      // The kernel restarts under a new binary — re-read the version list so
      // `current` reflects the switch.
      await load()
      toast.success(t('kernelVersionSwitched', { version }))
    } catch (e) {
      toast.error(t('kernelVersionSwitchFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      switching.value = false
    }
  }

  return {
    available,
    versions,
    current,
    bundled,
    selected,
    loading,
    switching,
    load,
    // `switch` is a reserved word — expose it under the friendly name.
    switch: switch_,
  }
}
