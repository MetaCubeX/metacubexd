# Technology Stack

**Analysis Date:** 2026-01-25

## Language & Runtime

| Technology | Version | Purpose            |
| ---------- | ------- | ------------------ |
| TypeScript | ^5.9.3  | Primary language   |
| Node.js    | -       | Runtime (via pnpm) |
| Vue 3      | ^3.5.25 | UI framework       |

## Framework

**Nuxt 4** (`^4.2.2`) - Vue meta-framework

**Key Configuration:**

- CSR mode (SSR disabled)
- Hash mode routing
- Auto-imports for composables, stores, utils, constants, types

**Config file:** `nuxt.config.ts`

## UI & Styling

| Library           | Version | Purpose                    |
| ----------------- | ------- | -------------------------- |
| TailwindCSS       | ^4.1.18 | Utility-first CSS          |
| DaisyUI           | ^5.5.13 | Tailwind component library |
| @tabler/icons-vue | ^3.35.0 | Icon library               |

## State Management

| Library     | Version | Purpose              |
| ----------- | ------- | -------------------- |
| Pinia       | ^3.0.4  | Vue state management |
| @pinia/nuxt | ^0.11.3 | Nuxt integration     |

## Data Fetching & Tables

| Library               | Version  | Purpose                 |
| --------------------- | -------- | ----------------------- |
| @tanstack/vue-query   | ^5.92.1  | Server state management |
| @tanstack/vue-table   | ^8.21.3  | Headless table          |
| @tanstack/vue-virtual | ^3.13.13 | Virtual scrolling       |
| ky                    | ^1.14.1  | HTTP client             |

## Visualization

| Library    | Version | Purpose                        |
| ---------- | ------- | ------------------------------ |
| Highcharts | ^12.4.0 | Charts                         |
| D3         | ^7.9.0  | Network topology visualization |

## Utilities

| Library      | Version  | Purpose                        |
| ------------ | -------- | ------------------------------ |
| @vueuse/core | ^14.1.0  | Vue composition utilities      |
| dayjs        | ^1.11.19 | Date manipulation              |
| lodash-es    | ^4.17.21 | Utility functions              |
| byte-size    | ^9.0.1   | Human-readable byte formatting |
| zod          | ^4.1.13  | Schema validation              |
| uuid         | ^13.0.0  | UUID generation                |

## Internationalization

| Library      | Version | Purpose       |
| ------------ | ------- | ------------- |
| @nuxtjs/i18n | ^10.2.1 | i18n for Nuxt |

**Supported locales:** English (en), 简体中文 (zh), Русский (ru)

## Development Tools

| Tool       | Version | Purpose         |
| ---------- | ------- | --------------- |
| pnpm       | 10.25.0 | Package manager |
| Vitest     | ^4.0.15 | Unit testing    |
| Playwright | ^1.57.0 | E2E testing     |
| ESLint     | ^9.39.1 | Linting         |
| Prettier   | ^3.7.4  | Formatting      |
| Husky      | ^9.1.7  | Git hooks       |
| vue-tsc    | ^3.1.8  | Type checking   |

## Build & Bundle

- **Bundler:** Vite (via Nuxt)
- **Chunk size warning limit:** 1000KB

---

_Stack analysis: 2026-01-25_
