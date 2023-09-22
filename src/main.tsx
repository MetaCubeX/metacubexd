/* @refresh reload */
import '~/index.css'

import { Router, hashIntegration } from '@solidjs/router'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import { render } from 'solid-js/web'
import { App } from '~/App'

dayjs.extend(relativeTime)

render(
  () => (
    <Router source={hashIntegration()}>
      <App />
    </Router>
  ),
  document.getElementById('root')!,
)
