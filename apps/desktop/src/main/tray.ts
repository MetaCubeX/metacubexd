import type { ProxyMode } from './clash-config'
import type { LoginItemController } from './login-item'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Menu, nativeImage, Tray } from 'electron'
import { getProxyMode, setProxyMode } from './clash-config'

export type { ProxyMode }

const MODE_ITEMS: { label: string; mode: ProxyMode }[] = [
  { label: 'Rule', mode: 'rule' },
  { label: 'Global', mode: 'global' },
  { label: 'Direct', mode: 'direct' },
]

/** The kernel-state slice the tray renders (status line + item enablement). */
export interface TrayKernelState {
  status: string
  version?: string
}

export interface TrayDeps {
  /** Summon + focus the main window (recreating it when destroyed). */
  showWindow: () => void
  startKernel: () => void
  stopKernel: () => void
  restartKernel: () => void
  quit: () => void
  /** Absolute path to a tray icon PNG (see {@link trayIconPath}). */
  iconPath: string
  /** Clash API endpoint used to read/switch the proxy mode. */
  clash: { url: string; secret: string }
  /**
   * OS system-proxy controller (injected from boot()). When absent the tray
   * omits the "System Proxy" checkbox entirely. Narrowed from the agent's
   * SystemProxyController to just what the tray toggle needs.
   */
  systemProxy?: {
    isEnabled: () => Promise<boolean>
    enable: () => Promise<void>
    disable: () => Promise<void>
  }
  /**
   * TUN controller slice (injected from boot()). When absent the tray omits the
   * "TUN Mode" checkbox. enable() may pop an elevation prompt + restart the
   * kernel — acceptable on an explicit user click, never invoked otherwise.
   */
  tun?: {
    status: () => Promise<{ enabled: boolean }>
    enable: () => Promise<void>
    disable: () => Promise<void>
  }
  /**
   * Profile store slice (injected from boot()). Renders a "Profiles" submenu of
   * radio items mirroring the active profile; clicking one activates it (the
   * injected activate owns the kernel restart + failure notification). Absent →
   * submenu omitted.
   */
  profiles?: {
    list: () => Promise<{ id: string; name: string }[]>
    activeId: () => Promise<string | undefined>
    activate: (id: string) => Promise<void>
  }
  /**
   * Read the live kernel state synchronously (supervisor.getState). Renders the
   * informational status line and drives Start/Stop/Restart enablement. When
   * absent the status line is omitted and every action stays enabled.
   */
  getKernelState?: () => TrayKernelState
  /**
   * Subscribe the given callback to kernel-state changes (supervisor 'state'
   * events) so the status line stays fresh without polling. Optional; without
   * it the line refreshes only on tray-driven rebuilds.
   */
  onKernelState?: (cb: () => void) => void
  /** Copy the terminal proxy env command to the clipboard (see proxy-env.ts). */
  copyProxyCommand?: () => void
  /** Cross-platform "open at login" controller (see login-item.ts). */
  loginItem: LoginItemController
  /** Injectable fetch for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

/** Capitalize a kernel status for the informational line. */
function statusLabel(state: TrayKernelState): string {
  const version = state.version ? ` · ${state.version}` : ''
  return `Kernel: ${state.status}${version}`
}

export function createTray(deps: TrayDeps): Tray {
  const fetchImpl = deps.fetchImpl ?? fetch
  // Last known mode; cached so a failed/slow GET leaves the previous selection
  // instead of flickering to an unchecked state.
  let currentMode: ProxyMode | null = null
  // Last known system-proxy enabled state; cached so a slow/failed isEnabled()
  // leaves the previous checkbox state instead of flickering to unchecked.
  let sysProxyEnabled = false
  // Last known TUN state; cached for the same no-flicker reason.
  let tunEnabled = false
  // Last known profile list + active id; cached so the submenu renders
  // instantly from the previous state while the async refresh runs.
  let profileList: { id: string; name: string }[] = []
  let activeProfileId: string | undefined
  const image = nativeImage.createFromPath(deps.iconPath)
  // On macOS the icon is a monochrome template the system tints to match the
  // light/dark menu bar; other platforms render the white wireframe as-is.
  if (process.platform === 'darwin' && !image.isEmpty()) {
    image.setTemplateImage(true)
  }
  const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)

