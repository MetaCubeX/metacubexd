import { defineEventHandler, setHeader } from 'h3'
import { serverEnv } from '../lib/supervisor'

// Runtime dashboard config, served to the SPA as `window.__METACUBEXD_CONFIG__`
// before the app boots (index.html loads /config.js synchronously in <head>).
//
// In the All-in-One server the dashboard and the control agent share an origin,
// so the UI *could* authenticate to /api/control automatically — but only if it
// knows the token. We inject CONTROL_TOKEN here (mirroring the desktop preload
// bridge), shadowing the build-time static config.js so the kernel/profile UI
// unlocks without the user hand-entering anything (#2074). GITHUB_TOKEN is also
// injected when configured so Releases requests can use authenticated limits
// (#2135); operators must therefore treat dashboard access as token access.
export default defineEventHandler((event) => {
  const { controlToken, githubToken } = serverEnv()
  const config: Record<string, unknown> = { defaultBackendURL: '' }
  if (controlToken) config.controlToken = controlToken
  if (githubToken) config.githubToken = githubToken
  setHeader(event, 'content-type', 'text/javascript; charset=utf-8')
  // Never cache: injected tokens must track the environment across restarts.
  setHeader(event, 'cache-control', 'no-store')
  return `window.__METACUBEXD_CONFIG__ = ${JSON.stringify(config)}\n`
})
