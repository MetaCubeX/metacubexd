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
      // Output to `out/` (not the default `out/main`) so the helper can be a
      // sibling of main. Input keys carry the subdir: `main/index` ->
      // out/main/index.js (keeps package.json "main": "out/main/index.js"),
      // `helper/index` -> out/helper/index.js.
      outDir: 'out',
      // Sibling .map files so a field crash stack maps back to src/main/*.ts
      // (the bundle is ~11k concatenated lines). Prefer sibling over 'inline' so
      // the maps don't bloat the privileged main/helper files; they ride along
      // in the asar (out/**/*) and are never served by the control server.
      sourcemap: true,
      rollupOptions: {
        input: {
          'main/index': resolve(__dirname, 'src/main/index.ts'),
          // Third entry: the privileged helper (spec §12.1), bundled with the
          // SAME main settings (node target + electron external) so the B-3
          // installer can register `<electron-bin> out/helper/index.js`
          // (ELECTRON_RUN_AS_NODE=1) as a privileged service.
          'helper/index': resolve(__dirname, 'src/helper/index.ts'),
        },
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
      sourcemap: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
    // Same reason as main: keep electron (contextBridge/ipcRenderer) external.
    ssr: { external: ['electron'] },
  },
})