  // Switch the active proxy mode through the shared bounded `/configs` client,
  // then refresh the menu so the new selection is reflected. Best-effort:
  // setProxyMode resolves false (never throws) on a wedged kernel, leaving the
  // previous selection.
  const switchMode = async (mode: ProxyMode) => {
    if (await setProxyMode(fetchImpl, deps.clash, mode)) {
      currentMode = mode
      rebuild()
    }
  }

  // Read the current mode through the shared client and rebuild so the matching
  // radio item is checked. getProxyMode resolves null on any failure, keeping
  // the cached/previous selection.
  const refreshMode = () => {
    void (async () => {
      const mode = await getProxyMode(fetchImpl, deps.clash)
      if (mode && mode !== currentMode) {
        currentMode = mode
        rebuild()
      }
    })()
  }

  // Read the system-proxy state and rebuild if the cached value is stale, so the
  // checkbox reflects reality without blocking the first paint. Best-effort.
  const refreshSysProxy = () => {
    if (!deps.systemProxy) return
    const sysProxy = deps.systemProxy
    void (async () => {
      try {
        const enabled = await sysProxy.isEnabled()
        if (enabled !== sysProxyEnabled) {
          sysProxyEnabled = enabled
          rebuild()
        }
      } catch {
        /* best-effort; keep cached/previous state */
      }
    })()
  }

  // Same background refresh for the TUN checkbox.
  const refreshTun = () => {
    if (!deps.tun) return
    const tun = deps.tun
    void (async () => {
      try {
        const { enabled } = await tun.status()
        if (enabled !== tunEnabled) {
          tunEnabled = enabled
          rebuild()
        }
      } catch {
        /* best-effort; keep cached/previous state */
      }
    })()
  }

  // Background refresh of the profile list + active selection.
  const refreshProfiles = () => {
    if (!deps.profiles) return
    const profiles = deps.profiles
    void (async () => {
      try {
        const [list, active] = await Promise.all([
          profiles.list(),
          profiles.activeId(),
        ])
        const changed =
          active !== activeProfileId ||
          list.length !== profileList.length ||
          list.some(
            (p, i) =>
              p.id !== profileList[i]?.id || p.name !== profileList[i]?.name,
          )
        if (changed) {
          profileList = list
          activeProfileId = active
          rebuild()
        }
      } catch {
        /* best-effort; keep cached/previous state */
      }
    })()
  }

  // Switch the active profile; the injected activate owns the restart + error
  // notification. Optimistically mark the selection so the reopened menu shows
  // it immediately; the background refresh corrects a failed switch.
  const switchProfile = async (id: string) => {
    const profiles = deps.profiles
    if (!profiles || id === activeProfileId) return
    try {
      await profiles.activate(id)
      activeProfileId = id
    } catch {
      /* the injected activate notifies; refreshProfiles re-syncs */
    }
    rebuild()
  }

  // Toggle the OS system proxy (enable when off, disable when on), then refresh
  // the cached state + menu. Failures are swallowed (best-effort).
  const toggleSysProxy = async () => {
    const sysProxy = deps.systemProxy
    if (!sysProxy) return
    try {
      if (sysProxyEnabled) {
        await sysProxy.disable()
        sysProxyEnabled = false
      } else {
        await sysProxy.enable()
        sysProxyEnabled = true
      }
      rebuild()
    } catch {
      /* best-effort; leave previous state */
    }
  }

  // Toggle TUN mode. Slow (elevation + kernel relaunch), so the checkbox only
  // flips once the controller settles; a failure rebuilds so the background
  // refresh re-syncs the checkbox with reality (the injected controller owns
  // user-facing error notifications).
  const toggleTun = async () => {
    const tun = deps.tun
    if (!tun) return
    try {
      if (tunEnabled) {
        await tun.disable()
        tunEnabled = false
      } else {
        await tun.enable()
        tunEnabled = true
      }
    } catch {
      /* best-effort; refreshTun below re-syncs with reality */
    }
    rebuild()
  }

