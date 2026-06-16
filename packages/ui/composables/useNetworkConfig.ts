// packages/ui/composables/useNetworkConfig.ts
import { toast } from 'vue-sonner'
import { useControlApi } from './useControlApi'
import { useControlInfo } from './useControlInfo'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// One editable tunnel row. mihomo `tunnels` entries carry network/address/target
// (plus optional proxy fields preserved verbatim on round-trip). The common
// fields are surfaced as columns; any extra keys ride along in `extra`.
export interface TunnelEntry {
  network: string[]
  address: string
  target: string
  extra?: Record<string, unknown>
}

// The reactive sniffer object. `enable` / `override-destination` are the common
// toggles; the rest of the sniffer sub-tree (sniff/force-domain/...) is opaque
// and preserved verbatim so a round-trip is lossless.
interface SnifferState {
  enable: boolean
  overrideDestination: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Parse a raw tunnels entry (mapping) into a structured row, preserving any
// non-common keys so they survive the round-trip.
function parseTunnel(raw: unknown): TunnelEntry {
  if (!isPlainObject(raw)) {
    return { network: ['tcp'], address: '', target: '' }
  }
  const { network, address, target, ...rest } = raw
  const entry: TunnelEntry = {
    network: Array.isArray(network) ? network.map(String) : ['tcp'],
    address: typeof address === 'string' ? address : '',
    target: typeof target === 'string' ? target : '',
  }
  if (Object.keys(rest).length) entry.extra = rest
  return entry
}

// Inverse of parseTunnel — re-merge the preserved extra keys.
function serializeTunnel(entry: TunnelEntry): Record<string, unknown> {
  return {
    network: entry.network,
    address: entry.address,
    target: entry.target,
    ...(entry.extra ?? {}),
  }
}

// Network config editors (capability-gated 'config-sections'). Reads/writes the
// tunnels / sniffer / interface-name / external-controller / secret top-level
// sections of the active profile via the config-section primitive. Each editor
// saves with a SINGLE PUT so the kernel restarts once. external-controller /
// secret are app-managed on desktop and exposed read-only. Errors surface via
// toast — never swallowed.
export function useNetworkConfig() {
  const api = useControlApi()
  const { hasFeature } = useControlInfo()
  const { t } = useI18n()

  const available = computed(() => hasFeature('config-sections'))

  const loading = ref(false)
  // Per-section busy key so saving one section no longer spins all three
  // buttons. `saving` is kept as a derived aggregate for backward compatibility
  // (existing callers/tests read it).
  const savingKey = ref<'tunnels' | 'sniffer' | 'interface-name' | null>(null)
  const saving = computed(() => savingKey.value !== null)

  // tunnels (array editor)
  const tunnels = ref<TunnelEntry[]>([])

  // sniffer (object editor) — common toggles split out; rest preserved.
  const sniffer = reactive<SnifferState>({
    enable: false,
    overrideDestination: false,
  })
  // Everything in the sniffer object EXCEPT the common toggles, preserved so a
  // save round-trips losslessly.
  let snifferRest: Record<string, unknown> = {}

  // interface-name (string editor — may also hot-apply via PATCH /configs)
  const interfaceName = ref('')

  // external-controller / secret (read-only on desktop — app-managed).
  const externalController = ref('')
  const secret = ref('')

  const load = async () => {
    loading.value = true
    try {
      const [
        tunnelsSection,
        snifferSection,
        interfaceSection,
        controllerSection,
        secretSection,
      ] = await Promise.all([
        api.getConfigSection<unknown>('tunnels'),
        api.getConfigSection<unknown>('sniffer'),
        api.getConfigSection<unknown>('interface-name'),
        api.getConfigSection<unknown>('external-controller'),
        api.getConfigSection<unknown>('secret'),
      ])

      tunnels.value = Array.isArray(tunnelsSection)
        ? tunnelsSection.map(parseTunnel)
        : []

      if (isPlainObject(snifferSection)) {
        const {
          enable,
          'override-destination': overrideDestination,
          ...rest
        } = snifferSection
        sniffer.enable = enable === true
        sniffer.overrideDestination = overrideDestination === true
        snifferRest = rest
      } else {
        sniffer.enable = false
        sniffer.overrideDestination = false
        snifferRest = {}
      }

      interfaceName.value =
        typeof interfaceSection === 'string' ? interfaceSection : ''
      externalController.value =
        typeof controllerSection === 'string' ? controllerSection : ''
      secret.value = typeof secretSection === 'string' ? secretSection : ''
    } catch (e) {
      toast.error(t('networkConfigLoadFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      loading.value = false
    }
  }

  // ---- tunnels -------------------------------------------------------------
  const addTunnel = () => {
    tunnels.value = [
      ...tunnels.value,
      { network: ['tcp'], address: '', target: '' },
    ]
  }

  const removeTunnel = (index: number) => {
    tunnels.value = tunnels.value.filter((_, i) => i !== index)
  }

  const saveTunnels = async (): Promise<boolean> => {
    savingKey.value = 'tunnels'
    try {
      await api.setConfigSection({
        key: 'tunnels',
        value: tunnels.value.map(serializeTunnel),
      })
      toast.success(t('networkConfigSaved'))
      return true
    } catch (e) {
      toast.error(t('networkConfigSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      savingKey.value = null
    }
  }

  // ---- sniffer -------------------------------------------------------------
  const saveSniffer = async (): Promise<boolean> => {
    savingKey.value = 'sniffer'
    try {
      await api.setConfigSection({
        key: 'sniffer',
        value: {
          enable: sniffer.enable,
          'override-destination': sniffer.overrideDestination,
          ...snifferRest,
        },
      })
      toast.success(t('networkConfigSaved'))
      return true
    } catch (e) {
      toast.error(t('networkConfigSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      savingKey.value = null
    }
  }

  // ---- interface-name ------------------------------------------------------
  // Empty input clears the section (null deletes the key on the agent side).
  const saveInterfaceName = async (): Promise<boolean> => {
    savingKey.value = 'interface-name'
    try {
      const trimmed = interfaceName.value.trim()
      await api.setConfigSection({
        key: 'interface-name',
        value: trimmed === '' ? null : trimmed,
      })
      toast.success(t('networkConfigSaved'))
      return true
    } catch (e) {
      toast.error(t('networkConfigSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    } finally {
      savingKey.value = null
    }
  }

  return {
    available,
    loading,
    saving,
    savingKey,
    load,
    // tunnels
    tunnels,
    addTunnel,
    removeTunnel,
    saveTunnels,
    // sniffer
    sniffer,
    saveSniffer,
    // interface-name
    interfaceName,
    saveInterfaceName,
    // external-controller / secret (read-only on desktop)
    externalController,
    secret,
  }
}
