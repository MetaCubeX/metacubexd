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
  modules: [
    '@vueuse/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/fonts',
    '@vite-pwa/nuxt',
  ],

  // PWA configuration
  // Restores the PWA support that existed before the Nuxt migration (#1777)
  // so the dashboard can be installed to the home screen (#1986).
  // `prompt` + skipWaiting/clientsClaim disabled mirrors the pre-migration
  // setup that avoids the iOS Safari refresh loop (#1740). Only built static
  // assets are precached; the cross-origin Mihomo backend API is never cached.
  pwa: {
    registerType: 'prompt',
    includeAssets: ['favicon.svg'],
    manifest: {
      name: 'MetaCubeXD',
      short_name: 'MetaCubeXD',
      description: 'Mihomo Dashboard, The Official One, XD',
      theme_color: '#000000',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      // Precache the built app shell only (relative paths keep subdirectory
      // deployments working). Backend API responses are dynamic and
      // cross-origin, so they are intentionally left uncached.
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      // Keep these out of the precache:
      // - config.js: deploy-time backend URL, editable after build — precaching
      //   would pin a stale address. Always fetch it fresh.
      // - 200.html/404.html: nuxt generate's SPA fallbacks. nitro normalizes
      //   their precache URLs to extension-less "/200" and "/404", which 404 on
      //   static hosts and make the SW install fail (so it never activates). The
      //   app shell is already covered by index.html via the navigation fallback.
      globIgnores: ['**/config.js', '200.html', '404.html'],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      // Keep skipWaiting/clientsClaim off to prevent iOS Safari refresh loops (#1740).
      skipWaiting: false,
      clientsClaim: false,
      // Drop outdated precaches so iOS Web Clips don't load stale resources (#1796).
      cleanupOutdatedCaches: true,
    },
  },

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
        // @vite-pwa/nuxt emits this file from the `pwa.manifest` config; we
        // link it here (instead of via <VitePwaManifest />) so it lands in the
        // static HTML shell. With ssr: false, component-injected head tags only
        // appear at runtime — too late for reliable install detection on mobile
        // Chrome. Relative href keeps subdirectory deployments working.
        { rel: 'manifest', href: 'manifest.webmanifest' },
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

  // Disable app manifest to avoid 404 errors for _nuxt/builds/meta/*.json
  // in non-standard browsers (e.g. VIA on Android). Not needed for CSR-only apps.
  experimental: {
    appManifest: false,
  },

  compatibilityDate: 'latest',
})
