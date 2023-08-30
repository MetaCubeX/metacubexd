import { Route, Routes, useNavigate } from '@solidjs/router'
import { Show, lazy, onMount } from 'solid-js'
import { Header } from '~/components/Header'
import { curTheme, selectedEndpoint } from '~/signals'

const Setup = lazy(() => import('~/pages/Setup'))
const Overview = lazy(() => import('~/pages/Overview'))
const Connections = lazy(() => import('~/pages/Connections'))
const Logs = lazy(() => import('~/pages/Logs'))
const Proxies = lazy(() => import('~/pages/Proxies'))
const Rules = lazy(() => import('~/pages/Rules'))
const Config = lazy(() => import('~/pages/Config'))

export const App = () => {
  const navigate = useNavigate()

  onMount(() => {
    if (!selectedEndpoint()) {
      navigate('/setup')
    }
  })

  return (
    <div
      class="relative flex h-screen flex-col subpixel-antialiased"
      data-theme={curTheme()}
    >
      <Header />

      <div class="flex-1 overflow-y-auto p-4">
        <Routes>
          <Show when={selectedEndpoint()}>
            <Route path="/proxies" component={Proxies} />
            <Route path="/rules" component={Rules} />
            <Route path="/conns" component={Connections} />
            <Route path="/logs" component={Logs} />
            <Route path="/config" component={Config} />
            <Route path="*" component={Overview} />
          </Show>

          <Route path="/setup" component={Setup} />
        </Routes>
      </div>
    </div>
  )
}
