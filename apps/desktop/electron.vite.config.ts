import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// No `renderer` build: the renderer is the prebuilt `@metacubexd/ui`
// `nuxt generate` output, copied into ./renderer by `pnpm copy:renderer`.
// The main process loads it via `win.loadFile('renderer/index.html')`.
export default defineConfig({
  main: {
    // Bundle @metacubexd/agent (TS source) INTO the main output, but keep
    // electron + native node builtins external.
    plugins: [externalizeDepsPlugin({ exclude: ['@metacubexd/agent'] })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
    // electron-vite forces `ssr.noExternal: true` (bundle everything) for the
    // main process. Under rolldown-vite that pipeline resolves `electron` to
    // the npm launcher stub (its index.js runs getElectronPath()/install.js at
    // load time) and bundles it, ignoring rollupOptions.external — the bundled
    // stub then crashes at startup ("Electron failed to install correctly").
    // ssr.external explicitly keeps electron external, overriding noExternal.
    ssr: { external: ['electron'] },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
    // Same reason as main: keep electron (contextBridge/ipcRenderer) external.
    ssr: { external: ['electron'] },
  },
})
