# External Integrations

**Analysis Date:** 2026-01-25

## API Integrations

### Mihomo/Clash Backend API

**Purpose:** Core proxy management backend

**Connection:**

- WebSocket for real-time data (traffic, logs, connections)
- REST API for configuration and control

**Endpoints (from `composables/useApi.ts`):**

- `/configs` - Backend configuration
- `/proxies` - Proxy management
- `/providers/proxies` - Proxy providers
- `/rules` - Rules management
- `/providers/rules` - Rule providers
- `/connections` - Active connections
- `/logs` - Log streaming (WebSocket)
- `/traffic` - Traffic data (WebSocket)
- `/memory` - Memory usage (WebSocket)
- `/version` - Backend version info
- `/group/:name/delay` - Latency testing

**Authentication:** Secret-based (passed via URL parameter or header)

### IP Info Providers

**Purpose:** Lookup IP geolocation information

**Providers (from `composables/useIPInfo.ts`):**

- ip.sb
- ipapi.co
- ip-api.com
- ipinfo.io

## External Services

### Google Fonts

**Purpose:** Web font loading (Ubuntu font family)

**Integration:** Via `@nuxt/fonts` module

### GitHub API

**Purpose:** Version checking and changelog

**Endpoints:**

- GitHub releases API for version info

## Mock Mode

**Purpose:** Development without live backend

**Trigger:** `MOCK_MODE=true` environment variable

**Implementation:** `composables/useMockData.ts` provides mock responses

## Configuration Sources

### Runtime Configuration

**File:** `public/config.js`

**Purpose:** Allow deployment-time configuration

```javascript
window.__METACUBEXD_CONFIG__ = {
  defaultBackendURL: '',
}
```

### Environment Variables

| Variable            | Purpose                 |
| ------------------- | ----------------------- |
| `MOCK_MODE`         | Enable mock data mode   |
| `NUXT_APP_BASE_URL` | Base URL for deployment |

---

_Integration analysis: 2026-01-25_
