import { A, useNavigate } from '@solidjs/router'
import {
  IconFileStack,
  IconGlobe,
  IconHome,
  IconNetwork,
  IconNetworkOff,
  IconRuler,
  IconSettings,
} from '@tabler/icons-solidjs'
import { setSelectedEndpoint } from '~/signals'

export const Header = () => {
  const navigate = useNavigate()

  return (
    <ul class="menu rounded-box menu-horizontal">
      <li>
        <A class="tooltip tooltip-bottom" href="/" data-tip="Home">
          <IconHome />
        </A>
      </li>

      <li>
        <A class="tooltip tooltip-bottom" href="/proxies" data-tip="Proxies">
          <IconGlobe />
        </A>
      </li>

      <li>
        <A class="tooltip tooltip-bottom" href="/rules" data-tip="Rules">
          <IconRuler />
        </A>
      </li>

      <li>
        <A class="tooltip tooltip-bottom" href="/conns" data-tip="Connections">
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
  )
}
