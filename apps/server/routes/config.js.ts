import { defineEventHandler, setHeader } from 'h3'
import { serverEnv } from '../lib/supervisor'

// Runtime dashboard config, served to the SPA as `window.__METACUBEXD_CONFIG__`
// before the app boots (index.html loads /config.js synchronously in <head>).
//
// In the All-in-One server the dashboard and the control agent share an origin,
// so the UI *could* authenticate to /api/control automatically — but only if it
// knows the token. We inject CONTROL_TOKEN here (mirroring the desktop preload
// bridge), shadowing the build-time static config.js so the kernel/profile UI
// unlocks without the user hand-entering anything (#2074). Anyone who can load
// this dashboard can already reach /api/control on the same port, so injecting
// the token exposes nothing the agent's auth wasn't already gating here.
export default defineEventHandler((event) => {
  const { controlToken } = serverEnv()
  const config: Record<string, unknown> = { defaultBackendURL: '' }
  if (controlToken) config.controlToken = controlToken
  setHeader(event, 'content-type', 'text/javascript; charset=utf-8')
  // Never cache: the injected token must track CONTROL_TOKEN across restarts.
  setHeader(event, 'cache-control', 'no-store')
  return `window.__METACUBEXD_CONFIG__ = ${JSON.stringify(config)}\n`
})
