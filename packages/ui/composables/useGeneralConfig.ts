// packages/ui/composables/useGeneralConfig.ts
import type { Config } from '~/types'
import { orderProxyModes } from '~/utils'

// Caller supplies the configs PATCH mutation (useUpdateConfigMutation) so the
// composable stays unit-testable without mounting a component / hitting net.
// `options` mirrors vue-query's mutate(vars, options?) so the mode save can hook
// onSuccess exactly as the page's updateConfig did.
export interface GeneralConfigMutation {
  mutate: (
    vars: { key: keyof Config; value: unknown },
    options?: { onSuccess?: () => void },
  ) => unknown
}

export interface UseGeneralConfigOptions {
  mutation: GeneralConfigMutation
  // Fired on a SUCCESSFUL running-mode change (config.vue wires this to
  // proxiesStore.closeAllConnections — changing mode re-routes the session).
  onModeChange?: () => void
}

// The kernel's listener ports. `as const` so form[port.key] stays a known key
// under noUncheckedIndexedAccess, and configKey is a literal keyof Config.
export const PORT_FIELDS = [
  { key: 'mixedPort', configKey: 'mixed-port', label: 'Mixed' },
  { key: 'port', configKey: 'port', label: 'HTTP' },
  { key: 'socksPort', configKey: 'socks-port', label: 'Socks' },
  { key: 'redirPort', configKey: 'redir-port', label: 'Redir' },
  { key: 'tproxyPort', configKey: 'tproxy-port', label: 'TProxy' },
] as const

// General Config editor backing the config-page Core Config card: the kernel's
// top-level scalar settings (allow-lan, running mode, unified-delay, outbound
// interface, listener ports), all hot-patched via PATCH /configs. Per-field
// auto-save preserves the page's instant-apply UX.
export function useGeneralConfig(options: UseGeneralConfigOptions) {
  const form = reactive({
    allowLan: false,
    mode: 'rule',
    unifiedDelay: false,
    interfaceName: '',
    mixedPort: 0,
    port: 0,
    socksPort: 0,
    redirPort: 0,
    tproxyPort: 0,
  })

  const modes = ref<string[]>(['rule', 'global', 'direct'])

  function syncFromConfig(config: Config | null | undefined) {
    if (!config) return
    form.allowLan = config['allow-lan'] || false
    form.mode = config.mode || 'rule'
    form.unifiedDelay =
      config['unified-delay'] ?? (config as any).UnifiedDelay ?? false
    form.interfaceName = config['interface-name'] || ''
    form.mixedPort = config['mixed-port'] || 0
    form.port = config.port || 0
    form.socksPort = config['socks-port'] || 0
    form.redirPort = config['redir-port'] || 0
    form.tproxyPort = config['tproxy-port'] || 0
    modes.value = orderProxyModes(
      config['mode-list'] ||
        (config as any).modes || ['rule', 'global', 'direct'],
    )
  }

  function save(key: keyof Config, value: unknown) {
    options.mutation.mutate({ key, value })
  }

  // Running mode is the one field with a side-effect: a successful change drops
  // active connections so the re-route takes effect immediately. Hook it via
  // onSuccess so it fires ONLY for mode and ONLY on success.
  function saveMode() {
    options.mutation.mutate(
      { key: 'mode', value: form.mode },
      { onSuccess: options.onModeChange },
    )
  }

  return { form, modes, syncFromConfig, save, saveMode }
}
