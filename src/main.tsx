/* @refresh reload */
import '~/index.css'

import { Router, hashIntegration } from '@solidjs/router'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import { render } from 'solid-js/web'
import { App } from '~/App'
import { I18nProvider, locale } from '~/i18n'

dayjs.extend(relativeTime)

render(
  () => (
    <I18nProvider locale={locale()}>
      <Router source={hashIntegration()}>
        <App />
      </Router>
    </I18nProvider>
  ),
  document.getElementById('root')!,
)
