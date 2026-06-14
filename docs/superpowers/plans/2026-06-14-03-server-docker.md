---
# apps/server (Standalone Nitro) + Multi-Arch Docker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/server` — a standalone Nitro app that hosts the prebuilt `packages/ui` static dashboard, mounts the `@metacubexd/agent` control API at `/api/control`, supervises a bundled mihomo kernel, and ships as a 4-stage multi-arch Docker image with a healthcheck and compose file.

**Architecture:** A standalone Nitro project (`preset: node-server`) serves `UI_DIST` as public assets and exposes the agent's framework-neutral h3 control router behind a Bearer/`?token` auth middleware (everything except `/api/control/health` and static UI). A module-singleton `lib/supervisor.ts` calls `createAgent()` from `@metacubexd/agent`, wiring `DATA_DIR`/`MIHOMO_BIN`/ports from env and injecting `external-controller: 0.0.0.0:<CLASH_API_PORT>` + `CLASH_SECRET` into the active config so the dashboard talks to mihomo's Clash API directly (never proxied through Nitro). The Docker image builds UI + server on the native builder arch, fetches the per-`TARGETARCH` mihomo kernel in a normal stage, and assembles a slim `node:22-alpine` runtime with `tini` as PID 1.

**Tech Stack:** Nitro (`node-server` preset), h3 (agent router), `@metacubexd/agent` (workspace source-exported TS), vitest@^4, Docker buildx multi-arch, Alpine + tini, mihomo `v1.19.27`.

**Depends on:** Plan 01 (monorepo migration: `packages/ui`, `packages/agent`, `apps/*`, `tsconfig.base.json`, pnpm workspace + catalog must exist) **and** Plan 02 (`@metacubexd/agent` must export `createAgent`, `createControlRouter`, the `KernelState`/`SupervisorOptions` types, and `MIHOMO_VERSION` per the SHARED CONTRACTS). This plan consumes those; it does not build them.

---

---

## File Structure

Files **Created** by this plan (all paths post-migration, under `apps/server/`):

| Path                                            | Responsibility                                                                                                                                                                                                                                                        |
| :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/package.json`                      | `@metacubexd/server` manifest: depends on `@metacubexd/agent` (`workspace:*`) + `nitro`; `build` → `.output`; catalog refs.                                                                                                                                           |
| `apps/server/tsconfig.json`                     | Extends root `tsconfig.base.json`; includes Nitro types.                                                                                                                                                                                                              |
| `apps/server/nitro.config.ts`                   | `preset: node-server`, pinned `compatibilityDate`, `publicAssets` serving `UI_DIST`, comment explaining the deliberate NO-clash-proxy decision.                                                                                                                       |
| `apps/server/lib/supervisor.ts`                 | Module-singleton `getAgent()` over `DATA_DIR`/`MIHOMO_BIN`/env; passes `externalController: 0.0.0.0:<CLASH_API_PORT>` + `secret: <CLASH_SECRET>` into `createAgent` (the agent's supervisor injects them into the active config before spawn); exposes `serverEnv()`. |
| `apps/server/lib/__tests__/supervisor.spec.ts`  | Unit test: env wiring + singleton wiring of `externalController`/`secret` into `createAgent`.                                                                                                                                                                         |
| `apps/server/middleware/auth.ts`                | Bearer/`?token` guard for `/api/control/**` except `/api/control/health` and static UI.                                                                                                                                                                               |
| `apps/server/middleware/__tests__/auth.spec.ts` | Unit test: handler called with/without/wrong token across guarded and public paths.                                                                                                                                                                                   |
| `apps/server/routes/control/[...].ts`           | Catch-all that mounts the agent's h3 control router under `/api/control`.                                                                                                                                                                                             |
| `apps/server/routes/[...].ts`                   | SPA fallback: serves `UI_DIST/index.html` for unmatched non-API GETs.                                                                                                                                                                                                 |
| `apps/server/Dockerfile`                        | 4-stage multi-arch: ui build / server build / per-`TARGETARCH` kernel fetch / slim runtime with tini PID 1 + healthcheck on `/api/control/health`.                                                                                                                    |
| `apps/server/docker-entrypoint.sh`              | Runtime entrypoint: ensures `/data`, then `exec node` the Nitro output.                                                                                                                                                                                               |
| `apps/server/.dockerignore`                     | Excludes node_modules/build artifacts from the Docker build context.                                                                                                                                                                                                  |
| `apps/server/compose.yaml`                      | Single-service compose with env table + ports `8080/9090/7890` + named `/data` volume.                                                                                                                                                                                |

Files **Modified**:

| Path                  | Change                                                                                    |
| :-------------------- | :---------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml` | Add `nitro`, `tini`-free runtime deps to catalog if missing (catalog refs `nitro`, `h3`). |

> **Note on the spec's healthcheck path.** Spec §5 writes the Docker `HEALTHCHECK` and entrypoint against `/control/health`. Per the SHARED CONTRACTS the canonical prefix is `/api/control`, so the healthcheck path in THIS plan is **`/api/control/health`** everywhere. This is a deliberate correction of the spec.

---

## Tasks

### Task 1: Scaffold `apps/server` package manifest

**Files:**

- Create: `apps/server/package.json`
- Modify: `pnpm-workspace.yaml` (catalog: ensure `nitro` + `h3` entries)

This task is config, not unit-testable via vitest. Verification = a real `pnpm install` resolving the new package, plus a parse check of the manifest.

- [ ] **Step 1: Write the package manifest.** Create `apps/server/package.json` with exactly:

```json
{
  "name": "@metacubexd/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nitro build",
    "dev": "nitro dev",
    "preview": "node .output/server/index.mjs",
    "typecheck": "nitro prepare && tsc --noEmit"
  },
  "dependencies": {
    "@metacubexd/agent": "workspace:*",
    "h3": "catalog:",
    "nitro": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Add catalog entries for `nitro`.** Read `pnpm-workspace.yaml`. It already has `h3` from Plan 01/02. Under the `catalog:` block add the `nitro` line (alphabetical near `h3`). The exact line to add:

```yaml
nitro: ^2.12.6
```

(If a `catalog:` block does not yet exist because Plan 01 used inline versions, instead set `"nitro": "^2.12.6"` directly in `apps/server/package.json` dependencies and `"h3"` to the same version Plan 02 pinned, then skip the catalog edit.)

- [ ] **Step 3: Verify install resolves the package.** Run:

```bash
pnpm install
```

Expected: install completes with no error; `pnpm-lock.yaml` gains an `apps/server` importer entry and a `@metacubexd/server` workspace link. Confirm with:

```bash
pnpm ls --filter @metacubexd/server --depth -1
```

Expected output contains `@metacubexd/server@0.0.0` and a resolved `@metacubexd/agent link:../../packages/agent` (or `workspace:*`).

- [ ] **Step 4: Verify the manifest is valid JSON.** Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/server/package.json','utf8')); console.log('ok')"
```

Expected: `ok`.

- [ ] **Step 5: Commit.**

```bash
git add apps/server/package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(server): scaffold @metacubexd/server package manifest"
```

---

### Task 2: Add `apps/server/tsconfig.json`

**Files:**

- Create: `apps/server/tsconfig.json`

Config task. Verification = `tsc` parses it and `nitro prepare` (Task 4) later consumes it.

- [ ] **Step 1: Write the tsconfig.** Create `apps/server/tsconfig.json` with exactly:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "noEmit": true
  },
  "include": [
    "nitro.config.ts",
    "lib/**/*.ts",
    "middleware/**/*.ts",
    "routes/**/*.ts",
    ".nitro/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".output", ".nitro"]
}
```

- [ ] **Step 2: Verify it parses.** Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/server/tsconfig.json','utf8')); console.log('ok')"
```

