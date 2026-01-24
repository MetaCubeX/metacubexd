# Architecture

**Analysis Date:** 2026-01-25

## Pattern

**Client-Side Rendered SPA** with Nuxt 4 framework

- No server-side rendering (SSR disabled)
- Hash-based routing for static hosting compatibility
- Connects to external Mihomo/Clash backend API

## Layers

```
┌─────────────────────────────────────────────────────────┐
│                      Pages (routes)                      │
│   index, overview, proxies, connections, rules, logs,   │
│                    config, setup                         │
├─────────────────────────────────────────────────────────┤
│                      Layouts                             │
│              default (sidebar), blank                    │
├─────────────────────────────────────────────────────────┤
│                     Components                           │
│   UI components, data tables, charts, modals            │
├─────────────────────────────────────────────────────────┤
│                    Composables                           │
│   useApi, useWebSocket, useQueries, useLatencyTest      │
├─────────────────────────────────────────────────────────┤
│                      Stores                              │
│   proxies, connections, logs, rules, endpoint           │
├─────────────────────────────────────────────────────────┤
│                      Utils                               │
│         Formatting, theming, miscellaneous              │
├─────────────────────────────────────────────────────────┤
│              External: Mihomo Backend API               │
│          REST API + WebSocket connections               │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Initial Setup:** User configures backend endpoint (`/setup`)
2. **API Client:** `composables/useApi.ts` creates HTTP client with `ky`
3. **Queries:** `@tanstack/vue-query` manages server state
4. **Real-time:** WebSocket connections for traffic, logs, memory
5. **State:** Pinia stores for client-side state
6. **UI:** Vue components render data with TailwindCSS/DaisyUI

## Key Abstractions

### API Layer (`composables/useApi.ts`)

- `useRequest()` - Creates typed API client
- Handles mock mode switching
- Manages authentication secret

### WebSocket Layer (`composables/useWebSocket.ts`)

- Traffic data streaming
- Log streaming
- Memory usage updates
- Connection updates

### Query Layer (`composables/useQueries.ts`)

- `useProxiesQuery()` - Proxy data
- `useProvidersQuery()` - Provider data
- `useRulesQuery()` - Rules data
- `useVersionQuery()` - Version info

### Store Layer (`stores/`)

- `proxies.ts` - Proxy state and actions
- `connections.ts` - Connection tracking
- `logs.ts` - Log buffer management
- `rules.ts` - Rules state
- `endpoint.ts` - Backend endpoint config

## Entry Points

| Entry                       | Purpose                       |
| --------------------------- | ----------------------------- |
| `app.vue`                   | Root component                |
| `pages/index.vue`           | Home redirect                 |
| `pages/setup.vue`           | Initial backend configuration |
| `middleware/auth.global.ts` | Route protection              |

## Deployment

- Static site generation (`nuxt generate`)
- Docker support (`Dockerfile`)
- Configurable base URL for subdirectory hosting

---

_Architecture analysis: 2026-01-25_
