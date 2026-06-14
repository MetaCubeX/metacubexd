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
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') },
      },
    },
  },
})
