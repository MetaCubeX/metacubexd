import { usePrefersDark } from '@solid-primitives/media'
import type { ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Header } from '~/components'
import { ROUTES } from '~/constants'
import {
  autoSwitchEndpoint,
  MemoryData,
  TrafficData,
  WsMsg,
  autoSwitchTheme,
  curTheme,
  endpoint,
  favDayTheme,
  favNightTheme,
  fontFamily,
  isMockMode,
  setCurTheme,
  setLatestConnectionMsg,
  setLatestMemory,
  setLatestTraffic,
  setRootElement,
  tryAutoSwitchEndpoint,
  useWsRequest,
} from '~/signals'

// Connection health check timeout in milliseconds
const AUTO_SWITCH_TIMEOUT_MS = 10000
const AUTO_SWITCH_CHECK_INTERVAL_MS = 5000
// Minimum time between auto-switch reloads to prevent loops (in milliseconds)
const AUTO_SWITCH_RELOAD_COOLDOWN_MS = 30000
const AUTO_SWITCH_RELOAD_KEY = 'metacubexd_last_auto_switch_reload'

// Check if we can safely reload (prevent rapid reload loops)
const canAutoSwitchReload = (): boolean => {
  try {
    const lastReload = sessionStorage.getItem(AUTO_SWITCH_RELOAD_KEY)

    if (lastReload) {
      const timeSinceLastReload = Date.now() - parseInt(lastReload, 10)

      if (timeSinceLastReload < AUTO_SWITCH_RELOAD_COOLDOWN_MS) {
        console.log(
          `[Auto Switch] Reload blocked: only ${timeSinceLastReload}ms since last reload (cooldown: ${AUTO_SWITCH_RELOAD_COOLDOWN_MS}ms)`,
        )

        return false
      }
    }

    return true
  } catch {
    // If sessionStorage is not available, allow reload but log warning
    console.warn('[Auto Switch] sessionStorage not available, allowing reload')

    return true
  }
}

// Record reload timestamp to prevent loops
const recordAutoSwitchReload = () => {
  try {
    sessionStorage.setItem(AUTO_SWITCH_RELOAD_KEY, Date.now().toString())
  } catch {
    // Ignore storage errors
  }
}

const ProtectedResources = () => {
  const latestConnectionMsg = useWsRequest<WsMsg>('connections')
  const traffic = useWsRequest<TrafficData>('traffic')
  const memory = useWsRequest<MemoryData>('memory')

  // Track when we last received data using a ref-like pattern
  const lastDataReceivedTime = { current: Date.now() }
  const autoSwitchCheckInterval = {
    current: null as ReturnType<typeof setInterval> | null,
  }

  // Reset the timer when we receive data
  const resetDataTimer = () => {
    lastDataReceivedTime.current = Date.now()
  }

  // Check connection health and trigger auto-switch if needed
  const checkConnectionHealth = async () => {
    if (!autoSwitchEndpoint()) return

    const timeSinceLastData = Date.now() - lastDataReceivedTime.current

    if (timeSinceLastData > AUTO_SWITCH_TIMEOUT_MS) {
      console.log(
        '[Auto Switch] Connection timeout detected, attempting to switch endpoint...',
      )
      const switched = await tryAutoSwitchEndpoint()

      if (switched && canAutoSwitchReload()) {
        // Reset timer after switching
        lastDataReceivedTime.current = Date.now()
        // Record reload timestamp to prevent loops
        recordAutoSwitchReload()
        // Reload page to reconnect with new endpoint
        window.location.reload()
      }
    }
  }

  // Consolidated effect to track data reception from all WebSocket sources
  createEffect(() => {
    const msg = latestConnectionMsg()
    const t = traffic()
    const m = memory()

    if (msg || t || m) {
      resetDataTimer()
    }
  })

  createEffect(() => setLatestConnectionMsg(latestConnectionMsg()))
  createEffect(() => setLatestTraffic(traffic()))
  createEffect(() => setLatestMemory(memory()))

  // Set up periodic health check
  onMount(() => {
    autoSwitchCheckInterval.current = setInterval(
      checkConnectionHealth,
      AUTO_SWITCH_CHECK_INTERVAL_MS,
    )
  })

  onCleanup(() => {
    if (autoSwitchCheckInterval.current) {
      clearInterval(autoSwitchCheckInterval.current)
    }
  })

  return null
}

export const App: ParentComponent = ({ children }) => {
  const location = useLocation()
  const prefersDark = usePrefersDark()

  createEffect(() => {
    if (autoSwitchTheme())
      setCurTheme(prefersDark() ? favNightTheme() : favDayTheme())
  })

  // Sync theme to document.documentElement for CSS variables to work
  createEffect(() => {
    document.documentElement.setAttribute('data-theme', curTheme())
  })

  // Route guard: redirect to setup if no endpoint configured (skip in mock mode)
  const isSetupPage = () => location.pathname === ROUTES.Setup
  const needsRedirect = () => !isMockMode() && !endpoint() && !isSetupPage()

  return (
    <div
      ref={(el) => setRootElement(el)}
      class={twMerge(
        'relative flex h-screen flex-col overscroll-y-none bg-base-100 subpixel-antialiased',
        fontFamily(),
      )}
    >
      <Header />

      <div class="flex-1 overflow-y-auto p-2 sm:p-4">
        <Show
          when={!needsRedirect()}
          fallback={<Navigate href={ROUTES.Setup} />}
        >
          {children}
        </Show>
      </div>

      <Show when={!!endpoint() || isMockMode()}>
        <ProtectedResources />
      </Show>
    </div>
  )
}
