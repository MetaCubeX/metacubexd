import { Navigate, Route, Routes, useNavigate } from '@solidjs/router'
import { Show, lazy, onMount } from 'solid-js'
import { Header } from '~/components/Header'
import { curTheme, selectedEndpoint } from '~/signals'
import { ROUTE } from './config/enum'

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

  onMount(async () => {
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

      <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4">
        <Routes>
          <Show when={selectedEndpoint()}>
            <Route path={ROUTE.Overview} component={Overview} />
            <Route path={ROUTE.Proxies} component={Proxies} />
            <Route path={ROUTE.Proxyprovider} component={ProxyProvider} />
            <Route path={ROUTE.Rules} component={Rules} />
            <Route path={ROUTE.Conns} component={Connections} />
            <Route path={ROUTE.Log} component={Logs} />
            <Route path={ROUTE.Config} component={Config} />
            <Route path="*" element={<Navigate href={ROUTE.Overview} />} />
          </Show>

          <Route path="/setup" component={Setup} />
        </Routes>
      </div>
    </div>
  )
}
