// packages/ui/composables/useTunConfig.ts
import { toast } from 'vue-sonner'
import { useProfileStatus } from './useProfileStatus'
import { useTun } from './useTun'

// `useI18n` is auto-imported by @nuxtjs/i18n (no explicit import). In unit
// tests it is provided as a global stub via test/setup.ts.
declare function useI18n(): { t: (key: string, named?: object) => string }

// Stacks mihomo accepts for `tun.stack` (constant/tun.go), in the casing
// GET /configs reports; it parses them case-insensitively. lwIP was dropped in
// mihomo 1.18 and is now refused as "invalid tun stack".
export const TUN_STACKS = ['Mixed', 'gVisor', 'System', 'Mips']

// Map a reported stack onto its option regardless of case (the agent and
// profiles use lowercase). Unknown values are kept so the select shows them.
export function normalizeTunStack(stack?: string | null): string {
  if (!stack) return 'Mixed'
  const lower = stack.toLowerCase()
  return TUN_STACKS.find((s) => s.toLowerCase() === lower) ?? stack
}

// Select options: the known stacks, plus the current one if the kernel runs
// a stack this list does not know yet.
export function tunStackOptions(current: string): string[] {
  return TUN_STACKS.includes(current) ? TUN_STACKS : [...TUN_STACKS, current]
}

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
  // used only when the desktop 'tun' capability is absent. Rejects when the
  // backend refuses the change.
  patch: (value: {
    enable?: boolean
    stack?: string
  }) => void | Promise<unknown>
}

export function useTunConfig(options: TunConfigOptions) {
  const tun = useTun()
  const profileStatus = useProfileStatus()
  const { t } = useI18n()

  // Desktop (capability present) routes through /api/control/tun; otherwise we
  // fall back to the plain remote Clash-API PATCH behaviour (no regression).
  const desktopMode = computed(() => tun.available.value)

  // Enabling TUN writes the `tun:` block into the ACTIVE profile, so with no base
  // profile imported yet the enable is doomed — it would stop the sidecar then
  // throw mid-sequence (the no-active-profile 409). Gate the toggle on a base
  // profile existing so a first-run user is nudged to import instead of hitting
  // that error. Only blocks while we're SURE (probe settled + zero profiles);
  // until `ready`, stay optimistic so a real profile never flashes as missing.
  // Web/remote backends have no agent profiles concept here — never block them.
  const needsProfile = computed(
    () =>
      desktopMode.value &&
      profileStatus.ready.value &&
      !profileStatus.hasBaseProfile.value,
  )

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
  // The helper may have been installed in any prior session, so offer removal
  // whenever we're on the desktop backend (uninstall is a safe no-op if nothing
  // is registered — the install scripts' uninstall tolerates a missing service).
  const showUninstallButton = computed(() => desktopMode.value)

  // Probe the current TUN status once (desktop only — there is no agent on a
  // plain remote backend). Failures surface via toast inside useTun.
  const init = () => {
    if (desktopMode.value) void tun.load()
  }

  // Remote PATCH; a refused change surfaces via toast and resolves false so
  // the caller can put the form back to what the backend runs.
  const patchRemote = async (value: { enable?: boolean; stack?: string }) => {
    try {
      await options.patch(value)
      return true
    } catch (e) {
      toast.error(t('tunSaveFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
      return false
    }
  }

  const onToggle = async (next: boolean, currentStack?: string) => {
    if (desktopMode.value) {
      // Defense in depth: the UI also disables the toggle, but never start a
      // doomed enable (no active profile to inject the `tun:` block into).
      // Turning TUN OFF is always allowed (it doubles as the recover escape).
      if (next && needsProfile.value) return
      // enable()/disable() install/elevate + privileged-restart the kernel.
      if (next) await tun.enable(currentStack)
      else await tun.disable()
      return
    }
    // Remote backend: keep the existing Clash-API PATCH behaviour.
    return patchRemote({ enable: next })
  }

  const onStackChange = async (nextStack: string) => {
    if (desktopMode.value) {
      // The stack select passes through to enable(stack). Only re-apply while
      // TUN is already live — flipping the stack should not trigger a
      // privileged install/elevation prompt while still in sidecar mode.
      if (tun.status.value.enabled) await tun.enable(nextStack)
      return
    }
    return patchRemote({ stack: nextStack })
  }

  // Emergency: force back to the sidecar + tear TUN down.
  const onRecoverNetwork = async () => {
    await tun.disable()
  }

  // Remove the privileged helper service entirely (revoke the elevation grant).
  const onUninstall = async () => {
    await tun.uninstall()
  }

  return {
    desktopMode,
    enabled,
    stack,
    busy,
    needsProfile,
    showRecoverButton,
    showInstallNote,
    showUninstallButton,
    init,
    onToggle,
    onStackChange,
    onRecoverNetwork,
    onUninstall,
  }
}
