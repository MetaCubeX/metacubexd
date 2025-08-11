import { usePrefersDark } from '@solid-primitives/media'
import type { ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Header } from '~/components'
import {
  WsMsg,
  autoSwitchTheme,
  curTheme,
  endpoint,
  favDayTheme,
  favNightTheme,
  fontFamily,
  setCurTheme,
  setLatestConnectionMsg,
  setRootElement,
  useWsRequest,
} from '~/signals'

const ProtectedResources = () => {
  const latestConnectionMsg = useWsRequest<WsMsg>('connections')

  createEffect(() => setLatestConnectionMsg(latestConnectionMsg()))

  return null
}

export const App: ParentComponent = ({ children }) => {
  const prefersDark = usePrefersDark()

  createEffect(() => {
    if (autoSwitchTheme())
      setCurTheme(prefersDark() ? favNightTheme() : favDayTheme())
  })

  return (
    <div
      ref={(el) => setRootElement(el)}
      class={twMerge(
        'relative flex h-screen flex-col overscroll-y-none bg-base-100 subpixel-antialiased',
        fontFamily(),
      )}
      data-theme={curTheme()}
    >
      <Header />

      <div class="flex-1 overflow-y-auto p-2 sm:p-4">{children}</div>

      <Show when={!!endpoint()}>
        <ProtectedResources />
      </Show>
    </div>
  )
}
