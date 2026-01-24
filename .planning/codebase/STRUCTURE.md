# Directory Structure

**Analysis Date:** 2026-01-25

## Overview

```
metacubexd/
├── app.vue                 # Root Vue component
├── nuxt.config.ts          # Nuxt configuration
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── vitest.config.ts        # Test config
├── eslint.config.mjs       # Linting config
│
├── assets/                 # Static assets
│   └── css/main.css        # Global styles
│
├── components/             # Vue components
│   ├── connections/        # Connection-related components
│   │   ├── ConnectionsTable.vue
│   │   ├── ConnectionsToolbar.vue
│   │   ├── ConnectionsPagination.vue
│   │   ├── ConnectionDetailsModal.vue
│   │   └── ConnectionsSettingsModal.vue
│   ├── Button.vue
│   ├── Modal.vue
│   ├── Sidebar.vue
│   ├── DataTable.vue
│   ├── NetworkTopology.vue
│   ├── ProxyNodeCard.vue
│   ├── ProxyNodeListItem.vue
│   └── ... (30+ components)
│
├── composables/            # Vue composables
│   ├── useApi.ts           # API client and requests
│   ├── useWebSocket.ts     # WebSocket connections
│   ├── useQueries.ts       # TanStack Query hooks
│   ├── useLatencyTest.ts   # Latency testing
│   ├── useDataTable.ts     # Table utilities
│   ├── useIPInfo.ts        # IP lookup
│   └── useMockData.ts      # Mock data for dev
│
├── constants/              # App constants
│   └── index.ts            # Exported constants
│
├── e2e/                    # E2E tests
│   └── pages.spec.ts       # Page tests
│
├── i18n/                   # Internationalization
│   └── locales/
│       ├── en.json
│       ├── zh.json
│       └── ru.json
│
├── layouts/                # Nuxt layouts
│   ├── default.vue         # Main layout with sidebar
│   └── blank.vue           # Minimal layout
│
├── middleware/             # Nuxt middleware
│   └── auth.global.ts      # Auth/redirect logic
│
├── pages/                  # Route pages
│   ├── index.vue           # Home (redirects)
│   ├── setup.vue           # Backend setup
│   ├── overview.vue        # Dashboard
│   ├── proxies.vue         # Proxy management
│   ├── connections.vue     # Connection viewer
│   ├── rules.vue           # Rules viewer
│   ├── logs.vue            # Log viewer
│   └── config.vue          # Configuration
│
├── plugins/                # Nuxt plugins
│
├── public/                 # Static files
│   ├── config.js           # Runtime config
│   └── favicon.svg
│
├── scripts/                # Build/utility scripts
│   └── screenshot.ts       # Screenshot automation
│
├── stores/                 # Pinia stores
│   ├── proxies.ts          # Proxy state
│   ├── connections.ts      # Connection state
│   ├── logs.ts             # Log state
│   ├── rules.ts            # Rules state
│   └── endpoint.ts         # Endpoint config
│
├── types/                  # TypeScript types
│   ├── index.ts            # Main types
│   └── network.ts          # Network-related types
│
├── utils/                  # Utility functions
│   ├── index.ts            # Barrel export
│   ├── format.ts           # Formatting utilities
│   ├── theme.ts            # Theme utilities
│   └── misc.ts             # Miscellaneous
│
├── docs/                   # Documentation/screenshots
│   ├── pc/
│   └── mobile/
│
├── dist/                   # Build output
└── .output/                # Nuxt build output
```

## Key Locations

| Need            | Location                                |
| --------------- | --------------------------------------- |
| Add new page    | `pages/[name].vue`                      |
| Add component   | `components/[Name].vue`                 |
| Add composable  | `composables/use[Name].ts`              |
| Add store       | `stores/[name].ts`                      |
| Add type        | `types/index.ts` or `types/[domain].ts` |
| Add utility     | `utils/[name].ts`                       |
| Add translation | `i18n/locales/[lang].json`              |
| Modify config   | `nuxt.config.ts`                        |

## Naming Conventions

| Type        | Convention                  | Example             |
| ----------- | --------------------------- | ------------------- |
| Components  | PascalCase                  | `ProxyNodeCard.vue` |
| Pages       | kebab-case                  | `connections.vue`   |
| Composables | camelCase with `use` prefix | `useApi.ts`         |
| Stores      | camelCase                   | `proxies.ts`        |
| Utils       | camelCase                   | `format.ts`         |

---

_Structure analysis: 2026-01-25_
