import { contextBridge, ipcRenderer } from 'electron'

// Shared contract (spec §4): the renderer bridge shape consumed by
// packages/ui/plugins/desktop-endpoint.client.ts + composables/useControlApi.ts
// + composables/useDesktop.ts.
//   window.metacubexd = {
//     isDesktop: true,
//     platform: 'darwin' | 'win32' | 'linux',
//     control:  { base, token },
//     endpoint: { url, secret },
//     window:   { minimize, toggleMaximize, close, isMaximized, onMaximizeChange },
//   }
// Endpoint/control values arrive via env vars the main process sets on this
// preload's process; the window methods proxy to the main-process IPC channels
// registered by window-controls.ts.
contextBridge.exposeInMainWorld('metacubexd', {
  isDesktop: true,
  platform: process.platform,
  control: {
    base: process.env.MCXD_CONTROL_BASE,
    token: process.env.MCXD_CONTROL_TOKEN,
  },
  endpoint: {
    url: process.env.MCXD_CLASH_URL,
    secret: process.env.MCXD_CLASH_SECRET,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    // Subscribe to native maximize/unmaximize; returns an unsubscribe fn.
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      const handler = (_event: unknown, maximized: boolean) => cb(maximized)
      ipcRenderer.on('window:maximize-changed', handler)
      return () =>
        ipcRenderer.removeListener('window:maximize-changed', handler)
    },
  },
})
