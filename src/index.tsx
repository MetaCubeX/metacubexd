/* @refresh reload */
import '~/index.css'

import { I18nContext } from '@solid-primitives/i18n'
import { Router, hashIntegration } from '@solidjs/router'
import { render } from 'solid-js/web'
import { App } from './App'
import { i18nContext } from './i18n'

const root = document.getElementById('root')

render(
  () => (
    <I18nContext.Provider value={i18nContext}>
      <Router source={hashIntegration()}>
        <App />
      </Router>
    </I18nContext.Provider>
  ),
  root!,
)
