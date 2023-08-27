/* @refresh reload */
import 'solid-devtools'
import { render } from 'solid-js/web'

import { Router, hashIntegration } from '@solidjs/router'
import { App } from './App'
import './index.css'

const root = document.getElementById('root')

render(
  () => (
    <Router source={hashIntegration()}>
      <App />
    </Router>
  ),
  root!,
)
