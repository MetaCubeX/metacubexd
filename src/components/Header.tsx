import { A, useLocation, useNavigate } from '@solidjs/router'
import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconNetworkOff,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import { For, Show } from 'solid-js'
import { themes } from '~/constants'
import { setCurTheme, setSelectedEndpoint } from '~/signals'

export const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div class="sticky inset-x-0 top-0 z-10 flex items-center rounded-md bg-base-200 px-4 py-2">
      <Show when={location.pathname !== '/setup'}>
        <ul class="menu rounded-box menu-horizontal">
          <li>
            <A class="tooltip tooltip-bottom" href="/" data-tip="Home">
              <IconHome />
            </A>
          </li>

          <li>
            <A
              class="tooltip tooltip-bottom"
              href="/proxies"
              data-tip="Proxies"
            >
              <IconGlobe />
            </A>
          </li>

          <li>
            <A class="tooltip tooltip-bottom" href="/rules" data-tip="Rules">
              <IconRuler />
            </A>
          </li>

          <li>
            <A
              class="tooltip tooltip-bottom"
              href="/conns"
              data-tip="Connections"
            >
              <IconNetwork />
            </A>
          </li>

          <li>
            <A class="tooltip tooltip-bottom" href="/logs" data-tip="Logs">
              <IconFileStack />
            </A>
          </li>

          <li>
            <A class="tooltip tooltip-bottom" href="/config" data-tip="Config">
              <IconSettings />
            </A>
          </li>

          <li>
            <button
              class="tooltip tooltip-bottom"
              data-tip="Switch Endpoint"
              onClick={() => {
                setSelectedEndpoint('')

                navigate('/setup')
              }}
            >
              <IconNetworkOff />
            </button>
          </li>
        </ul>
      </Show>

      <div class="drawer drawer-end ml-auto w-auto">
        <input id="themes" type="checkbox" class="drawer-toggle" />

        <div class="drawer-content">
          <label for="themes" class="btn drawer-button btn-sm m-2 uppercase">
            Themes
          </label>
        </div>

        <div class="drawer-side">
          <label for="themes" class="drawer-overlay" />

          <ul class="menu rounded-box z-50 gap-2 bg-base-300 p-2 shadow">
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
    </div>
  )
}
