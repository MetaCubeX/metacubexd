// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineNuxtConfig({
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  // CSR mode - disable SSR completely
  ssr: false,

  // Use hash mode routing (same as original HashRouter)
  router: {
    options: {
      hashMode: true,
    },
  },

  // Runtime config
  runtimeConfig: {
    public: {
      appVersion: pkg.version,
      mockMode: process.env.MOCK_MODE === 'true',
    },
  },

  // Modules
  modules: ['@vueuse/nuxt', '@pinia/nuxt'],

  // TypeScript configuration
  typescript: {
    strict: true,
    shim: false,
  },

  // Auto imports
  imports: {
    dirs: ['composables', 'stores', 'utils', 'constants', 'types'],
  },

  // Components auto-import
  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  // App configuration
  app: {
    head: {
      charset: 'utf-8',
      viewport:
        'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
      title: 'MetaCubeXD',
      meta: [{ name: 'theme-color', content: '#000000' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/pwa-192x192.png' },
      ],
      script: [
        {
          src: '/config.js',
          onerror: "window.__METACUBEXD_CONFIG__={defaultBackendURL:''}",
        },
        {
          innerHTML: `window.__METACUBEXD_CONFIG__ = window.__METACUBEXD_CONFIG__ || { defaultBackendURL: '' }`,
        },
      ],
    },
  },

  // Vite configuration
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
    },
    plugins: [tailwindcss()],
  },

  compatibilityDate: 'latest',
})
