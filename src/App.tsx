import { usePrefersDark } from '@solid-primitives/media'
import type { ParentComponent } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { v4 as uuid } from 'uuid'
import { Header } from '~/components'
import {
  WsMsg,
  autoSwitchTheme,
  curTheme,
  endpoint,
  favDayTheme,
  favNightTheme,
  setCurTheme,
  setLatestConnectionMsg,
  useTwemoji,
  useWsRequest,
  //
  setEndpointList,
  setSelectedEndpoint,
} from '~/signals'

const ProtectedResources = () => {
  const latestConnectionMsg = useWsRequest<WsMsg>('connections')

  createEffect(() => setLatestConnectionMsg(latestConnectionMsg()))

  return null
}

export const App: ParentComponent = ({ children }) => {
  const prefersDark = usePrefersDark()

  //
  try {
    const [searchParams, _] = useSearchParams();
    const url = searchParams.url
    if (url) {
      const u = new URL(decodeURIComponent(url))
      const apiSecret = u.username
      u.username = ''
      const apiURL = u.toString()

      const id = uuid()
      setEndpointList([{ id, url: apiURL, secret: apiSecret }])
      setSelectedEndpoint(id)
      const navigate = useNavigate()
      navigate('/overview')

      console.log('config from URL: url', apiURL, ', secret: ', apiSecret)
    }
  } catch(_) {}
  //

  createEffect(() => {
    if (autoSwitchTheme())
      setCurTheme(prefersDark() ? favNightTheme() : favDayTheme())
  })

  return (
    <div
      class={twMerge(
        'relative flex h-screen flex-col overscroll-y-none subpixel-antialiased',
        useTwemoji() ? 'font-twemoji' : 'font-no-twemoji',
      )}
      data-theme={curTheme()}
    >
      <Header />

      <div class="flex-1 overflow-y-auto p-2 sm:p-4">
        <div class="pb-8">{children}</div>
      </div>

      <Show when={endpoint()}>
        <ProtectedResources />
      </Show>
    </div>
  )
}
