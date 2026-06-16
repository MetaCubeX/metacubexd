// packages/ui/composables/__tests__/useTunConfig.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTunConfig } from '../useTunConfig'

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

describe('composables/useTunConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    available = true
    status.value = { enabled: false, mode: 'sidecar' }
    busy.value = false
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
    await c.onStackChange('LWIP')
    expect(patch).toHaveBeenCalledWith({ stack: 'LWIP' })
    expect(tun.enable).not.toHaveBeenCalled()
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