Expected: `ok`. (Full `tsc` runs after Nitro generates types in Task 4 — running `tsc --noEmit` now would fail on missing Nitro virtual modules, which is expected and not a regression.)

- [ ] **Step 3: Confirm the base config exists.** Run:

```bash
test -f tsconfig.base.json && echo "base-present"
```

Expected: `base-present`. (If absent, Plan 01 is incomplete — STOP and finish Plan 01 first.)

- [ ] **Step 4: Commit.**

```bash
git add apps/server/tsconfig.json
git commit -m "feat(server): add tsconfig extending the monorepo base"
```

---

### Task 3: Write `apps/server/lib/supervisor.ts` (env wiring + agent singleton) — TDD

**Files:**

- Create: `apps/server/lib/supervisor.ts`
- Test: `apps/server/lib/__tests__/supervisor.spec.ts`

This module owns: (a) reading server env into a typed config, and (b) a module-singleton `getAgent()` that calls `createAgent()` exactly once, passing `externalController: 0.0.0.0:<CLASH_API_PORT>` + `secret: <CLASH_SECRET>` through so the agent's supervisor injects them into the active config before spawn (per Plan 02 — the server does NOT inject the config itself). The env parsing is unit-tested; the singleton wiring is asserted by checking `createAgent` is invoked once with the env-derived options (via a mock).

- [ ] **Step 1: Write the failing test.** Create `apps/server/lib/__tests__/supervisor.spec.ts` with exactly:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the agent so we can assert how the server wires env -> createAgent,
// without spawning a real kernel.
const createAgentMock = vi.fn(() => ({
  supervisor: { getState: () => ({ status: 'stopped' }) },
  profiles: {},
  router: { __isRouter: true },
  info: () => ({ hasAgent: true }),
}))
vi.mock('@metacubexd/agent', () => ({
  createAgent: createAgentMock,
}))

