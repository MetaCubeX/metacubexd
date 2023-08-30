import devtools from 'solid-devtools/vite'
import { defineConfig, splitVendorChunkPlugin } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '~': '/src' } },
  plugins: [devtools(), solidPlugin(), splitVendorChunkPlugin()],
})
