import { contextBridge, ipcRenderer } from 'electron'
import { buildMetacubexdBridge } from './bridge'

// Expose the typed renderer bridge (see ./bridge.ts for the contract +
// per-field provenance). The shape is built/validated by buildMetacubexdBridge
// so the env→bridge mapping and ipc wiring stay unit-testable; this file is just
// the thin contextBridge handoff that can only run in a real preload context.
contextBridge.exposeInMainWorld(
  'metacubexd',
  buildMetacubexdBridge({
    env: process.env,
    platform: process.platform,
    ipc: ipcRenderer,
  }),
)
