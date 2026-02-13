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
  // Public keys can be overridden at runtime via NUXT_PUBLIC_* env vars
  // e.g. NUXT_PUBLIC_DEFAULT_BACKEND_URL=http://host:port
  runtimeConfig: {
    public: {
      appVersion: pkg.version,
      mockMode: process.env.MOCK_MODE === 'true',
      defaultBackendURL: '',
    },
  },

  // Modules
  modules: ['@vueuse/nuxt', '@pinia/nuxt', '@nuxtjs/i18n', '@nuxt/fonts'],

  // i18n configuration
  i18n: {
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'zh', name: '简体中文', file: 'zh.json' },
      { code: 'ru', name: 'Русский', file: 'ru.json' },
    ],
    defaultLocale: 'en',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'metacubexd_lang',
      fallbackLocale: 'en',
    },
  },

  // Fonts configuration - using Ubuntu font
  fonts: {
    families: [
      {
        name: 'Ubuntu',
        provider: 'google',
        weights: [300, 400, 500, 700],
        styles: ['normal', 'italic'],
      },
    ],
    defaults: {
      weights: [400, 700],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
    },
  },

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
    // Use relative paths for assets to support both root and subdirectory deployments
    // Can be overridden with NUXT_APP_BASE_URL environment variable
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      charset: 'utf-8',
      viewport:
        'width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
      title: 'MetaCubeXD',
      meta: [{ name: 'theme-color', content: '#000000' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: 'favicon.svg' },
        { rel: 'apple-touch-icon', href: 'pwa-192x192.png' },
      ],
      script: [
        {
          // Use relative path for config.js to support both root and subdirectory deployments
          // tagPosition: 'head' and blocking load ensure config is available before app runs
          src: 'config.js',
          tagPosition: 'head',
          defer: false,
          async: false,
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
