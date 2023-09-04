import { Navigate, Route, Routes, useNavigate } from '@solidjs/router'
import { Show, createEffect, lazy, onMount } from 'solid-js'
import { Header } from '~/components'
import { ROUTES } from '~/constants'
import {
  curTheme,
  endpoint,
  renderProxiesInSamePage,
  selectedEndpoint,
  useAutoSwitchTheme,
  useProxies,
} from '~/signals'

const Setup = lazy(() => import('~/pages/Setup'))
const Overview = lazy(() => import('~/pages/Overview'))
const Connections = lazy(() => import('~/pages/Connections'))
const Logs = lazy(() => import('~/pages/Logs'))
const Proxies = lazy(() => import('~/pages/Proxies'))
const ProxyProvider = lazy(() => import('~/pages/ProxyProvider'))
const Rules = lazy(() => import('~/pages/Rules'))
const Config = lazy(() => import('~/pages/Config'))

export const App = () => {
  const navigate = useNavigate()

  useAutoSwitchTheme()

  createEffect(() => {
    if (selectedEndpoint() && endpoint()) {
      void useProxies().updateProxies()
    }
  })

  onMount(() => {
    if (!selectedEndpoint()) {
      navigate(ROUTES.Setup)
    }
  })

  return (
    <div
      class="relative flex h-screen flex-col subpixel-antialiased p-safe"
      data-theme={curTheme()}
    >
      <Header />

      <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
        <Routes>
          <Show when={selectedEndpoint()}>
            <Route path={ROUTES.Overview} component={Overview} />
            <Route path={ROUTES.Proxies} component={Proxies} />
            <Show when={!renderProxiesInSamePage()}>
              <Route path={ROUTES.ProxyProvider} component={ProxyProvider} />
            </Show>
            <Route path={ROUTES.Rules} component={Rules} />
            <Route path={ROUTES.Conns} component={Connections} />
            <Route path={ROUTES.Log} component={Logs} />
            <Route path={ROUTES.Config} component={Config} />
            <Route path="*" element={<Navigate href={ROUTES.Overview} />} />
          </Show>

          <Route
            path={selectedEndpoint() ? ROUTES.Setup : '*'}
            component={Setup}
          />
        </Routes>
      </div>
    </div>
  )
}
