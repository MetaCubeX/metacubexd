// packages/ui/composables/useTunConfig.ts
import { useTun } from './useTun'

// Decision logic for the config-page TUN section. There are two backends:
//
//   1. Desktop with the 'tun' capability — flipping TUN cannot go through the
//      unprivileged Clash-API PATCH; it must route through /api/control/tun so
//      the agent installs/elevates the privileged helper and privileged-starts
//      mihomo. enable(stack)/disable() (the latter doubling as recover-network)
//      come from useTun (B4-T1).
//   2. A plain remote mihomo backend — there is no agent, so we keep the
//      existing Clash-API PATCH of the `tun` block (passed in as `patch`).
//
// This composable is kept UI-framework-free (no .vue) so it can be unit-tested
// without @vue/test-utils, which the repo intentionally does not depend on.
export interface TunConfigOptions {
  // The existing Clash-API PATCH path (config.vue's updateConfig('tun', …)),
  // used only when the desktop 'tun' capability is absent.
  patch: (value: { enable?: boolean; stack?: string }) => void
}

export function useTunConfig(options: TunConfigOptions) {
  const tun = useTun()

  // Desktop (capability present) routes through /api/control/tun; otherwise we
  // fall back to the plain remote Clash-API PATCH behaviour (no regression).
  const desktopMode = computed(() => tun.available.value)

  const enabled = computed(() => tun.status.value.enabled)
  const stack = computed(() => tun.status.value.stack)
  const busy = tun.busy

  // The recover-network escape hatch + the install/elevation note only make
  // sense on desktop. The button is offered once TUN is actually live; the note
  // is shown before the first enable (still in the in-process sidecar mode).
  const showRecoverButton = computed(
    () => desktopMode.value && tun.status.value.mode === 'tun',
  )
  const showInstallNote = computed(
    () => desktopMode.value && tun.status.value.mode !== 'tun',
  )

  // Probe the current TUN status once (desktop only — there is no agent on a
  // plain remote backend). Failures surface via toast inside useTun.
  const init = () => {
    if (desktopMode.value) void tun.load()
  }

  const onToggle = async (next: boolean, currentStack?: string) => {
    if (desktopMode.value) {
      // enable()/disable() install/elevate + privileged-restart the kernel.
      if (next) await tun.enable(currentStack)
      else await tun.disable()
      return
    }
    // Remote backend: keep the existing Clash-API PATCH behaviour.
    options.patch({ enable: next })
  }

  const onStackChange = async (nextStack: string) => {
    if (desktopMode.value) {
      // The stack select passes through to enable(stack). Only re-apply while
      // TUN is already live — flipping the stack should not trigger a
      // privileged install/elevation prompt while still in sidecar mode.
      if (tun.status.value.enabled) await tun.enable(nextStack)
      return
    }
    options.patch({ stack: nextStack })
  }

  // Emergency: force back to the sidecar + tear TUN down.
  const onRecoverNetwork = async () => {
    await tun.disable()
  }

  return {
    desktopMode,
    enabled,
    stack,
    busy,
    showRecoverButton,
    showInstallNote,
    init,
    onToggle,
    onStackChange,
    onRecoverNetwork,
  }
}
