# Copilot Instructions for metacubexd

metacubexd is the official dashboard and managed runtime for the Mihomo proxy
kernel. Keep changes inside the owning workspace and preserve the boundary
between Mihomo's Clash API and metacubexd's Control API.

## Read First

- [CONTEXT.md](../CONTEXT.md) defines the project's domain language.
- [packages/ui/PRODUCT.md](../packages/ui/PRODUCT.md) defines the product and its
  users.
- [packages/ui/DESIGN.md](../packages/ui/DESIGN.md) defines the UI design system.
- [packages/agent/MANUAL.md](../packages/agent/MANUAL.md) contains real-kernel
  smoke tests that are intentionally outside CI.
- [README.md](../README.md) documents supported deployment forms.

## Monorepo Map

This is a pnpm 10 workspace with four workspaces:

| Workspace        | Responsibility                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/ui`    | Nuxt 4/Vue 3 dashboard shared by every runtime form                                                       |
| `packages/agent` | Framework-neutral Control API, profile store, kernel supervisor, scheduler, and shared types              |
| `apps/server`    | Nitro all-in-one server that serves the UI and mounts the agent                                           |
| `apps/desktop`   | Electron shell, local control server, OS integration, privileged TUN helper, and bundled kernel packaging |

Do not move host-specific behavior into `packages/ui`. Put reusable lifecycle,
profile, and Control API behavior in `packages/agent`; keep Docker/Nitro wiring in
`apps/server` and Electron/OS wiring in `apps/desktop`.

## Runtime Forms

There are three runtime forms:

1. **Hosted panel**: the static UI connects directly to a user-managed Mihomo.
   There is no Control Agent, so agent-only features remain hidden. The
   standalone panel Docker image is another distribution of this form.
2. **Desktop app**: Electron serves the bundled UI from a loopback control
   server, runs a local Control Agent, and supervises a bundled Mihomo. The
   preload bridge injects the per-launch Control and Clash endpoints.
3. **All-in-one server**: Nitro serves the UI and `/api/control` on the control
   port and supervises the bundled Mihomo in the same container. The Clash API
   and mixed proxy remain separate ports.

Default server ports are `8080` for UI + Control API, `9090` for the Clash API,
and `7890` for the mixed proxy. Desktop ports are selected from free loopback
ports at startup; never hard-code them in UI code.

## API Boundary

- **Clash API** is Mihomo's `external-controller` HTTP/WebSocket surface. It owns
  proxies, proxy groups, traffic, connections, rules, configs, version, and live
  Clash log data. UI access is centered on `packages/ui/composables/useApi.ts`,
  `useWebSocket.ts`, and the endpoint store.
- **Control API** is metacubexd's `/api/control/**` surface. It owns kernel
  lifecycle and subprocess logs, profiles, runtime config, subscriptions,
  kernel/Geo asset management, WebDAV backup, System Proxy, and TUN. UI access
  goes through `packages/ui/composables/useControlApi.ts`; features are gated by
  the agent's advertised capabilities.

Do not send Clash API traffic through the Control API. In server mode the UI
talks directly to the published Clash API port because Nitro does not proxy the
required WebSocket streams. Do not confuse Clash WebSocket logs with the
agent's kernel-process SSE logs.

## UI Stack and Conventions

- Nuxt 4, Vue 3, strict TypeScript, CSR-only rendering, and hash routing.
- Pinia owns shared client state; persistent state commonly uses VueUse
  `useLocalStorage`.
- TanStack Vue Query owns server-state queries and invalidation. Keep query keys
  stable and invalidate affected data after mutations.
- `ky` v2 is the HTTP client. This version uses `prefix`, not `prefixUrl`.
- Tailwind CSS v4 and daisyUI v5 provide styling. Follow semantic daisyUI roles
  and the design system rather than hard-coded theme colors.
- Vue, Nuxt, VueUse, project composables, stores, utilities, constants, types,
  and components are auto-imported according to `packages/ui/nuxt.config.ts`.
- Use `<script setup lang="ts">`, explicit props/emits types, computed values for
  derived state, and watchers only for side effects.

Do not assume Zod, `tailwind-merge`, `tailwind-variants`, or
`@tanstack/vue-table` exists in this repository. Tables and conditional classes
use project components and normal Vue/Tailwind patterns.

### Internationalization

All user-facing UI text must use `useI18n()`. Keep the seven JSON locale files
in `packages/ui/i18n/locales/` aligned:

`en.json`, `fa.json`, `fr.json`, `ja.json`, `ko.json`, `ru.json`, `zh.json`.

Add the same key to every locale and preserve valid JSON. Do not create legacy
TypeScript locale modules.

## Commands

Run commands from the repository root unless noted.

### Root scripts

```bash
pnpm install       # install the workspace
pnpm dev           # alias for dev:ui; pure-panel Nuxt development
pnpm dev:ui        # Nuxt UI development server
pnpm dev:server    # generate the UI, then start Nitro development
pnpm dev:desktop   # fetch Mihomo and run Nuxt + Electron with renderer HMR
pnpm build:ui      # nuxt generate -> packages/ui/.output/public
pnpm build:server  # build the Nitro/agent workspace only
pnpm build:desktop # electron-vite build only; does not package installers
pnpm build         # build:ui, then build:server
pnpm generate      # build:ui, then copy packages/ui/.output to root .output
pnpm typecheck     # run workspace typecheck scripts
pnpm lint          # runs available lint scripts; currently UI only and auto-fixes
```

Desktop installers require the additional renderer generation/copy, kernel
staging, and `electron-builder` steps shown in `.github/workflows/release.yml`.
The package-level `pnpm --filter @metacubexd/desktop package` script only invokes
`electron-builder`; it assumes those prerequisites already exist.

### Package checks

```bash
pnpm --filter @metacubexd/ui test:unit
pnpm --filter @metacubexd/ui test:e2e
pnpm --filter @metacubexd/ui typecheck
pnpm --filter @metacubexd/agent test
pnpm --filter @metacubexd/agent typecheck
pnpm --filter @metacubexd/server test
pnpm --filter @metacubexd/server typecheck
pnpm --filter @metacubexd/desktop test
pnpm --filter @metacubexd/desktop typecheck
```

Prefer a targeted Vitest invocation while iterating, then run the owning
workspace's full test and typecheck scripts before handoff.

## Test Locations

- UI unit specs live beside their areas under `**/__tests__/**/*.spec.ts`; UI
  browser-flow specs live in `packages/ui/e2e/`.
- Agent tests live in `packages/agent/src/**/*.test.ts` and use injected process,
  filesystem, fetch, and timer seams instead of a real kernel.
- Server tests live under `apps/server/**/__tests__/`.
- Desktop tests live under `apps/desktop/src/**/__tests__/` and must not perform
  real elevation or OS changes.

Add regression coverage in the workspace that owns the behavior. Use
`packages/agent/MANUAL.md` only when real Mihomo or network behavior must be
verified outside the deterministic test suite.

## Editing and Quality Rules

- Preserve strict TypeScript types and existing dependency-injection seams.
- Keep Control API route and UI contract changes synchronized.
- Route profile and kernel state changes through the agent/controller rather
  than mutating them from a view.
- `pnpm lint` invokes ESLint with `--fix`; inspect resulting changes and do not
  run it casually across unrelated work.
- Do not hand-edit generated output: `.nuxt/`, `.nitro/`, `.output/`,
  `packages/ui/.output/`, `apps/server/.output/`, `apps/desktop/out/`,
  `apps/desktop/renderer/`, or `apps/desktop/dist/`.
- Do not hand-edit downloaded kernel artifacts in `apps/desktop/resources/`
  (`mihomo`, `mihomo.exe`, `wintun.dll`, or `.mihomo-target`). The tracked
  `default-config.yaml` is source and may be edited intentionally.
- Do not edit `CHANGELOG.md`; release-please owns it.
- Do not edit `pnpm-lock.yaml` manually; regenerate it through pnpm when a
  dependency change is intentional.