describe('apps/server lib/supervisor', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    createAgentMock.mockClear()
    process.env = { ...ORIGINAL }
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  it('reads server env into a typed config with documented defaults', async () => {
    delete process.env.CONTROL_PORT
    delete process.env.CLASH_API_PORT
    delete process.env.MIXED_PORT
    delete process.env.DATA_DIR
    delete process.env.MIHOMO_BIN
    delete process.env.CLASH_SECRET
    delete process.env.CONTROL_TOKEN
    const { serverEnv } = await import('../supervisor')
    const env = serverEnv()
    expect(env.controlPort).toBe(8080)
    expect(env.clashApiPort).toBe(9090)
    expect(env.mixedPort).toBe(7890)
    expect(env.dataDir).toBe('/data')
    expect(env.mihomoBin).toBe('/usr/local/bin/mihomo')
  })

  it('honours overridden ports/paths from env', async () => {
    process.env.CONTROL_PORT = '18080'
    process.env.CLASH_API_PORT = '19090'
    process.env.MIXED_PORT = '17890'
    process.env.DATA_DIR = '/srv/data'
    process.env.MIHOMO_BIN = '/opt/mihomo'
    const { serverEnv } = await import('../supervisor')
    const env = serverEnv()
    expect(env.controlPort).toBe(18080)
    expect(env.clashApiPort).toBe(19090)
    expect(env.mixedPort).toBe(17890)
    expect(env.dataDir).toBe('/srv/data')
    expect(env.mihomoBin).toBe('/opt/mihomo')
  })

  it('builds the agent exactly once with env-derived options (singleton)', async () => {
    process.env.DATA_DIR = '/data'
    process.env.MIHOMO_BIN = '/usr/local/bin/mihomo'
    process.env.CLASH_API_PORT = '9090'
    process.env.CLASH_SECRET = 'clash-x'
    process.env.CONTROL_TOKEN = 'agent-tok'
    const { getAgent } = await import('../supervisor')
    const a = getAgent()
    const b = getAgent()
    expect(a).toBe(b)
    expect(createAgentMock).toHaveBeenCalledTimes(1)
    const opts = createAgentMock.mock.calls[0][0]
    expect(opts.binaryPath).toBe('/usr/local/bin/mihomo')
    expect(opts.homeDir).toBe('/data')
    expect(opts.profilesDir).toBe('/data/profiles')
    expect(opts.activeConfigPath).toBe('/data/active.yaml')
    expect(opts.agentToken).toBe('agent-tok')
    expect(opts.externalController).toBe('0.0.0.0:9090')
    expect(opts.secret).toBe('clash-x')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.** Run:

```bash
pnpm --filter @metacubexd/server exec vitest run lib/__tests__/supervisor.spec.ts
```

Expected failure: `Failed to resolve import "../supervisor"` (the module does not exist yet) or `serverEnv is not a function`.

- [ ] **Step 3: Write the minimal implementation.** Create `apps/server/lib/supervisor.ts` with exactly:

```ts
import { join } from 'node:path'
import { createAgent } from '@metacubexd/agent'

/** Parsed server runtime config, sourced entirely from env. */
export interface ServerEnv {
  controlPort: number
  clashApiPort: number
  mixedPort: number
  dataDir: string
  mihomoBin: string
  controlToken: string
  clashSecret: string
}

function int(value: string | undefined, fallback: number): number {
  const n = value == null ? NaN : Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Read process.env into a typed ServerEnv with documented defaults. */
export function serverEnv(): ServerEnv {
  return {
    controlPort: int(process.env.CONTROL_PORT, 8080),
    clashApiPort: int(process.env.CLASH_API_PORT, 9090),
    mixedPort: int(process.env.MIXED_PORT, 7890),
    dataDir: process.env.DATA_DIR ?? '/data',
    mihomoBin: process.env.MIHOMO_BIN ?? '/usr/local/bin/mihomo',
    controlToken: process.env.CONTROL_TOKEN ?? '',
    clashSecret: process.env.CLASH_SECRET ?? '',
  }
}

export type Agent = ReturnType<typeof createAgent>

let agentSingleton: Agent | undefined

/**
 * Module-singleton agent. Built once per process from serverEnv():
 * homeDir/profilesDir/activeConfigPath live under DATA_DIR; the kernel binary
 * is MIHOMO_BIN; agentToken comes from CONTROL_TOKEN (empty => unauthenticated,
 * which the auth middleware treats as "no token configured").
 */
export function getAgent(): Agent {
  if (agentSingleton) return agentSingleton
  const env = serverEnv()
  agentSingleton = createAgent({
    binaryPath: env.mihomoBin,
    homeDir: env.dataDir,
    profilesDir: join(env.dataDir, 'profiles'),
    activeConfigPath: join(env.dataDir, 'active.yaml'),
    agentToken: env.controlToken || undefined,
    // The agent's supervisor injects these into the active config before
    // spawning mihomo (per Plan 02). external-controller must bind 0.0.0.0 so
    // the published container port is reachable; secret is CLASH_SECRET.
    externalController: `0.0.0.0:${env.clashApiPort}`,
    secret: env.clashSecret,
  })
  return agentSingleton
}

/** Test-only reset hook. */
export function __resetAgentForTests(): void {
  agentSingleton = undefined
}
```

- [ ] **Step 4: Run the test to verify it passes.** Run:

```bash
pnpm --filter @metacubexd/server exec vitest run lib/__tests__/supervisor.spec.ts
```

Expected: all 3 tests pass (`3 passed`).

- [ ] **Step 5: Commit.**

```bash
git add apps/server/lib/supervisor.ts apps/server/lib/__tests__/supervisor.spec.ts
git commit -m "feat(server): add singleton agent wiring clash-api external-controller/secret"
```

> **Note for the implementer:** `getAgent()` only builds the agent and hands it `externalController: 0.0.0.0:<CLASH_API_PORT>` + `secret: <CLASH_SECRET>`. The actual `external-controller`/`secret` injection into the active config at kernel-start time is the agent's job — Plan 02's supervisor strips any existing top-level `external-controller`/`secret`/`mixed-port` keys and prepends ours before spawn. The server therefore owns NO config-rewrite helper (an earlier draft had a server-side `injectClashApi`; it is deleted because Plan 02 now injects). Keep the env-wiring + singleton tests as the contract here.

---

### Task 4: Write `apps/server/nitro.config.ts` (preset, publicAssets, NO clash proxy)

**Files:**

- Create: `apps/server/nitro.config.ts`

Config task. Verification = `nitro prepare` succeeds and emits `.nitro/types`, and the config asserts the no-proxy comment + pinned compatibilityDate via a grep.

- [ ] **Step 1: Write the Nitro config.** Create `apps/server/nitro.config.ts` with exactly:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'nitro'

// UI_DIST overrides the bundled static dashboard at runtime (set in Docker).
// Dev fallback resolves the sibling packages/ui generate output.
const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))

export default defineConfig({
  preset: 'node-server',
  // Pin so Nitro feature flags do not drift between builds.
  compatibilityDate: '2025-01-01',
  // Serve the prebuilt dashboard. maxAge: 1 year (hashed assets are immutable).
  publicAssets: [{ baseURL: '/', dir: uiDist, maxAge: 60 * 60 * 24 * 365 }],
  // NOTE: Intentionally NO Clash-API proxy here. Nitro routeRules `proxy`
  // cannot upgrade WebSocket connections (nitrojs/nitro#2886), and the
  // dashboard talks to mihomo's Clash API over native WebSocket (traffic,
  // connections, logs). Proxying would yield a half-broken endpoint (HTTP ok,
  // WS dead). Instead the agent injects `external-controller: 0.0.0.0:<port>`
  // into the active config and the published 9090 port is hit directly by the
  // UI endpoint store. Do NOT add a /clash-api proxy route.
})
```

- [ ] **Step 2: Verify Nitro prepares the project.** Run:

```bash
pnpm --filter @metacubexd/server exec nitro prepare
```

Expected: completes with `✔ Generated ...` / no error; a `.nitro/types/nitro.d.ts` is created under `apps/server/`. Confirm:

```bash
test -d apps/server/.nitro && echo "nitro-prepared"
```

Expected: `nitro-prepared`.

- [ ] **Step 3: Assert the no-proxy guardrail comment is present.** Run:

```bash
grep -q "Intentionally NO Clash-API proxy" apps/server/nitro.config.ts && grep -q "compatibilityDate: '2025-01-01'" apps/server/nitro.config.ts && echo "guards-present"
```

Expected: `guards-present`.

- [ ] **Step 4: Commit.**

```bash
git add apps/server/nitro.config.ts
git commit -m "feat(server): add nitro config serving UI static assets with no clash-api proxy"
```

---

### Task 5: Write `apps/server/middleware/auth.ts` (Bearer/?token guard) — TDD

**Files:**

- Create: `apps/server/middleware/auth.ts`
- Test: `apps/server/middleware/__tests__/auth.spec.ts`

The middleware logic is split into a pure, fully-testable `isAuthorized(...)` function and a thin Nitro `defineEventHandler` wrapper. The test exercises `isAuthorized` directly across every branch (guarded vs public path, present/absent/wrong token, `?token` query for SSE, empty configured token).

> **Note on `/api/control/info` auth:** This server intentionally guards `/api/control/info` (only `/api/control/health` is in `PUBLIC_CONTROL_PATHS`), unlike the agent's in-process default which treats `/info` as public. Because Nitro middleware runs _before_ the mounted agent router and `CONTROL_TOKEN` is forwarded to the agent as `agentToken`, the agent's internal auth is effectively a no-op here (Nitro has already authorized the request). The server being stricter on `/info` is deliberate and is what Task 8 Step 6 / Task 13 Step 5 assert (`info-noauth=401`).

- [ ] **Step 1: Write the failing test.** Create `apps/server/middleware/__tests__/auth.spec.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest'
import { isAuthorized } from '../auth'

const TOKEN = 'agent-tok'

describe('apps/server middleware/auth -> isAuthorized', () => {
  it('allows the public health endpoint with no token', () => {
    expect(
      isAuthorized({
        path: '/api/control/health',
        authHeader: undefined,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('allows static UI paths (non /api/control) with no token', () => {
    for (const path of [
      '/',
      '/index.html',
      '/assets/app.123.js',
      '/#/proxies',
    ]) {
      expect(
        isAuthorized({
          path,
          authHeader: undefined,
          queryToken: undefined,
          configuredToken: TOKEN,
        }),
      ).toEqual({ ok: true })
    }
  })

  it('rejects a guarded control path with no credentials', () => {
    const r = isAuthorized({
      path: '/api/control/info',
      authHeader: undefined,
      queryToken: undefined,
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
  })

  it('rejects a guarded control path with the wrong Bearer token', () => {
    const r = isAuthorized({
      path: '/api/control/kernel/status',
      authHeader: 'Bearer nope',
      queryToken: undefined,
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
  })

  it('accepts a guarded control path with the correct Bearer token', () => {
    expect(
      isAuthorized({
        path: '/api/control/profiles',
        authHeader: `Bearer ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('accepts the SSE log stream via ?token= query when Bearer is absent', () => {
    expect(
      isAuthorized({
        path: '/api/control/kernel/logs',
        authHeader: undefined,
        queryToken: TOKEN,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects the SSE log stream with a wrong ?token=', () => {
    const r = isAuthorized({
      path: '/api/control/kernel/logs',
      authHeader: undefined,
      queryToken: 'nope',
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
  })

  it('is case-insensitive on the Bearer scheme', () => {
    expect(
      isAuthorized({
        path: '/api/control/info',
        authHeader: `bearer ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('keeps /api/control/health public even when a token IS configured', () => {
    expect(
      isAuthorized({
        path: '/api/control/health',
        authHeader: 'Bearer wrong',
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('locks down guarded paths when no token is configured (fail closed)', () => {
    const r = isAuthorized({
      path: '/api/control/info',
      authHeader: undefined,
      queryToken: undefined,
      configuredToken: '',
    })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(503)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails.** Run:

```bash
pnpm --filter @metacubexd/server exec vitest run middleware/__tests__/auth.spec.ts
```

Expected failure: `Failed to resolve import "../auth"` / `isAuthorized is not a function`.

- [ ] **Step 3: Write the minimal implementation.** Create `apps/server/middleware/auth.ts` with exactly:

```ts
import { createError, defineEventHandler, getQuery, getRequestHeader } from 'h3'
import { serverEnv } from '../lib/supervisor'

const CONTROL_PREFIX = '/api/control'
const PUBLIC_CONTROL_PATHS = new Set([`${CONTROL_PREFIX}/health`])

export interface AuthInput {
  path: string
  authHeader: string | undefined
  queryToken: string | undefined
  configuredToken: string
}

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string }

/**
 * Pure auth decision. Static UI (anything not under /api/control) is public.
 * /api/control/health is public. Every other /api/control/** request requires
 * a matching token via `Authorization: Bearer <token>` OR (for SSE, which
 * cannot set headers in EventSource) a `?token=<token>` query param.
 */
export function isAuthorized(input: AuthInput): AuthResult {
  const { path, authHeader, queryToken, configuredToken } = input

  // Static UI + any non-control route: always public.
  if (!path.startsWith(CONTROL_PREFIX)) return { ok: true }

  // Public control endpoints (health).
  if (PUBLIC_CONTROL_PATHS.has(path)) return { ok: true }

  // Fail closed if the operator never configured a token.
  if (!configuredToken)
    return {
      ok: false,
      status: 503,
      message: 'CONTROL_TOKEN is not configured',
    }

  const bearer = parseBearer(authHeader)
  const presented = bearer ?? queryToken
  if (presented && presented === configuredToken) return { ok: true }

  return { ok: false, status: 401, message: 'Unauthorized' }
}

function parseBearer(header: string | undefined): string | undefined {
  if (!header) return undefined
  const m = /^bearer\s+(.+)$/i.exec(header.trim())
  return m ? m[1] : undefined
}

export default defineEventHandler((event) => {
  const result = isAuthorized({
    path: event.path.split('?')[0],
    authHeader: getRequestHeader(event, 'authorization'),
    queryToken: (getQuery(event).token as string | undefined) ?? undefined,
    configuredToken: serverEnv().controlToken,
  })
  if (!result.ok) {
    throw createError({
      statusCode: result.status,
      statusMessage: result.message,
    })
  }
})
```

- [ ] **Step 4: Run the test to verify it passes.** Run:

```bash
pnpm --filter @metacubexd/server exec vitest run middleware/__tests__/auth.spec.ts
```

Expected: all tests pass (`11 passed`).

- [ ] **Step 5: Commit.**

```bash
git add apps/server/middleware/auth.ts apps/server/middleware/__tests__/auth.spec.ts
git commit -m "feat(server): add bearer/token auth middleware guarding /api/control"
```

> **Implementer note on middleware registration:** Nitro auto-loads files under `middleware/` and runs them on every request before route handlers. The default export above is the Nitro middleware. If Plan 01's Nitro version requires explicit registration, add to `nitro.config.ts`:
>
> ```ts
> handlers: [{ route: '/**', handler: './middleware/auth.ts', middleware: true }],
> ```
>
> Verify with the manual run in Task 8 (request `/api/control/info` without a token → 401; `/api/control/health` → 200).

---

### Task 6: Mount the agent router at `/api/control` via `routes/control/[...].ts`

**Files:**

- Create: `apps/server/routes/control/[...].ts`

The agent exposes `createAgent().router` — a framework-neutral **h3 app/router** (per SHARED CONTRACTS). We bridge it to Nitro by converting it to a Node listener once and delegating the raw request/response. This is integration glue against Nitro/h3 internals, so it is verified by a live request in Task 8 rather than a unit test (the singleton + auth pure logic are already covered in Tasks 3 & 5).

- [ ] **Step 1: Write the catch-all control handler.** Create `apps/server/routes/control/[...].ts` with exactly:

```ts
import { defineEventHandler, fromNodeMiddleware } from 'h3'
import { toNodeListener } from 'h3'
import { getAgent } from '../../lib/supervisor'

// The agent router is an h3 app whose internal routes are absolute,
// i.e. it answers '/api/control/...'. Because this file lives at
// routes/control/[...].ts it only receives requests already under
// '/api/control', and we forward the ORIGINAL url (event.node.req.url still
// carries the full '/api/control/...' path) to the agent listener.
const listener = toNodeListener(getAgent().router)

export default defineEventHandler(
  fromNodeMiddleware((req, res, next) => {
    listener(req, res).catch(next)
  }),
)
```

- [ ] **Step 2: Verify Nitro still prepares with the new route.** Run:

```bash
pnpm --filter @metacubexd/server exec nitro prepare
```

Expected: no error; route is discovered (Nitro logs the `/control/**` handler). If the build complains that `fromNodeMiddleware` is unavailable in the pinned h3 major, use the documented alternative below (Step 3) and re-run.

- [ ] **Step 3 (only if Step 2 errored on `fromNodeMiddleware`): use the web-handler bridge.** Replace the file body with:

```ts
import { defineEventHandler, toWebHandler } from 'h3'
import { getAgent } from '../../lib/supervisor'

const webHandler = toWebHandler(getAgent().router)

export default defineEventHandler(async (event) => {
  return webHandler(toWebRequest(event))
})

// Minimal Nitro event -> web Request adapter for delegation.
function toWebRequest(event: any): Request {
  const url = new URL(event.path, 'http://internal')
  const headers = new Headers(event.node.req.headers as any)
  const method = event.method
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : (event.node.req as any)
  return new Request(url, { method, headers, body, duplex: 'half' } as any)
}
```

Re-run `pnpm --filter @metacubexd/server exec nitro prepare` and expect no error.

- [ ] **Step 4: Assert the file mounts the singleton agent router.** Run:

```bash
grep -q "getAgent().router" apps/server/routes/control/\[...\].ts && echo "router-mounted"
```

Expected: `router-mounted`.

- [ ] **Step 5: Commit.**

```bash
git add 'apps/server/routes/control/[...].ts'
git commit -m "feat(server): mount agent control router under /api/control"
```

---

### Task 7: SPA fallback `routes/[...].ts` → `index.html`

**Files:**

- Create: `apps/server/routes/[...].ts`

The UI is a hash-router CSR SPA, so deep-link 404s are rare, but this catch-all serves `index.html` for unmatched non-`/api/control` GETs as a safety net. Verified by a live request in Task 8.

- [ ] **Step 1: Write the SPA fallback.** Create `apps/server/routes/[...].ts` with exactly:

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createError, defineEventHandler, setHeader } from 'h3'

const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))

export default defineEventHandler(async (event) => {
  // Never swallow control API requests — those are handled by routes/control.
  if (event.path.startsWith('/api/control')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  // Only HTML navigations fall back to the SPA shell.
  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const html = await readFile(join(uiDist, 'index.html'), 'utf8')
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return html
})
```

- [ ] **Step 2: Verify Nitro prepares with both catch-alls.** Run:

```bash
pnpm --filter @metacubexd/server exec nitro prepare
```

Expected: no error.

- [ ] **Step 3: Guard against accidental control swallowing.** Run:

```bash
grep -q "startsWith('/api/control')" apps/server/routes/\[...\].ts && echo "control-guarded"
```

Expected: `control-guarded`.

- [ ] **Step 4: Commit.**

```bash
git add 'apps/server/routes/[...].ts'
git commit -m "feat(server): add SPA fallback serving UI index.html"
```

---

### Task 8: MANUAL build-and-run verification of the standalone server

**Files:** none (verification task).

This proves the whole Nitro app boots, serves the dashboard, enforces auth, and the agent answers — without Docker. Run from the repo root. The mihomo binary must be reachable; if not installed locally, point `MIHOMO_BIN` at one fetched by the agent's `fetchKernel` (Plan 02) or skip kernel-start assertions and verify only the HTTP surface.

- [ ] **Step 1: Build the UI static assets (dependency of the server).** Run:

```bash
pnpm --filter @metacubexd/ui generate
```

Expected: `✔ ... generated` and `packages/ui/.output/public/index.html` exists. Confirm:

```bash
test -f packages/ui/.output/public/index.html && echo "ui-built"
```

Expected: `ui-built`.

- [ ] **Step 2: Build the server (this pulls ui+agent via filter `...`).** Run:

```bash
pnpm --filter @metacubexd/server... build
```

Expected: Nitro prints `✔ Nitro server built` and `apps/server/.output/server/index.mjs` exists. Confirm:

```bash
test -f apps/server/.output/server/index.mjs && echo "server-built"
```

Expected: `server-built`.

- [ ] **Step 3: Run the built server with env.** In one terminal run:

```bash
CONTROL_PORT=8080 CLASH_API_PORT=9090 MIXED_PORT=7890 \
CONTROL_TOKEN=dev-token CLASH_SECRET=dev-clash \
DATA_DIR="$PWD/.tmp-data" \
MIHOMO_BIN="$(command -v mihomo || echo /usr/local/bin/mihomo)" \
UI_DIST="$PWD/packages/ui/.output/public" \
node apps/server/.output/server/index.mjs
```

Expected: a line like `Listening on http://[::]:8080` (or `0.0.0.0:8080`). Leave it running.

- [ ] **Step 4: Verify the dashboard loads.** In a second terminal:

```bash
curl -fsS http://127.0.0.1:8080/ | grep -qi "<div id=\"__nuxt\"\|<title" && echo "dashboard-ok"
```

Expected: `dashboard-ok` (the SPA shell HTML returns 200).

- [ ] **Step 5: Verify the public healthcheck.** Run:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/control/health
```

Expected: `200`.

- [ ] **Step 6: Verify auth is enforced.** Run:

```bash
curl -s -o /dev/null -w "no-token=%{http_code}\n" http://127.0.0.1:8080/api/control/info
curl -s -o /dev/null -w "with-token=%{http_code}\n" -H "Authorization: Bearer dev-token" http://127.0.0.1:8080/api/control/info
```

Expected: `no-token=401` and `with-token=200`.

- [ ] **Step 7: Verify the agent `/info` shape.** Run:

```bash
curl -fsS -H "Authorization: Bearer dev-token" http://127.0.0.1:8080/api/control/info
```

Expected JSON containing `"hasAgent":true`, a `platform` object, and `"features":[...]` (per the SHARED CONTRACTS `info()` shape). Stop the server with Ctrl-C and clean up:

```bash
rm -rf .tmp-data
```

- [ ] **Step 8: Commit nothing (verification only); record the result.** No commit. If any step failed, fix the corresponding earlier task before proceeding to Docker.

---

### Task 9: Write `apps/server/docker-entrypoint.sh`

**Files:**

- Create: `apps/server/docker-entrypoint.sh`

Runtime entrypoint. Verified by shellcheck-style parse + content asserts (a vitest is unnecessary; this mirrors the existing repo convention but the file is trivial).

- [ ] **Step 1: Write the entrypoint.** Create `apps/server/docker-entrypoint.sh` with exactly:

```sh
#!/bin/sh
set -eu

# Ensure the persisted data directory exists and is writable.
# mihomo's home (geo/fakeip caches), profiles/, and active.yaml all live here.
mkdir -p "${DATA_DIR:-/data}/profiles"

# Hand off to the Nitro node server as PID-1's child (tini reaps the kernel
# subprocess this server spawns).
exec node /app/server/index.mjs
```

- [ ] **Step 2: Make it executable and parse-check it.** Run:

```bash
chmod +x apps/server/docker-entrypoint.sh
sh -n apps/server/docker-entrypoint.sh && echo "entrypoint-syntax-ok"
```

Expected: `entrypoint-syntax-ok`.

- [ ] **Step 3: Assert it execs the Nitro output and creates DATA_DIR.** Run:

```bash
grep -q "exec node /app/server/index.mjs" apps/server/docker-entrypoint.sh && grep -q 'mkdir -p' apps/server/docker-entrypoint.sh && echo "entrypoint-ok"
```

Expected: `entrypoint-ok`.

- [ ] **Step 4: Commit.**

```bash
git add apps/server/docker-entrypoint.sh
git commit -m "feat(server): add docker entrypoint ensuring data dir then exec nitro"
```

---

### Task 10: Write `apps/server/.dockerignore`

**Files:**

- Create: `apps/server/.dockerignore`

The Docker build context is the **repo root** (it COPYs `packages/`, `apps/`, lockfiles). This `.dockerignore` keeps the context lean. Verified by content asserts.

- [ ] **Step 1: Write the dockerignore.** Create `apps/server/.dockerignore` with exactly:

```gitignore
**/node_modules
**/.output
**/.nitro
**/.nuxt
**/dist
**/.git
**/.github
**/.husky
**/docs
**/*.log
**/.DS_Store
**/coverage
**/.tmp-data
apps/desktop
```

- [ ] **Step 2: Assert key excludes are present.** Run:

```bash
grep -q "node_modules" apps/server/.dockerignore && grep -q ".output" apps/server/.dockerignore && grep -q "apps/desktop" apps/server/.dockerignore && echo "dockerignore-ok"
```

Expected: `dockerignore-ok`.

- [ ] **Step 3: Commit.**

```bash
git add apps/server/.dockerignore
git commit -m "feat(server): add .dockerignore to slim the docker build context"
```

> **Implementer note:** Docker reads the `.dockerignore` next to the build context root. Because we build with `-f apps/server/Dockerfile <repo-root>`, also keep the repo-root `/.dockerignore` (already exists, contains `node_modules`) in sync — but BuildKit prefers `apps/server/Dockerfile.dockerignore` if present; the simplest reliable setup (used in Task 12's verify) passes the repo root as context, so ensure the root `/.dockerignore` mirrors these excludes. Update the root `/.dockerignore` to match in Task 11 Step 6.

---

### Task 11: Write `apps/server/Dockerfile` (4-stage multi-arch)

**Files:**

- Create: `apps/server/Dockerfile`
- Modify: `/.dockerignore` (root) to mirror the new excludes

This is infra, not unit-testable. Verification = `docker buildx build` (single-arch first for speed) succeeds and the resulting image's healthcheck path matches the contract. The full multi-arch build runs in Task 12.

- [ ] **Step 1: Write the Dockerfile.** Create `apps/server/Dockerfile` with exactly:

```dockerfile
# syntax=docker/dockerfile:1
# Build context MUST be the repo root: docker buildx build -f apps/server/Dockerfile .

# ---- Stage 1: build the static UI (on the builder's native arch) ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS ui
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/ui generate
# -> /repo/packages/ui/.output/public

# ---- Stage 2: build the standalone Nitro server + agent ----
FROM --platform=$BUILDPLATFORM node:22-alpine AS server
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @metacubexd/server... build
# -> /repo/apps/server/.output

# ---- Stage 3: fetch the TARGET-arch mihomo kernel (normal stage = real TARGETARCH) ----
FROM alpine:3.20 AS kernel
ARG TARGETARCH
ARG MIHOMO_VERSION=v1.19.27
RUN apk add --no-cache curl ca-certificates gzip
RUN set -eux; \
    if   [ "$TARGETARCH" = "amd64" ]; then ASSET=mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz; \
    elif [ "$TARGETARCH" = "arm64" ]; then ASSET=mihomo-linux-arm64-${MIHOMO_VERSION}.gz; \
    else echo "unsupported arch $TARGETARCH" >&2; exit 1; fi; \
    curl -fsSL "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${ASSET}" -o /tmp/k.gz; \
    gunzip -c /tmp/k.gz > /usr/local/bin/mihomo; \
    chmod +x /usr/local/bin/mihomo; \
    /usr/local/bin/mihomo -v

# ---- Stage 4: slim runtime ----
FROM node:22-alpine AS runtime
RUN apk add --no-cache ca-certificates tzdata tini wget
WORKDIR /app
COPY --from=server  /repo/apps/server/.output ./
COPY --from=ui      /repo/packages/ui/.output/public ./ui-dist
COPY --from=kernel  /usr/local/bin/mihomo /usr/local/bin/mihomo
COPY apps/server/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENV NODE_ENV=production \
    UI_DIST=/app/ui-dist \
    MIHOMO_BIN=/usr/local/bin/mihomo \
    DATA_DIR=/data \
    CONTROL_PORT=8080 \
    CLASH_API_PORT=9090 \
    MIXED_PORT=7890
VOLUME ["/data"]
EXPOSE 8080 9090 7890
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${CONTROL_PORT}/api/control/health" || exit 1
# tini is PID 1 so the mihomo subprocess spawned by the server is reaped on kill/restart.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/docker-entrypoint.sh"]
```

- [ ] **Step 2: Lint the Dockerfile syntax via a dry build of an early stage.** Run (builds only the small `kernel` stage to validate syntax + the arch logic quickly, native arch):

```bash
docker buildx build -f apps/server/Dockerfile --target kernel --load -t mcxd-kernel-test .
```

Expected: build succeeds and ends with mihomo printing its version (`Mihomo ... v1.19.27 ...`). This proves the `.gz` is a RAW binary (gunzip, not tar) and the arch mapping works for the host arch.

- [ ] **Step 3: Assert the healthcheck hits the canonical contract path.** Run:

```bash
grep -q "/api/control/health" apps/server/Dockerfile && echo "healthcheck-path-ok"
```

Expected: `healthcheck-path-ok` (NOT the spec's `/control/health`).

- [ ] **Step 4: Assert tini is PID 1 and gunzip (not tar) is used.** Run:

```bash
grep -q 'ENTRYPOINT \["/sbin/tini", "--"\]' apps/server/Dockerfile && grep -q "gunzip -c" apps/server/Dockerfile && ! grep -q "tar " apps/server/Dockerfile && echo "runtime-ok"
```

Expected: `runtime-ok`.

- [ ] **Step 5: Assert `ARG TARGETARCH` is declared inside the kernel stage.** Run:

```bash
awk '/AS kernel/{k=1} k&&/ARG TARGETARCH/{print "targetarch-in-kernel"; exit}' apps/server/Dockerfile
```

Expected: `targetarch-in-kernel`.

- [ ] **Step 6: Sync the root `.dockerignore`.** Read `/.dockerignore` (currently just `node_modules`). Replace its entire content with:

```gitignore
**/node_modules
**/.output
**/.nitro
**/.nuxt
**/dist
**/.git
**/coverage
**/.tmp-data
**/.DS_Store
apps/desktop
```

Then assert the build context still includes what the Dockerfile COPYs:

```bash
grep -q "packages" /.dockerignore && echo "OOPS packages ignored" || echo "packages-included"
```

Expected: `packages-included` (we did NOT ignore `packages/` or `apps/server`).

- [ ] **Step 7: Commit.**

```bash
git add apps/server/Dockerfile .dockerignore
git commit -m "feat(server): add 4-stage multi-arch Dockerfile with per-arch mihomo and tini PID1"
```

---

### Task 12: Write `apps/server/compose.yaml`

**Files:**

- Create: `apps/server/compose.yaml`

Verified by `docker compose config` (validates schema) and content asserts. The full container run is in Task 13.

- [ ] **Step 1: Write the compose file.** Create `apps/server/compose.yaml` with exactly:

```yaml
# Default deployment: proxy-only (mixed-port). TUN is an advanced override (see bottom).
services:
  metacubexd:
    image: ghcr.io/metacubex/metacubexd-server:latest
    container_name: metacubexd
    restart: unless-stopped
    environment:
      CONTROL_TOKEN: 'change-me-control'
      CLASH_SECRET: 'change-me-clash'
      CONTROL_PORT: '8080'
      CLASH_API_PORT: '9090'
      MIXED_PORT: '7890'
      TZ: 'Asia/Shanghai'
    ports:
      - '8080:8080' # dashboard UI + /api/control agent API
      - '9090:9090' # mihomo Clash API + WebSocket (UI endpoint target)
      - '7890:7890' # mixed proxy port
    volumes:
      - 'metacubexd-data:/data'
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://127.0.0.1:8080/api/control/health']
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3
    # ---- TUN (advanced): uncomment to enable system-level routing ----
    # cap_add: [NET_ADMIN]
    # devices: ['/dev/net/tun:/dev/net/tun']
    # network_mode: host
volumes:
  metacubexd-data: {}
```

- [ ] **Step 2: Validate the compose schema.** Run:

```bash
docker compose -f apps/server/compose.yaml config >/dev/null && echo "compose-valid"
```

Expected: `compose-valid` (the rendered config is printed to /dev/null; no schema errors).

- [ ] **Step 3: Assert the healthcheck and ports match the contract.** Run:

```bash
grep -q "/api/control/health" apps/server/compose.yaml && grep -q "'9090:9090'" apps/server/compose.yaml && grep -q "'7890:7890'" apps/server/compose.yaml && echo "compose-contract-ok"
```

Expected: `compose-contract-ok`.

- [ ] **Step 4: Commit.**

```bash
git add apps/server/compose.yaml
git commit -m "feat(server): add docker compose with control/clash/proxy ports and healthcheck"
```

---

### Task 13: VERIFY — multi-arch buildx + single-arch run with green healthcheck

**Files:** none (verification task).

Proves the spec §10 step 5 acceptance: a multi-arch build succeeds, and a single-arch container comes up healthy with a working kernel-start via the control API. Requires Docker with buildx + QEMU (`docker run --privileged --rm tonistiigi/binfmt --install all` enables arm64 emulation on an amd64 host).

- [ ] **Step 1: Multi-arch build (no load; both platforms must compile).** Run from repo root:

```bash
docker buildx build \
  -f apps/server/Dockerfile \
  --platform linux/amd64,linux/arm64 \
  --build-arg MIHOMO_VERSION=v1.19.27 \
  -t metacubexd-server:multiarch-test \
  .
```

Expected: both `linux/amd64` and `linux/arm64` stages complete; the `kernel` stage prints the mihomo version for each platform; build ends with `exporting to image ... done`. (Without `--push`/`--load` the multi-arch result is validated and discarded — that is the goal here: prove it compiles on both arches.)

- [ ] **Step 2: Build a single-arch image into the local daemon.** Run:

```bash
docker buildx build \
  -f apps/server/Dockerfile \
  --platform linux/amd64 \
  --build-arg MIHOMO_VERSION=v1.19.27 \
  --load \
  -t metacubexd-server:local \
  .
```

Expected: ends with `loading layer ... done` / image `metacubexd-server:local` present. Confirm:

```bash
docker image inspect metacubexd-server:local >/dev/null && echo "image-loaded"
```

Expected: `image-loaded`.

- [ ] **Step 3: Run the container.** Run:

```bash
docker run -d --name mcxd-test \
  -e CONTROL_TOKEN=dev-token \
  -e CLASH_SECRET=dev-clash \
  -p 8080:8080 -p 9090:9090 -p 7890:7890 \
  -v mcxd-test-data:/data \
  metacubexd-server:local
```

Expected: prints a container id. Confirm it is running:

```bash
docker ps --filter name=mcxd-test --format '{{.Status}}'
```

Expected: a `Up ... (health: starting)` line.

- [ ] **Step 4: Wait for the healthcheck to go green.** Run:

```bash
for i in $(seq 1 20); do
  s=$(docker inspect --format '{{.State.Health.Status}}' mcxd-test 2>/dev/null || echo none)
  echo "attempt $i: $s"
  [ "$s" = "healthy" ] && break
  sleep 3
done
docker inspect --format '{{.State.Health.Status}}' mcxd-test
```

Expected: final line prints `healthy`.

- [ ] **Step 5: Verify the dashboard + auth from the host.** Run:

```bash
curl -fsS -o /dev/null -w "dashboard=%{http_code}\n" http://127.0.0.1:8080/
curl -fsS -o /dev/null -w "health=%{http_code}\n" http://127.0.0.1:8080/api/control/health
curl -s -o /dev/null -w "info-noauth=%{http_code}\n" http://127.0.0.1:8080/api/control/info
curl -fsS -o /dev/null -w "info-auth=%{http_code}\n" -H "Authorization: Bearer dev-token" http://127.0.0.1:8080/api/control/info
```

Expected: `dashboard=200`, `health=200`, `info-noauth=401`, `info-auth=200`.

- [ ] **Step 6: Start the kernel via the control API and confirm it reaches mihomo.** Run:

```bash
curl -fsS -X POST -H "Authorization: Bearer dev-token" http://127.0.0.1:8080/api/control/kernel/start
sleep 4
curl -fsS -H "Authorization: Bearer dev-token" http://127.0.0.1:8080/api/control/kernel/status
# Direct hit on mihomo's Clash API via the injected external-controller (0.0.0.0:9090):
curl -fsS -H "Authorization: Bearer dev-clash" http://127.0.0.1:9090/version
```

Expected: the start response and status JSON show `"status":"running"` with a `version`; the `:9090/version` call returns mihomo's `{"meta":true,"version":"v1.19.27"}`-shaped JSON (proving the agent injected `external-controller: 0.0.0.0:9090` + `secret: dev-clash` and the dashboard's direct-to-9090 model works — NOT proxied through Nitro).

- [ ] **Step 7: Tear down.** Run:

```bash
docker rm -f mcxd-test
docker volume rm mcxd-test-data
```

Expected: both succeed. No commit (verification only). If kernel-start fails because `/data` was read-only or mihomo SIGILL'd, re-check the Dockerfile uses `-compatible` for amd64 (Task 11) and that `/data` is a writable named volume.

- [ ] **Step 8: Record completion.** All of: multi-arch build passed, single-arch container healthy, auth enforced, kernel started and reachable on 9090. This satisfies spec §5 + §10 step 5.

---
