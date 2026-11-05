// packages/ui/composables/__tests__/useTunConfig.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeTunStack,
  TUN_STACKS,
  tunStackOptions,
  useTunConfig,
} from '../useTunConfig'

// Remote save errors surface via toast.
const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('vue-sonner', () => ({ toast }))

// useTun is the desktop control composable wired in B4-T1. Stub it so we can
// drive `available` / `status` and assert enable/disable are called.
let available = true
const status = ref<{
  enabled: boolean
  mode: 'sidecar' | 'tun'
  stack?: string
}>({ enabled: false, mode: 'sidecar' })
const busy = ref(false)
const tun = {
  enable: vi.fn(),
  disable: vi.fn(),
  load: vi.fn(),
  uninstall: vi.fn(),
}
vi.mock('../useTun', () => ({
  useTun: () => ({
    available: computed(() => available),
    status,
    busy,
    load: tun.load,
    enable: tun.enable,
    disable: tun.disable,
    uninstall: tun.uninstall,
  }),
}))

// useProfileStatus gates enabling TUN: with no base profile there is nothing to
// inject the `tun:` block into. Stub it so we can drive ready/hasBaseProfile.
const profileReady = ref(true)
const profileHasBase = ref(true)
vi.mock('../useProfileStatus', () => ({
  useProfileStatus: () => ({
    ready: profileReady,
    hasBaseProfile: profileHasBase,
  }),
}))

