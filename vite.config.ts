import { defineConfig, splitVendorChunkPlugin } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '~': '/src' } },
  plugins: [solidPlugin(), splitVendorChunkPlugin()],
})
