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
  setCurTheme,
  setLatestConnectionMsg,
  setLatestMemory,
  setLatestTraffic,
  setRootElement,
  tryAutoSwitchEndpoint,
  useWsRequest,
} from '~/signals'

const ProtectedResources = () => {
  const latestConnectionMsg = useWsRequest<WsMsg>('connections')
  const traffic = useWsRequest<TrafficData>('traffic')
  const memory = useWsRequest<MemoryData>('memory')

  // Track when we last received data
  let lastDataReceivedTime = Date.now()
  let autoSwitchCheckInterval: ReturnType<typeof setInterval> | null = null

  // Reset the timer when we receive data
  const resetDataTimer = () => {
    lastDataReceivedTime = Date.now()
  }

  // Check connection health and trigger auto-switch if needed
  const checkConnectionHealth = async () => {
    if (!autoSwitchEndpoint()) return

    const timeSinceLastData = Date.now() - lastDataReceivedTime
    // If no data received for 10 seconds, try to switch endpoint
    const timeout = 10000

    if (timeSinceLastData > timeout) {
      console.log(
        '[Auto Switch] Connection timeout detected, attempting to switch endpoint...',
      )
      const switched = await tryAutoSwitchEndpoint()

      if (switched) {
        // Reset timer after switching
        lastDataReceivedTime = Date.now()
        // Reload page to reconnect with new endpoint
        window.location.reload()
      }
    }
  }

  createEffect(() => {
    const msg = latestConnectionMsg()

    if (msg) {
      resetDataTimer()
    }
  })

  createEffect(() => {
    const t = traffic()

    if (t) {
      resetDataTimer()
    }
  })

  createEffect(() => {
    const m = memory()

    if (m) {
      resetDataTimer()
    }
  })

  createEffect(() => setLatestConnectionMsg(latestConnectionMsg()))
  createEffect(() => setLatestTraffic(traffic()))
  createEffect(() => setLatestMemory(memory()))

  // Set up periodic health check
  onMount(() => {
    autoSwitchCheckInterval = setInterval(checkConnectionHealth, 5000)
  })

  onCleanup(() => {
    if (autoSwitchCheckInterval) {
      clearInterval(autoSwitchCheckInterval)
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

  // Route guard: redirect to setup if no endpoint configured
  const isSetupPage = () => location.pathname === ROUTES.Setup
  const needsRedirect = () => !endpoint() && !isSetupPage()

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

      <Show when={!!endpoint()}>
        <ProtectedResources />
      </Show>
    </div>
  )
}
