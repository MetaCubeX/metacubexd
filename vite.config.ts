import { defineConfig, splitVendorChunkPlugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '~': '/src' } },
  plugins: [
    solidPlugin(),
    splitVendorChunkPlugin(),
    VitePWA({ registerType: 'autoUpdate' }),
  ],
})
