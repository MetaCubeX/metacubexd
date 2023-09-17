import { defineConfig, splitVendorChunkPlugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import solidPlugin from 'vite-plugin-solid'
import pkgJSON from './package.json'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '~': '/src' } },
  define: {
    'import.meta.env.version': JSON.stringify(pkgJSON.version),
  },
  plugins: [
    solidPlugin(),

    splitVendorChunkPlugin(),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
