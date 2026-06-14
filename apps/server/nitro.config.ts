import { fileURLToPath } from 'node:url'
import { defineNitroConfig } from 'nitropack/config'

// UI_DIST overrides the bundled static dashboard at runtime (set in Docker).
// Dev fallback resolves the sibling packages/ui generate output.
const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))

export default defineNitroConfig({
  preset: 'node-server',
  // Pin so Nitro feature flags do not drift between builds.
  compatibilityDate: '2025-01-01',
  // Serve the prebuilt dashboard. maxAge: 1 year (hashed assets are immutable).
  publicAssets: [{ baseURL: '/', dir: uiDist, maxAge: 60 * 60 * 24 * 365 }],
  // Exclude test files from Nitro's middleware/routes scanner.
  ignore: ['**/__tests__/**', '**/*.spec.ts', '**/*.test.ts'],
  // NOTE: Intentionally NO Clash-API proxy here. Nitro routeRules `proxy`
  // cannot upgrade WebSocket connections (nitrojs/nitro#2886), and the
  // dashboard talks to mihomo's Clash API over native WebSocket (traffic,
  // connections, logs). Proxying would yield a half-broken endpoint (HTTP ok,
  // WS dead). Instead the agent injects `external-controller: 0.0.0.0:<port>`
  // into the active config and the published 9090 port is hit directly by the
  // UI endpoint store. Do NOT add a /clash-api proxy route.
})