describe('composables/useTunConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    available = true
    status.value = { enabled: false, mode: 'sidecar' }
    busy.value = false
    profileReady.value = true
    profileHasBase.value = true
  })

  it('desktopMode reflects the tun capability (present -> true)', () => {
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.desktopMode.value).toBe(true)
  })

  it('desktopMode is false on a plain remote backend (capability absent)', () => {
    available = false
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.desktopMode.value).toBe(false)
  })

  // --- DESKTOP (capability present): route through /api/control/tun ---

  it('desktop: toggling ON calls useTun.enable(stack) — NOT the Clash-API patch', async () => {
    const patch = vi.fn()
    const c = useTunConfig({ patch })
    await c.onToggle(true, 'gVisor')
    expect(tun.enable).toHaveBeenCalledWith('gVisor')
    expect(patch).not.toHaveBeenCalled()
  })

  it('desktop: toggling OFF calls useTun.disable() — NOT the Clash-API patch', async () => {
    const patch = vi.fn()
    const c = useTunConfig({ patch })
    await c.onToggle(false, 'gVisor')
    expect(tun.disable).toHaveBeenCalledOnce()
    expect(patch).not.toHaveBeenCalled()
  })

  it('desktop: the stack select passes through to enable(stack) while TUN is active', async () => {
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    const c = useTunConfig({ patch: vi.fn() })
    await c.onStackChange('System')
    expect(tun.enable).toHaveBeenCalledWith('System')
  })

  it('desktop: changing the stack while TUN is OFF does not re-enable (no privileged prompt)', async () => {
    status.value = { enabled: false, mode: 'sidecar' }
    const c = useTunConfig({ patch: vi.fn() })
    await c.onStackChange('System')
    expect(tun.enable).not.toHaveBeenCalled()
  })

  it('desktop: recover-network forces useTun.disable() (emergency back to sidecar)', async () => {
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    const c = useTunConfig({ patch: vi.fn() })
    await c.onRecoverNetwork()
    expect(tun.disable).toHaveBeenCalledOnce()
  })

  it('desktop: recover-network button shows only in tun mode', () => {
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.showRecoverButton.value).toBe(false)
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    expect(c.showRecoverButton.value).toBe(true)
  })

  it('desktop: uninstall forces useTun.uninstall() (remove the helper service)', async () => {
    const c = useTunConfig({ patch: vi.fn() })
    await c.onUninstall()
    expect(tun.uninstall).toHaveBeenCalledOnce()
  })

  it('desktop: the uninstall button shows regardless of mode (helper may be installed)', () => {
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.showUninstallButton.value).toBe(true)
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    expect(c.showUninstallButton.value).toBe(true)
  })

  it('desktop: the install/elevation note shows before first enable (sidecar mode)', () => {
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.showInstallNote.value).toBe(true)
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    expect(c.showInstallNote.value).toBe(false)
  })

  it('desktop: exposes the live status + busy from useTun', () => {
    status.value = { enabled: true, mode: 'tun', stack: 'System' }
    busy.value = true
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.enabled.value).toBe(true)
    expect(c.stack.value).toBe('System')
    expect(c.busy.value).toBe(true)
  })

  it('desktop: loads the current tun status on init() (only when available)', () => {
    const c = useTunConfig({ patch: vi.fn() })
    c.init()
    expect(tun.load).toHaveBeenCalledOnce()
  })

  // --- ENABLE GATE: no base profile -> nothing to inject the tun block into ---

  it('desktop: needsProfile is true once the probe settles with zero base profiles', () => {
    profileHasBase.value = false
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.needsProfile.value).toBe(true)
  })

  it('desktop: needsProfile stays false while the profile probe is still settling (optimistic)', () => {
    profileReady.value = false
    profileHasBase.value = false
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.needsProfile.value).toBe(false)
  })

  it('desktop: needsProfile is false when a base profile exists', () => {
    profileHasBase.value = true
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.needsProfile.value).toBe(false)
  })

  it('desktop: toggling ON is a no-op (no enable call) when no base profile exists', async () => {
    profileHasBase.value = false
    const c = useTunConfig({ patch: vi.fn() })
    await c.onToggle(true, 'gVisor')
    expect(tun.enable).not.toHaveBeenCalled()
  })

  it('desktop: toggling OFF still disables even with no base profile (recover escape)', async () => {
    profileHasBase.value = false
    status.value = { enabled: true, mode: 'tun', stack: 'gVisor' }
    const c = useTunConfig({ patch: vi.fn() })
    await c.onToggle(false)
    expect(tun.disable).toHaveBeenCalledOnce()
  })

  it('remote: never gates on a profile (no agent profiles concept)', () => {
    available = false
    profileReady.value = true
    profileHasBase.value = false
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.needsProfile.value).toBe(false)
  })

  // --- REMOTE BACKEND (capability absent): keep the Clash-API PATCH path ---

  it('remote: toggling routes through the Clash-API patch — NOT useTun', async () => {
    available = false
    const patch = vi.fn()
    const c = useTunConfig({ patch })
    await c.onToggle(true, 'gVisor')
    expect(patch).toHaveBeenCalledWith({ enable: true })
    expect(tun.enable).not.toHaveBeenCalled()
    expect(tun.disable).not.toHaveBeenCalled()
  })

  it('remote: changing the stack routes through the Clash-API patch', async () => {
    available = false
    const patch = vi.fn()
    const c = useTunConfig({ patch })
    await c.onStackChange('Mips')
    expect(patch).toHaveBeenCalledWith({ stack: 'Mips' })
    expect(tun.enable).not.toHaveBeenCalled()
  })

  it('remote: a saved stack change resolves true without a toast', async () => {
    available = false
    const c = useTunConfig({ patch: vi.fn().mockResolvedValue(undefined) })
    await expect(c.onStackChange('gVisor')).resolves.toBe(true)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('remote: a refused stack change surfaces the error and resolves false', async () => {
    available = false
    const patch = vi.fn().mockRejectedValue(new Error('invalid tun stack'))
    const c = useTunConfig({ patch })
    await expect(c.onStackChange('Mips')).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith('tunSaveFailed', {
      description: 'invalid tun stack',
    })
  })

  it('remote: a refused toggle surfaces the error and resolves false', async () => {
    available = false
    const patch = vi.fn().mockRejectedValue(new Error('Bad Request'))
    const c = useTunConfig({ patch })
    await expect(c.onToggle(true, 'gVisor')).resolves.toBe(false)
    expect(toast.error).toHaveBeenCalledWith('tunSaveFailed', {
      description: 'Bad Request',
    })
  })

  it('remote: never shows the recover-network/uninstall buttons or the install note', () => {
    available = false
    const c = useTunConfig({ patch: vi.fn() })
    expect(c.showRecoverButton.value).toBe(false)
    expect(c.showInstallNote.value).toBe(false)
    expect(c.showUninstallButton.value).toBe(false)
  })

  it('remote: init() does not load tun status (no agent)', () => {
    available = false
    const c = useTunConfig({ patch: vi.fn() })
    c.init()
    expect(tun.load).not.toHaveBeenCalled()
  })
})

describe('tun stack options', () => {
  it('offers only stacks mihomo accepts (no lwIP)', () => {
    expect(TUN_STACKS).toEqual(['Mixed', 'gVisor', 'System', 'Mips'])
    expect(TUN_STACKS.map((s) => s.toLowerCase())).not.toContain('lwip')
  })

  it('matches the reported stack case-insensitively', () => {
    expect(normalizeTunStack('Mips')).toBe('Mips')
    expect(normalizeTunStack('mips')).toBe('Mips')
    expect(normalizeTunStack('gvisor')).toBe('gVisor')
    expect(normalizeTunStack('SYSTEM')).toBe('System')
  })

  it('falls back to Mixed when no stack is reported', () => {
    expect(normalizeTunStack(undefined)).toBe('Mixed')
    expect(normalizeTunStack('')).toBe('Mixed')
  })

  it('keeps an unknown stack visible as an extra option', () => {
    expect(normalizeTunStack('future')).toBe('future')
    expect(tunStackOptions('future')).toEqual([...TUN_STACKS, 'future'])
    expect(tunStackOptions('gVisor')).toEqual(TUN_STACKS)
  })
})
