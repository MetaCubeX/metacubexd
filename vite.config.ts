import tailwindcss from '@tailwindcss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import solidPlugin from 'vite-plugin-solid'
import { version } from './package.json'

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
  resolve: { alias: { '~': '/src' } },

  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(version),
  },

  plugins: [
    solidPlugin(),

    tailwindcss(),

    AutoImport({
      imports: ['solid-js'],
      packagePresets: ['@solidjs/router'],
    }),

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      manifest: {
        name: 'MetaCubeXD',
        short_name: 'MetaCubeXD',
        description: 'Mihomo Dashboard, The Official One, XD',
        theme_color: '#000000',
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
