/* @refresh reload */
import '~/index.css'

import { MetaProvider } from '@solidjs/meta'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import { lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Toaster } from 'solid-toast'
import { App } from '~/App'
import { ROUTES } from '~/constants'
import { I18nProvider, locale } from '~/i18n'

const Setup = lazy(() => import('~/pages/Setup'))
const Overview = lazy(() => import('~/pages/Overview'))
const Connections = lazy(() => import('~/pages/Connections'))
const Logs = lazy(() => import('~/pages/Logs'))
const Proxies = lazy(() => import('~/pages/Proxies'))
const Rules = lazy(() => import('~/pages/Rules'))
const Config = lazy(() => import('~/pages/Config'))

dayjs.extend(relativeTime)

render(
  () => (
    <I18nProvider locale={locale()}>
      <MetaProvider>
        <HashRouter root={App}>
          <Route path={ROUTES.Setup} component={Setup} />
          <Route path="*" component={Overview} />
          <Route path={ROUTES.Overview} component={Overview} />
          <Route path={ROUTES.Proxies} component={Proxies} />
          <Route path={ROUTES.Rules} component={Rules} />
          <Route path={ROUTES.Conns} component={Connections} />
          <Route path={ROUTES.Log} component={Logs} />
          <Route path={ROUTES.Config} component={Config} />
        </HashRouter>
      </MetaProvider>

      <Toaster position="bottom-center" />
    </I18nProvider>
  ),
  document.querySelector('#root')!,
)
