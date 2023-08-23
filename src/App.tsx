import { Route, Routes, useLocation, useNavigate } from '@solidjs/router'
import { For, Show, onMount } from 'solid-js'
import { Header } from '~/components/Header'
import { themes } from '~/constants'
import { Config } from '~/pages/Config'
import { Connections } from '~/pages/Connections'
import { Logs } from '~/pages/Logs'
import { Overview } from '~/pages/Overview'
import { Proxies } from '~/pages/Proxies'
import { Rules } from '~/pages/Rules'
import { Setup } from '~/pages/Setup'
import { curTheme, selectedEndpoint, setCurTheme } from '~/signals'

export const App = () => {
  const location = useLocation()
  const navigate = useNavigate()

  onMount(() => {
    if (!selectedEndpoint()) {
      navigate('/setup')
    }
  })

  return (
    <div class="app relative" data-theme={curTheme()}>
      <div class="sticky inset-x-0 top-0 z-50 flex items-center rounded-md bg-base-200 px-4 py-2">
        <Show when={location.pathname !== '/setup'}>
          <Header />
        </Show>

        <div class="dropdown-end dropdown-hover dropdown ml-auto">
          <label tabindex="0" class="btn btn-sm m-2 uppercase">
            Themes
          </label>

          <ul
            tabindex="0"
            class="menu dropdown-content rounded-box z-[1] gap-2 bg-base-300 p-2 shadow"
          >
            <For each={themes}>
              {(theme) => (
                <li
                  data-theme={theme}
                  class="btn btn-xs"
                  onClick={() => setCurTheme(theme)}
                >
                  {theme}
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>

      <div class="py-4">
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
    </div>
  )
}
