# Technical Concerns

**Analysis Date:** 2026-01-25

## Large Files

Files exceeding 500 lines that may benefit from refactoring:

| File                                    | Lines | Concern                       |
| --------------------------------------- | ----- | ----------------------------- |
| `pages/proxies.vue`                     | 1064  | Complex proxy management page |
| `components/DataUsageTable.vue`         | 1036  | Large data table component    |
| `pages/config.vue`                      | 966   | Configuration page            |
| `components/NetworkTopology.vue`        | 913   | D3-based visualization        |
| `components/GlobalTrafficIndicator.vue` | 870   | Real-time chart               |
| `pages/overview.vue`                    | 839   | Dashboard page                |
| `composables/useMockData.ts`            | 803   | Mock data definitions         |
| `pages/connections.vue`                 | 740   | Connections page              |
| `pages/logs.vue`                        | 697   | Logs page                     |
| `pages/rules.vue`                       | 645   | Rules page                    |

**Recommendation:** Consider extracting sub-components from large page files.

## Empty Returns / Defensive Code

Locations with defensive `return null/[]/{}` patterns:

| File                               | Line        | Pattern                                |
| ---------------------------------- | ----------- | -------------------------------------- |
| `components/ProxyNodeCard.vue`     | 47          | `return null` for filtered proxy types |
| `components/ProxyNodeListItem.vue` | 48          | `return null`                          |
| `composables/useLatencyTest.ts`    | 23, 86      | `return null` for no results           |
| `composables/useDataTable.ts`      | 116, 120    | `return []` for missing columns        |
| `composables/useApi.ts`            | 26, 74, 477 | `return {}` and `return []`            |
| `composables/useWebSocket.ts`      | 26          | `return null` for missing endpoint     |
| `stores/proxies.ts`                | 274         | `return []`                            |

These are generally acceptable defensive patterns, not tech debt.

## No TODO/FIXME Comments

No `TODO`, `FIXME`, `HACK`, or `XXX` comments found in the codebase, suggesting clean code maintenance.

## Security Considerations

### API Secret Handling

- Backend secret passed via URL parameter or stored in localStorage
- Consider: Secrets in URL may appear in browser history/logs

### External API Calls

- IP info lookups made to third-party services
- Consider: Privacy implications of IP lookups

## Performance Considerations

### Large Data Sets

- Connections table may have many entries
- Virtual scrolling (`@tanstack/vue-virtual`) is used for mitigation
- Consider: Monitor performance with 1000+ connections

### Real-time Updates

- Multiple WebSocket connections for traffic/logs/memory
- Consider: Connection management on mobile/low-bandwidth

### Chart Rendering

- Highcharts and D3 used for visualization
- Large datasets may impact rendering performance

## Testing Gaps

- No unit tests found for composables/stores
- E2E tests exist but coverage unclear
- Consider: Adding unit tests for critical business logic

## Bundle Size

- Chunk size warning limit set to 1000KB
- Multiple heavy dependencies (D3, Highcharts, TanStack)
- Consider: Lazy loading for visualization components

## Browser Compatibility

- Modern ES modules used (`"type": "module"`)
- No explicit polyfills visible
- Consider: Document supported browser versions

---

_Concerns analysis: 2026-01-25_
