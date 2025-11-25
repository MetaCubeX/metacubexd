/* @refresh reload */
import '~/index.css'

import { MetaProvider } from '@solidjs/meta'
import type { RouteDefinition } from '@solidjs/router'
import { QueryClientProvider } from '@tanstack/solid-query'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import { lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { Toaster } from 'solid-toast'
import { App } from '~/App'
import { ROUTES } from '~/constants'
import { I18nProvider, locale } from '~/i18n'
import { queryClient } from '~/query'

const routes: RouteDefinition[] = [
  { path: ROUTES.Setup, component: lazy(() => import('~/pages/Setup')) },
  { path: ROUTES.Overview, component: lazy(() => import('~/pages/Overview')) },
  { path: ROUTES.Proxies, component: lazy(() => import('~/pages/Proxies')) },
  { path: ROUTES.Rules, component: lazy(() => import('~/pages/Rules')) },
  { path: ROUTES.Conns, component: lazy(() => import('~/pages/Connections')) },
  { path: ROUTES.Log, component: lazy(() => import('~/pages/Logs')) },
  { path: ROUTES.Config, component: lazy(() => import('~/pages/Config')) },
  // Fallback to overview for unknown routes
  { path: '*', component: lazy(() => import('~/pages/Overview')) },
]

dayjs.extend(relativeTime)

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale()}>
        <MetaProvider>
          <HashRouter root={App}>{routes}</HashRouter>
        </MetaProvider>

        <Toaster position="bottom-center" />
      </I18nProvider>
    </QueryClientProvider>
  ),
  document.querySelector('#root')!,
)
