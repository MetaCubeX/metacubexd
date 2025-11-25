import { usePrefersDark } from '@solid-primitives/media'
import type { ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Header } from '~/components'
import { ROUTES } from '~/constants'
import {
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
  useWsRequest,
} from '~/signals'

const ProtectedResources = () => {
  const latestConnectionMsg = useWsRequest<WsMsg>('connections')
  const traffic = useWsRequest<TrafficData>('traffic')
  const memory = useWsRequest<MemoryData>('memory')

  createEffect(() => setLatestConnectionMsg(latestConnectionMsg()))
  createEffect(() => setLatestTraffic(traffic()))
  createEffect(() => setLatestMemory(memory()))

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
