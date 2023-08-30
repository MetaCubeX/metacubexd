/* @refresh reload */
import '~/index.css'

import { Router, hashIntegration } from '@solidjs/router'
import { render } from 'solid-js/web'
import { App } from './App'

const root = document.getElementById('root')

render(
  () => (
    <Router source={hashIntegration()}>
      <App />
    </Router>
  ),
  root!,
)
