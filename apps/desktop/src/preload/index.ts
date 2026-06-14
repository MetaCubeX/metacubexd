import { contextBridge } from 'electron'

// Shared contract (spec §4): the renderer bridge shape consumed by
// packages/ui/plugins/desktop-endpoint.client.ts + composables/useControlApi.ts.
//   window.metacubexd = {
//     isDesktop: true,
//     control:  { base, token },
//     endpoint: { url, secret },
//   }
// Values arrive via env vars the main process sets on this preload's process.
contextBridge.exposeInMainWorld('metacubexd', {
  isDesktop: true,
  control: {
    base: process.env.MCXD_CONTROL_BASE,
    token: process.env.MCXD_CONTROL_TOKEN,
  },
  endpoint: {
    url: process.env.MCXD_CLASH_URL,
    secret: process.env.MCXD_CLASH_SECRET,
  },
})
