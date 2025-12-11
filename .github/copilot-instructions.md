# Copilot Instructions for metacubexd

## Project Overview

metacubexd is the official Mihomo Dashboard - a web-based management interface for Mihomo (formerly Clash.Meta) proxy core. The dashboard provides real-time traffic monitoring, proxy management, connection tracking, and configuration capabilities.

## Technology Stack

- **Framework**: Nuxt 4 (Vue 3) with TypeScript
- **Language**: TypeScript with strict mode enabled
- **Build Tool**: Nuxt with Vite
- **Styling**: Tailwind CSS v4 with daisyUI v5 components
- **State Management**: Pinia with @pinia/nuxt
- **Data Fetching**: @tanstack/vue-query with ky HTTP client
- **Routing**: Nuxt pages with hash-based routing (CSR mode)
- **i18n**: Custom composable with support for English, Chinese, and Russian
- **Utilities**: @vueuse/core and @vueuse/nuxt
- **Tables**: @tanstack/vue-table
- **Icons**: @tabler/icons-vue
- **Tooltips/Popovers**: @floating-ui/vue

## Important Vue/Nuxt Patterns

### Component Structure

```vue
<script setup lang="ts">
// 1. Type imports
import type { Props } from '~/types'

// 2. External imports
import { IconReload } from '@tabler/icons-vue'

// 3. Internal imports (composables, stores, utils)
import { useRulesQuery } from '~/composables/useQueries'

// 4. Use stores and composables
const configStore = useConfigStore()
const { t } = useI18n()

// 5. Define props and emits
const props = defineProps<Props>()
const emit = defineEmits<{
  click: []
}>()

// 6. Reactive state and computed
const isLoading = ref(false)
const filteredData = computed(() => ...)

// 7. Functions
function handleClick() { ... }
</script>

<template>
  <div>...</div>
</template>
```

### Reactivity Rules

- Use `ref()` for primitive reactive values
- Use `computed()` for derived values
- Use `watch()` or `watchEffect()` for side effects
- Access ref values with `.value` in script, directly in template
- Use `v-if`, `v-for`, `v-show` for conditional rendering

### Pinia Store Pattern

```typescript
import { defineStore } from 'pinia'

export const useConfigStore = defineStore('config', () => {
  // State (use useLocalStorage for persistent state)
  const theme = useLocalStorage<string>('theme', 'sunset')

  // Computed
  const isDark = computed(() => theme.value === 'sunset')

  // Actions
  function setTheme(newTheme: string) {
    theme.value = newTheme
  }

  return { theme, isDark, setTheme }
})
```

### TanStack Query Pattern

```typescript
import { useQuery, useMutation } from '@tanstack/vue-query'

// Query
const { data, isLoading, refetch } = useQuery({
  queryKey: ['rules'],
  queryFn: () => fetchRulesAPI(),
})

// Mutation
const mutation = useMutation({
  mutationFn: (name: string) => updateRuleProviderAPI(name),
})
```

## Code Style Guidelines

### Imports

- Use path alias `~/` for imports from the project root
- Group imports: types first, then external packages, then internal modules
- Auto-imports are configured for Vue, Nuxt, and VueUse composables

### TypeScript

- Use strict TypeScript - avoid `any` types
- Define explicit types for component props with `defineProps<Props>()`
- Use enums from `~/constants` for predefined values
- Use Zod for runtime validation when needed

### Styling

- Use Tailwind CSS utility classes
- Use `twMerge` from tailwind-merge for conditional class merging
- Prefer daisyUI component classes (btn, card, modal, etc.)
- Support both light and dark themes via daisyUI themes
- Use `tailwind-variants` for component variants if needed

### ESLint Rules

- Using @antfu/eslint-config with Vue and TypeScript
- Unused variables with `_` prefix are allowed
- Prettier is used for code formatting (separate from ESLint)
- Console statements are allowed

## Project Structure

```
├── pages/           # Nuxt page components (auto-routing)
├── components/      # Reusable Vue components
├── composables/     # Vue composables (useXxx)
├── stores/          # Pinia stores
├── layouts/         # Nuxt layouts
├── middleware/      # Nuxt route middleware
├── plugins/         # Nuxt plugins
├── i18n/            # Internationalization dictionaries
├── constants/       # Enums and constant values
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
├── assets/          # CSS and static assets
└── public/          # Public static files
```

## Development Commands

```bash
pnpm dev          # Start development server
pnpm dev:mock     # Start with mock data (no backend needed)
pnpm build        # Production build
pnpm generate     # Static site generation
pnpm lint         # Run ESLint with auto-fix
pnpm format       # Format code with Prettier
pnpm test:e2e     # Run E2E tests with Playwright
```

## Component Conventions

### File Naming

- Components: PascalCase (e.g., `ProxyNodeCard.vue`)
- Composables: camelCase with `use` prefix (e.g., `useI18n.ts`)
- Stores: camelCase with `use` prefix (e.g., `useConfigStore`)
- Pages: kebab-case or index files

### UI Patterns

- Use daisyUI modal pattern with `<dialog>` element and `Modal` component
- Use `@tabler/icons-vue` for icons (e.g., `IconReload`)
- Charts use Highcharts with custom `HighchartsAutoSize` wrapper
- Tables use @tanstack/vue-table with `DataTable` component
- Tooltips use @floating-ui/vue for positioning

### Internationalization

- All user-facing strings should use the `useI18n` composable
- Add translations to `i18n/en.ts`, `i18n/zh.ts`, and `i18n/ru.ts`
- Usage: `const { t } = useI18n(); t('key')`

## Testing and Quality

- Run `pnpm lint` before committing
- Run `pnpm format` to auto-format code
- Commits follow conventional commits format (commitlint configured)
- Husky runs lint-staged on pre-commit
- E2E tests use Playwright (`pnpm test:e2e`)

## API Integration

- Backend API calls go through the `ky` client configured in `composables/useApi.ts`
- Use `useRequest()` to get a configured ky instance with auth headers
- WebSocket connections use `composables/useWebSocket.ts`
- The dashboard connects to Mihomo's external-controller API
- Default backend URL: `http://127.0.0.1:9090`
- Mock mode available via `MOCK_MODE=true` environment variable

## Nuxt Configuration

- SSR is disabled (CSR-only mode)
- Hash-based routing enabled for compatibility
- Auto-imports configured for composables, stores, utils, constants, and types
- Components are auto-imported without path prefix
