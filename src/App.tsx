import { Route, Routes, useNavigate } from '@solidjs/router'
import { Show, onMount } from 'solid-js'
import { Header } from '~/components/Header'
import { Config } from '~/pages/Config'
import { Connections } from '~/pages/Connections'
import { Logs } from '~/pages/Logs'
import { Overview } from '~/pages/Overview'
import { Proxies } from '~/pages/Proxies'
import { Rules } from '~/pages/Rules'
import { Setup } from '~/pages/Setup'
import { curTheme, selectedEndpoint } from '~/signals'

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
            <Route path="/" component={Overview} />
            <Route path="/proxies" component={Proxies} />
            <Route path="/rules" component={Rules} />
            <Route path="/conns" component={Connections} />
            <Route path="/logs" component={Logs} />
            <Route path="/config" component={Config} />
          </Show>

          <Route path="/setup" component={Setup} />
        </Routes>
      </div>

      <footer class="footer footer-center hidden rounded bg-base-200 p-2 text-base-content sm:block">
        <a href="https://github.com/metacubex/metacubexd" target="_blank">
          metacubexd
        </a>
      </footer>
    </div>
  )
}
