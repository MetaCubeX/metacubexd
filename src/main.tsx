/* @refresh reload */
import '~/index.css'

import { Router, hashIntegration } from '@solidjs/router'
import { render } from 'solid-js/web'
import { App } from '~/App'
import { I18nProvider } from '~/i18n'

const root = document.getElementById('root')

render(
  () => (
    <I18nProvider>
      <Router source={hashIntegration()}>
        <App />
      </Router>
    </I18nProvider>
  ),
  root!,
)
