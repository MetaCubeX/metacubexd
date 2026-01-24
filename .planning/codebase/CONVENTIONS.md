# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**

- **Vue Components:** PascalCase (e.g., `Button.vue`, `ConnectionsTable.vue`).
- **Vue Layouts:** kebab-case (e.g., `default.vue`, `blank.vue`).
- **Vue Pages:** kebab-case (e.g., `index.vue`, `connections.vue`).
- **TypeScript files:** camelCase or kebab-case depending on content (e.g., `useApi.ts`, `misc.ts`).
- **Directories:** kebab-case (e.g., `components`, `composables`, `stores`, `utils`).

**Functions:**

- **Vue Composables:** Functions are prefixed with `use` (e.g., `useApi`, `useMockMode`, `useRequest`) in `composables/` directory.
- **API Functions:** Start with action verb + `API` (e.g., `fetchBackendConfigAPI`, `closeAllConnectionsAPI`) as seen in `composables/useApi.ts`.
- **General Functions:** camelCase (e.g., `formatBytes`, `getProcess`, `isSortableColumn`).

**Variables:**

- **Constants:** UPPER_SNAKE_CASE (inferred, not explicitly found examples in provided snippets but common in JS/TS).
- **Local Variables/Reactive State:** camelCase (e.g., `isClosingConnections`, `reloadingConfigFile`, `activeTab`).
- **Props:** camelCase (e.g., `proxyName`, `testUrl`, `isSelected`).

**Types:**

- **Interfaces/Types:** PascalCase (e.g., `Connection`, `ProxyProvider`, `ReleaseAPIResponse`).

## Code Style

**Formatting:**

- **Tool used:** Prettier (`prettier`).
- **Key settings:**
  - `semi: false` (no semicolons).
  - `singleQuote: true` (single quotes for strings).
  - `endOfLine: lf` (line endings).
  - `plugins`: `@prettier/plugin-oxc`, `prettier-plugin-tailwindcss`.
- **Config file:** `/Users/shikun/Developer/opensource/metacubexd/prettier.config.js`

**Linting:**

- **Tool used:** ESLint (`eslint`).
- **Key settings:** Uses `@antfu/eslint-config`.
- **Config file:** `/Users/shikun/Developer/opensource/metacubexd/.eslintrc.cjs`
- `package.json` script: `pnpm lint` runs `eslint --fix .`.

## Import Organization

**Order:**

- Type imports are separated with `import type { ... } from '...'` (e.g., `import type { VNode } from 'vue'`).
- Library imports appear before local imports (e.g., `import ky from 'ky'` before `import { useMockData } from './useMockData'`).

**Path Aliases:**

- `~` is used to reference the project root (e.g., `~/types`, `~/constants`, `~/composables`).

## Error Handling

**Patterns:**

- `try...catch` blocks are used for asynchronous operations, especially API calls (e.g., in `composables/useApi.ts`).
- Some `catch` blocks are intentionally left empty with `/* empty */` comments (e.g., in `composables/useApi.ts`, `reloadConfigFileAPI`).
- Errors are logged using `console.error` (e.g., `composables/useApi.ts`).
- Specific error conditions can `throw new Error()` (e.g., `composables/useIPInfo.ts`).

## Logging

**Framework:** `console` API.

**Patterns:**

- `console.log` is used for informational messages and debugging (e.g., `e2e/pages.spec.ts`, `scripts/screenshot.ts`).
- `console.error` is used for error reporting (e.g., `composables/useApi.ts`).

## Function Design

**Size:** Functions generally appear concise, focusing on a single responsibility.
**Parameters:** Explicitly typed parameters are common due to TypeScript usage.
**Return Values:** Functions explicitly return values or promises. Composables (`use*` functions) typically return reactive objects/refs.

## Module Design

**Exports:**

- Default exports are not commonly used. Named exports are preferred (e.g., `export function useRequest()`, `export const useLogsStore = defineStore(...)`).
- Vue components are implicitly exported when defined in `<script setup>`.

**Barrel Files:**

- Not explicitly detected in the provided snippets. Directory `imports` in `nuxt.config.ts` might handle this.

---

_Convention analysis: 2026-01-25_