  const rebuild = () => {
    const kernel = deps.getKernelState?.()
    const status = kernel?.status
    // Item enablement mirrors the live state. Unknown state (no getKernelState)
    // keeps everything enabled — never lock the user out of a recovery action.
    const unknown = status === undefined
    const running = status === 'running'
    const startable = unknown || status === 'stopped' || status === 'errored'
    const stoppable = unknown || status === 'running' || status === 'starting'
    const menu = Menu.buildFromTemplate([
      // Informational status line (disabled, not clickable).
      ...(kernel
        ? ([
            { label: statusLabel(kernel), enabled: false },
            { type: 'separator' },
          ] as const)
        : []),
      {
        label: 'Open Dashboard',
        click: () => deps.showWindow(),
      },
      { type: 'separator' },
      {
        label: 'Start Kernel',
        enabled: startable,
        click: () => deps.startKernel(),
      },
      {
        label: 'Stop Kernel',
        enabled: stoppable,
        click: () => deps.stopKernel(),
      },
      {
        label: 'Restart Kernel',
        enabled: unknown || running,
        click: () => deps.restartKernel(),
      },
      { type: 'separator' },
      // Active-profile switcher — only when a store is injected AND it has
      // profiles (an empty submenu teaches nothing; onboarding lives in the
      // dashboard).
      ...(deps.profiles && profileList.length > 0
        ? ([
            {
              label: 'Profiles',
              submenu: profileList.map((p) => ({
                label: p.name,
                type: 'radio' as const,
                checked: p.id === activeProfileId,
                click: () => void switchProfile(p.id),
              })),
            },
          ] as const)
        : []),
      {
        label: 'Proxy Mode',
        submenu: MODE_ITEMS.map(({ label, mode }) => ({
          label,
          type: 'radio',
          checked: currentMode === mode,
          click: () => void switchMode(mode),
        })),
      },
      // Only rendered when an OS system-proxy controller was injected.
      ...(deps.systemProxy
        ? ([
            {
              label: 'System Proxy',
              type: 'checkbox',
              checked: sysProxyEnabled,
              click: () => void toggleSysProxy(),
            },
          ] as const)
        : []),
      // Only rendered when a TUN controller was injected.
      ...(deps.tun
        ? ([
            {
              label: 'TUN Mode',
              type: 'checkbox',
              checked: tunEnabled,
              click: () => void toggleTun(),
            },
          ] as const)
        : []),
      ...(deps.copyProxyCommand
        ? ([
            { type: 'separator' },
            {
              label: 'Copy Proxy Command',
              click: () => deps.copyProxyCommand?.(),
            },
          ] as const)
        : []),
      { type: 'separator' },
      {
        label: 'Open at Login',
        type: 'checkbox',
        checked: deps.loginItem.isEnabled(),
        click: (item) => {
          deps.loginItem.setEnabled(item.checked)
          rebuild()
        },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => deps.quit() },
    ])
    tray.setContextMenu(menu)
    // Tooltip mirrors the one-line health summary so hovering the tray answers
    // "is it on?" without opening the menu.
    const segments: string[] = []
    if (kernel) segments.push(`kernel ${kernel.status}`)
    if (deps.systemProxy)
      segments.push(sysProxyEnabled ? 'system proxy on' : 'system proxy off')
    if (deps.tun && tunEnabled) segments.push('TUN on')
    tray.setToolTip(
      segments.length ? `MetaCubeXD — ${segments.join(' · ')}` : 'MetaCubeXD',
    )
    // Re-sync the current mode + system-proxy/TUN/profile state in the
    // background (don't block the first paint).
    refreshMode()
    refreshSysProxy()
    refreshTun()
    refreshProfiles()
  }

  rebuild()
  // Keep the status line + enablement fresh as the kernel starts/stops/crashes.
  deps.onKernelState?.(rebuild)
  tray.on('click', () => deps.showWindow())
  return tray
}

/**
 * Resolve the tray icon path relative to the main bundle (out/main →
 * ../../resources). macOS uses a monochrome `trayTemplate.png` the system
 * auto-inverts for light/dark menu bars; other platforms use the white
 * `tray.png` wireframe. The matching `@2x` retina variant loads automatically.
 */
export function trayIconPath(): string {
  const file = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'
  // ESM: no CJS __dirname. Derive from import.meta.url (bundled into
  // out/main/index.js → ../../resources). Function-local so it never collides
  // with the main module's own __dirname after bundling.
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  return join(__dirname, '..', '..', 'resources', file)
}
