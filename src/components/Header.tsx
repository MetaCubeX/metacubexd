import { A, useLocation, useNavigate } from '@solidjs/router'
import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconNetworkOff,
  IconPalette,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import { For, ParentComponent, Show } from 'solid-js'
import { themes } from '~/constants'
import { setCurTheme, setSelectedEndpoint } from '~/signals'

const Nav: ParentComponent<{ href: string; tooltip: string }> = ({
  href,
  tooltip,
  children,
}) => (
  <li>
    <A
      class="tooltiptooltip-bottom rounded-full"
      href={href}
      data-tip={tooltip}
    >
      {children}
    </A>
  </li>
)

export const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <ul class="menu menu-horizontal sticky left-0 top-0 z-10 flex items-center justify-center gap-2 rounded-full bg-base-200 p-2">
      <Show when={location.pathname !== '/setup'}>
        <Nav href="/" tooltip="Overview">
          <IconHome />
        </Nav>

        <Nav href="/proxies" tooltip="Proxies">
          <IconGlobe />
        </Nav>

        <Nav href="/rules" tooltip="Rules">
          <IconRuler />
        </Nav>

        <Nav href="/conns" tooltip="Connections">
          <IconNetwork />
        </Nav>

        <Nav href="/logs" tooltip="Logs">
          <IconFileStack />
        </Nav>

        <Nav href="/config" tooltip="Config">
          <IconSettings />
        </Nav>

        <li>
          <button
            class="tooltip tooltip-bottom rounded-full"
            data-tip="Switch Endpoint"
            onClick={() => {
              setSelectedEndpoint('')

              navigate('/setup')
            }}
          >
            <IconNetworkOff />
          </button>
        </li>
      </Show>

      <div class="drawer drawer-end w-auto sm:ml-auto">
        <input id="themes" type="checkbox" class="drawer-toggle" />

        <div class="drawer-content flex items-center">
          <label
            for="themes"
            class="btn btn-circle btn-primary drawer-button btn-sm"
          >
            <IconPalette />
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
    </ul>
  )
}
