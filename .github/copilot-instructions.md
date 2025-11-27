# Copilot Instructions for metacubexd

## Project Overview

metacubexd is the official Mihomo Dashboard - a web-based management interface for Mihomo (formerly Clash.Meta) proxy core. The dashboard provides real-time traffic monitoring, proxy management, connection tracking, and configuration capabilities.

## Technology Stack

- **Framework**: SolidJS (reactive UI library, NOT React)
- **Language**: TypeScript with strict mode enabled
- **Build Tool**: Vite with rolldown-vite
- **Styling**: Tailwind CSS v4 with daisyUI v5 components
- **State Management**: SolidJS signals and @solid-primitives packages
- **Data Fetching**: @tanstack/solid-query and ky HTTP client
- **Routing**: @solidjs/router with hash-based routing
- **i18n**: @solid-primitives/i18n with support for English, Chinese, and Russian
- **PWA**: vite-plugin-pwa for Progressive Web App support

## Important SolidJS Patterns

### DO use SolidJS patterns (NOT React patterns)

```tsx
// ✅ Correct - SolidJS signals
const [count, setCount] = createSignal(0)

// ❌ Wrong - React hooks
const [count, setCount] = useState(0)
```

### Reactivity Rules

- Use `createSignal` for reactive state
- Use `createEffect` for side effects (NOT useEffect)
- Use `createMemo` for derived values
- Access signal values by calling them: `count()` not `count`
- Use `Show`, `For`, `Switch/Match` components for conditional rendering
- Components receive props as a single object, destructuring loses reactivity

### Component Structure

```tsx
import type { Component } from 'solid-js'

const MyComponent: Component<{ title: string }> = (props) => {
  // Access props.title, don't destructure
  return <div>{props.title}</div>
}
```

## Code Style Guidelines

### Imports

- Use path alias `~/` for imports from the `src` directory
- Group imports: external packages first, then internal modules
- Auto-imports are configured for solid-js and @solidjs/router

### TypeScript

- Use strict TypeScript - avoid `any` types
- Define explicit types for component props
- Use enums from `~/constants` for predefined values

### Styling

- Use Tailwind CSS utility classes
- Use `twMerge` from tailwind-merge for conditional class merging
- Prefer daisyUI component classes (btn, card, modal, etc.)
- Support both light and dark themes

### ESLint Rules

- Unused variables with `_` prefix are allowed
- Blank lines required before `return`, `if`, and `switch` statements
- Prettier is integrated with ESLint

## Project Structure

```
src/
├── apis/          # API client functions using ky
├── components/    # Reusable UI components
├── constants/     # Enums and constant values
├── helpers/       # Utility functions
├── i18n/          # Internationalization dictionaries
├── mock/          # Mock data for development
├── pages/         # Route page components
├── query/         # TanStack Query client setup
├── signals/       # Global reactive signals
└── types/         # TypeScript type definitions
```

## Development Commands

```bash
pnpm dev          # Start development server
pnpm dev:mock     # Start with mock data (no backend needed)
pnpm build        # Production build
pnpm lint         # Run ESLint with auto-fix
pnpm format       # Format code with Prettier
```

## Component Conventions

### File Naming

- Components: PascalCase (e.g., `ProxyNodeCard.tsx`)
- Utilities: camelCase (e.g., `helpers/index.ts`)
- Export components from `components/index.ts` barrel file

### UI Patterns

- Use daisyUI modal pattern with `<dialog>` element
- Use `@tabler/icons-solidjs` for icons
- Charts use Highcharts with custom `HighchartsAutoSize` wrapper
- Tables use @tanstack/solid-table

### Internationalization

- All user-facing strings should use the `useI18n` hook
- Add translations to `i18n/en.ts`, `i18n/zh.ts`, and `i18n/ru.ts`
- Use the translation function: `const [t] = useI18n(); t('key')`

## Testing and Quality

- Run `pnpm lint` before committing
- Run `pnpm format` to auto-format code
- Commits follow conventional commits format (commitlint configured)
- Husky runs lint-staged on pre-commit

## API Integration

- Backend API calls go through the `ky` client configured in `apis/`
- WebSocket connections use `@solid-primitives/websocket`
- The dashboard connects to Mihomo's external-controller API
- Default backend URL: `http://127.0.0.1:9090`
