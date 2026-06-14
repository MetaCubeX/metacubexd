---
# apps/desktop — Electron Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/desktop` — an Electron app (electron-vite + electron-builder) that bundles and supervises its own mihomo kernel, loads the prebuilt `@metacubexd/ui` SPA via `file://`, starts the `@metacubexd/agent` control API on a loopback HTTP port, and hands the renderer its control/clash endpoints through a preload `contextBridge` — packaged unsigned for mac/win/linux x64+arm64.

**Architecture:** The main process resolves a sideloaded mihomo binary (or a user override), picks two free loopback ports + random secrets, calls `createAgent()` from `@metacubexd/agent`, serves its h3 control router on `127.0.0.1:<controlPort>/api/control`, starts the kernel, and exposes `{ isDesktop, control:{base,token}, endpoint:{url,secret} }` to the renderer through preload. The renderer is the unmodified `nuxt generate` output copied into `apps/desktop/renderer/`. All purely-functional units (path resolution, first-run bootstrap, free-port picker, binary-path resolver) are TDD'd with vitest using injected fs/paths; Electron main wiring and electron-builder packaging get explicit MANUAL verification steps.

**Tech Stack:** Electron ^42, electron-vite ^5, electron-builder ^26, `@metacubexd/agent` (workspace:* source-exported TS), vitest ^4, Node 24, pnpm 10.

**Depends on:**
- **Plan 01 (monorepo migration)** — must be DONE. This plan assumes `packages/ui`, `packages/agent`, `apps/*`, the root `tsconfig.base.json`, `pnpm-workspace.yaml` `catalog:`, and the private root `metacubexd-monorepo` package.json all exist.
- **Plan 02 (`@metacubexd/agent` core)** — must be DONE. Consumes `createAgent`, `createControlRouter`, `fetchKernel`, `mihomoAsset`, `MIHOMO_VERSION`, and the `KernelState`/`SupervisorOptions` types from `@metacubexd/agent`.
- **Plan 03 (control router + `/info`)** — must be DONE. Consumes the h3 router returned by `createAgent().router` (every path under `/api/control/...`, healthcheck `/api/control/health`).
- Plan 05 (UI `desktop-endpoint.client.ts` plugin + `useControlApi`) is a SIBLING — this plan only documents the preload contract it consumes; it does NOT edit `packages/ui`.

---

---

## File Structure

Every file this plan Creates or Modifies, with its single responsibility:

**Created — package + tooling config:**

- `apps/desktop/package.json` — `@metacubexd/desktop` private package; deps (`electron`, `electron-vite`, `electron-builder`, `@metacubexd/agent` `workspace:*`); `dev`/`build`/`package`/`typecheck`/`test`/`copy:renderer` scripts.
- `apps/desktop/electron.vite.config.ts` — electron-vite config: `main` + `preload` builds with `externalizeDepsPlugin`; renderer build disabled (UI is prebuilt elsewhere).
- `apps/desktop/tsconfig.json` — extends root `../../tsconfig.base.json`; includes `src` + `scripts`.
- `apps/desktop/vitest.config.ts` — node-environment vitest config for the pure-unit tests in `src/main/__tests__`.
- `apps/desktop/.gitignore` — ignore `out/`, `dist/`, `renderer/`, `resources/mihomo*`.
- `apps/desktop/electron-builder.yml` — the exact unsigned packaging config from spec §4 (extraResources, mac `identity:null`, win nsis x64+arm64, linux AppImage+deb x64+arm64).
- `apps/desktop/resources/default-config.yaml` — minimal valid mihomo config bootstrapped into userData on first run.

**Created — main-process source (pure units, TDD'd):**

- `apps/desktop/src/main/paths.ts` — pure userData data-dir layout + first-run default-config bootstrap (injected fs/paths).
- `apps/desktop/src/main/free-port.ts` — pure free-port picker (injected port-probe fn) + a real OS probe.
- `apps/desktop/src/main/binary-path.ts` — pure mihomo binary-path resolver (packaged vs dev branch + user override + ext-by-os).
- `apps/desktop/src/main/secrets.ts` — pure random control-token / clash-secret generators (injected RNG).

**Created — main-process source (wiring, MANUAL-verified):**

- `apps/desktop/src/main/index.ts` — app lifecycle: single-instance lock, BrowserWindow + `loadFile`, resolve binary + chmod, pick ports + secrets, `createAgent`, serve control HTTP on `127.0.0.1`, start kernel, pass env to preload, kill kernel on `before-quit`, Tray + autostart.
- `apps/desktop/src/main/control-server.ts` — adapt the agent h3 router onto a Node `http.Server` bound to `127.0.0.1`.
- `apps/desktop/src/main/tray.ts` — Tray + context menu (Show / Start-Stop kernel / Open at login toggle / Quit).
- `apps/desktop/src/preload/index.ts` — `contextBridge.exposeInMainWorld('metacubexd', …)` per the shared contract.

**Created — tests:**

- `apps/desktop/src/main/__tests__/paths.spec.ts`
- `apps/desktop/src/main/__tests__/free-port.spec.ts`
- `apps/desktop/src/main/__tests__/binary-path.spec.ts`
- `apps/desktop/src/main/__tests__/secrets.spec.ts`

**Created — scripts:**

- `apps/desktop/scripts/fetch-mihomo.mjs` — stage the arch-correct mihomo binary into `apps/desktop/resources/` via `@metacubexd/agent`'s `fetchKernel` (dev + CI before packaging).

**Modified:**

- `pnpm-workspace.yaml` (root) — ensure `electron`, `electron-vite`, `electron-builder` are present in the single `catalog:` (added by Plan 01 per spec; this plan only verifies/adds if missing).

> Renderer copy: `rm -rf apps/desktop/renderer && cp -r packages/ui/.output/public apps/desktop/renderer` — produced by the `copy:renderer` npm script (Task 12) and re-run identically in CI (Plan 07). The `renderer/` directory is git-ignored.

---

## Tasks

> Conventions used throughout:
>
> - All commands are run from the **repo root** `/Users/shikun/Developer/opensource/metacubexd` unless stated otherwise.
> - `pnpm --filter @metacubexd/desktop <script>` runs a script in this package; `pnpm --filter @metacubexd/desktop exec <bin>` runs a binary from this package.
> - Pure units live in `src/main/*.ts` and import NOTHING from `electron` (so vitest can import them in a plain Node environment). Only `index.ts`, `control-server.ts`, and `tray.ts` import `electron`.

---

### Task 1: Scaffold `apps/desktop` package manifest

**Files:**

- Create `apps/desktop/package.json`
- Create `apps/desktop/.gitignore`

This task has no unit test (it is a manifest); verification is `pnpm install` resolving the workspace.

- [ ] **Step 1: Create the package manifest.** Write `apps/desktop/package.json`:

  ```json
  {
    "name": "@metacubexd/desktop",
    "version": "1.254.2",
    "private": true,
    "type": "module",
    "main": "out/main/index.js",
    "scripts": {
      "dev": "electron-vite dev",
      "build": "electron-vite build",
      "package": "electron-builder",
      "copy:renderer": "rm -rf renderer && cp -r ../../packages/ui/.output/public renderer",
      "fetch:mihomo": "node scripts/fetch-mihomo.mjs",
      "typecheck": "tsc --noEmit -p tsconfig.json",
      "test": "vitest run",
      "test:watch": "vitest"
    },
    "dependencies": {
      "@metacubexd/agent": "workspace:*"
    },
    "devDependencies": {
      "electron": "catalog:",
      "electron-vite": "catalog:",
      "electron-builder": "catalog:",
      "vitest": "catalog:",
      "@types/node": "catalog:",
      "typescript": "catalog:"
    }
  }
  ```

  Notes: `main` points at the electron-vite main output (`out/main/index.js`). `@metacubexd/agent` is a **runtime dependency** (its TS source is bundled into the main process by electron-vite). `electron`/`electron-vite`/`electron-builder` are dev-only (electron itself is bundled by electron-builder, not shipped via `node_modules`).

- [ ] **Step 2: Create the package gitignore.** Write `apps/desktop/.gitignore`:

  ```gitignore
  out/
  dist/
  renderer/
  resources/mihomo
  resources/mihomo.exe
  node_modules/
  ```

  Rationale: `out/` (electron-vite build), `dist/` (electron-builder output), `renderer/` (copied UI), and the fetched mihomo binaries are all build artifacts. `resources/default-config.yaml` is NOT ignored (it is committed source).

- [ ] **Step 3: Verify catalog entries exist for the desktop toolchain.** Run:

  ```bash
  grep -nE "^\s+(electron|electron-vite|electron-builder):" pnpm-workspace.yaml
  ```

  Expected: three lines printing `electron: ^42.0.0`, `electron-vite: ^5.0.0`, `electron-builder: ^26.0.0` (added by Plan 01). If any are missing, add them under the single `catalog:` block in `pnpm-workspace.yaml` with those exact versions, then re-run the grep until all three appear.

- [ ] **Step 4: Install and verify the workspace resolves.** Run:

  ```bash
  pnpm install
  pnpm ls --filter @metacubexd/desktop --depth -1
  ```

  Expected: `pnpm install` completes with no error; the second command prints `@metacubexd/desktop@1.254.2 .../apps/desktop`. The `@metacubexd/agent` dep resolves to a `workspace:` link (no registry fetch).

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/package.json apps/desktop/.gitignore pnpm-workspace.yaml pnpm-lock.yaml
  git commit -m "feat(desktop): scaffold @metacubexd/desktop package manifest"
  ```

---

### Task 2: TypeScript + electron-vite + vitest config

**Files:**

- Create `apps/desktop/tsconfig.json`
- Create `apps/desktop/electron.vite.config.ts`
- Create `apps/desktop/vitest.config.ts`

- [ ] **Step 1: Create `tsconfig.json` extending the shared base.** Write `apps/desktop/tsconfig.json`:

  ```json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "types": ["node", "vitest/globals"],
      "noEmit": true,
      "skipLibCheck": true
    },
    "include": [
      "src/**/*.ts",
      "scripts/**/*.mjs",
      "electron.vite.config.ts",
      "vitest.config.ts"
    ]
  }
  ```

- [ ] **Step 2: Create the electron-vite config.** Write `apps/desktop/electron.vite.config.ts`:

  ```ts
  import { resolve } from 'node:path'
  import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

  // No `renderer` build: the renderer is the prebuilt `@metacubexd/ui`
  // `nuxt generate` output, copied into ./renderer by `pnpm copy:renderer`.
  // The main process loads it via `win.loadFile('renderer/index.html')`.
  export default defineConfig({
    main: {
      // Bundle @metacubexd/agent (TS source) INTO the main output, but keep
      // electron + native node builtins external.
      plugins: [externalizeDepsPlugin({ exclude: ['@metacubexd/agent'] })],
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/main/index.ts') },
        },
      },
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: { index: resolve(__dirname, 'src/preload/index.ts') },
        },
      },
    },
  })
  ```

  Rationale: `externalizeDepsPlugin({ exclude: ['@metacubexd/agent'] })` forces the agent's source `.ts` (and its small runtime deps `tree-kill`/`yaml`/`h3`, which it imports) to be transpiled and bundled into `out/main/index.js`, avoiding the pnpm-symlink-in-asar trap called out in spec §4. Electron and node builtins stay external.

- [ ] **Step 3: Create the vitest config for pure units.** Write `apps/desktop/vitest.config.ts`:

  ```ts
  import { defineConfig } from 'vitest/config'

  export default defineConfig({
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/__tests__/**/*.spec.ts'],
    },
  })
  ```

  Note: `environment: 'node'` (not jsdom) — these tests never touch the DOM. `globals: true` lets tests use `describe`/`it`/`expect` without imports (matches the `vitest/globals` type in tsconfig).

- [ ] **Step 4: Verify the configs typecheck and vitest discovers zero tests (no test files yet).** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec tsc --noEmit -p tsconfig.json
  pnpm --filter @metacubexd/desktop exec vitest run
  ```

  Expected: `tsc` prints nothing and exits 0. `vitest run` prints `No test files found, exiting with code 0` (or `0 passed`) — this confirms the config loads. (If `tsc` complains it cannot find `../../tsconfig.base.json`, Plan 01 is not actually done — stop and resolve that first.)

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/tsconfig.json apps/desktop/electron.vite.config.ts apps/desktop/vitest.config.ts
  git commit -m "chore(desktop): add tsconfig, electron-vite and vitest configs"
  ```

---

### Task 3: `secrets.ts` — random control token + clash secret (TDD)

**Files:**

- Create `apps/desktop/src/main/secrets.ts`
- Test `apps/desktop/src/main/__tests__/secrets.spec.ts`

The main process generates a fresh control token and clash secret on every launch (spec §4). Make the generators pure by injecting the random-bytes source.

- [ ] **Step 1: Write the failing test.** Write `apps/desktop/src/main/__tests__/secrets.spec.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { makeToken } from '../secrets'

  describe('makeToken', () => {
    it('hex-encodes the bytes returned by the injected randomBytes fn', () => {
      const randomBytes = (n: number) => Buffer.alloc(n, 0xab)
      expect(makeToken(4, randomBytes)).toBe('abababab')
    })

    it('produces a token of length 2 * byteCount', () => {
      const randomBytes = (n: number) => Buffer.alloc(n, 0x00)
      expect(makeToken(16, randomBytes)).toHaveLength(32)
    })

    it('uses 24 bytes (48 hex chars) by default', () => {
      let asked = -1
      const randomBytes = (n: number) => {
        asked = n
        return Buffer.alloc(n, 0x01)
      }
      const token = makeToken(undefined, randomBytes)
      expect(asked).toBe(24)
      expect(token).toHaveLength(48)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/secrets.spec.ts
  ```

  Expected failure: `Failed to resolve import "../secrets"` (the module does not exist yet).

- [ ] **Step 3: Write the minimal implementation.** Write `apps/desktop/src/main/secrets.ts`:

  ```ts
  import { randomBytes as nodeRandomBytes } from 'node:crypto'

  export type RandomBytesFn = (n: number) => Buffer

  /**
   * Generate a hex token. Pure: the randomness source is injectable so the
   * generator is deterministically testable. Default 24 bytes = 48 hex chars.
   */
  export function makeToken(
    byteCount = 24,
    randomBytes: RandomBytesFn = nodeRandomBytes,
  ): string {
    return randomBytes(byteCount).toString('hex')
  }
  ```

- [ ] **Step 4: Run the test to verify it passes.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/secrets.spec.ts
  ```

  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/src/main/secrets.ts apps/desktop/src/main/__tests__/secrets.spec.ts
  git commit -m "feat(desktop): add injectable hex token generator"
  ```

---

### Task 4: `binary-path.ts` — mihomo binary resolver (TDD)

**Files:**

- Create `apps/desktop/src/main/binary-path.ts`
- Test `apps/desktop/src/main/__tests__/binary-path.spec.ts`

Resolves the mihomo binary path. Branches on `isPackaged`, honors a user custom path override (always wins), and appends `.exe` on Windows. Pure: all inputs (`platform`, `isPackaged`, `resourcesPath`, `appPath`, `userOverride`) are passed in.

- [ ] **Step 1: Write the failing test.** Write `apps/desktop/src/main/__tests__/binary-path.spec.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { resolveMihomoBinary } from '../binary-path'

  const base = {
    isPackaged: false,
    resourcesPath: '/app/resources',
    appPath: '/repo/apps/desktop',
  }

  describe('resolveMihomoBinary', () => {
    it('uses resourcesPath when packaged (unix)', () => {
      expect(
        resolveMihomoBinary({ ...base, isPackaged: true, platform: 'darwin' }),
      ).toBe('/app/resources/mihomo')
    })

    it('uses appPath/resources when not packaged (dev, unix)', () => {
      expect(
        resolveMihomoBinary({ ...base, isPackaged: false, platform: 'linux' }),
      ).toBe('/repo/apps/desktop/resources/mihomo')
    })

    it('appends .exe on win32 (packaged)', () => {
      expect(
        resolveMihomoBinary({ ...base, isPackaged: true, platform: 'win32' }),
      ).toBe('/app/resources/mihomo.exe')
    })

    it('appends .exe on win32 (dev)', () => {
      expect(
        resolveMihomoBinary({ ...base, isPackaged: false, platform: 'win32' }),
      ).toBe('/repo/apps/desktop/resources/mihomo.exe')
    })

    it('user override always wins, verbatim, regardless of packaging/platform', () => {
      expect(
        resolveMihomoBinary({
          ...base,
          isPackaged: true,
          platform: 'win32',
          userOverride: '/Users/me/my-mihomo',
        }),
      ).toBe('/Users/me/my-mihomo')
    })

    it('ignores an empty-string override (treats as unset)', () => {
      expect(
        resolveMihomoBinary({
          ...base,
          isPackaged: true,
          platform: 'darwin',
          userOverride: '',
        }),
      ).toBe('/app/resources/mihomo')
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/binary-path.spec.ts
  ```

  Expected failure: `Failed to resolve import "../binary-path"`.

- [ ] **Step 3: Write the minimal implementation.** Write `apps/desktop/src/main/binary-path.ts`:

  ```ts
  import { join } from 'node:path'

  export interface ResolveBinaryInput {
    /** process.platform of the running Electron process. */
    platform: NodeJS.Platform
    /** app.isPackaged. */
    isPackaged: boolean
    /** process.resourcesPath (only meaningful when packaged). */
    resourcesPath: string
    /** app.getAppPath() (the package root in dev). */
    appPath: string
    /** Optional user-configured absolute path; when set, always wins. */
    userOverride?: string
  }

  /**
   * Resolve the mihomo executable path. Pure — no fs, no electron.
   * - userOverride (non-empty) always wins, verbatim.
   * - packaged  -> <resourcesPath>/mihomo[.exe]
   * - dev       -> <appPath>/resources/mihomo[.exe]
   */
  export function resolveMihomoBinary(input: ResolveBinaryInput): string {
    if (input.userOverride && input.userOverride.length > 0) {
      return input.userOverride
    }
    const exe = input.platform === 'win32' ? 'mihomo.exe' : 'mihomo'
    return input.isPackaged
      ? join(input.resourcesPath, exe)
      : join(input.appPath, 'resources', exe)
  }
  ```

- [ ] **Step 4: Run the test to verify it passes.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/binary-path.spec.ts
  ```

  Expected: `6 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/src/main/binary-path.ts apps/desktop/src/main/__tests__/binary-path.spec.ts
  git commit -m "feat(desktop): add mihomo binary path resolver"
  ```

---

### Task 5: `free-port.ts` — pure free-port picker (TDD) + real probe

**Files:**

- Create `apps/desktop/src/main/free-port.ts`
- Test `apps/desktop/src/main/__tests__/free-port.spec.ts`

We must pick TWO independent free loopback ports each launch (control HTTP + clash external-controller). The selection LOGIC is pure (inject an async "is this port free?" probe); a real OS probe is provided separately and is exercised in the MANUAL launch test (Task 14), not unit-tested.

- [ ] **Step 1: Write the failing test.** Write `apps/desktop/src/main/__tests__/free-port.spec.ts`:

  ```ts
  import { describe, expect, it } from 'vitest'
  import { pickFreePorts } from '../free-port'

  describe('pickFreePorts', () => {
    it('returns the first N ports the probe reports free', async () => {
      const free = new Set([20002, 20005])
      const probe = async (p: number) => free.has(p)
      const ports = await pickFreePorts(2, { start: 20000, probe })
      expect(ports).toEqual([20002, 20005])
    })

    it('never returns the same port twice even if the probe says free', async () => {
      const probe = async () => true // every port "free"
      const ports = await pickFreePorts(2, { start: 30000, probe })
      expect(ports).toEqual([30000, 30001])
      expect(new Set(ports).size).toBe(2)
    })

    it('throws if it cannot find enough free ports within the scan window', async () => {
      const probe = async () => false // nothing free
      await expect(
        pickFreePorts(1, { start: 40000, probe, maxScan: 5 }),
      ).rejects.toThrow(/no free port/i)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/free-port.spec.ts
  ```

  Expected failure: `Failed to resolve import "../free-port"`.

- [ ] **Step 3: Write the minimal implementation.** Write `apps/desktop/src/main/free-port.ts`:

  ```ts
  import { createServer } from 'node:net'

  export type PortProbe = (port: number) => Promise<boolean>

  export interface PickPortsOptions {
    /** First port to try (default 21000). */
    start?: number
    /** Max ports to scan before giving up (default 2000). */
    maxScan?: number
    /** Injectable "is this port free?" probe (default: real OS bind). */
    probe?: PortProbe
  }

  /** Real probe: try to bind a server to 127.0.0.1:<port>; free => true. */
  export const probePort: PortProbe = (port) =>
    new Promise((resolve) => {
      const srv = createServer()
      srv.once('error', () => resolve(false))
      srv.once('listening', () => srv.close(() => resolve(true)))
      srv.listen(port, '127.0.0.1')
    })

  /**
   * Pick `count` distinct free ports starting at `start`. Pure given a probe.
   * Already-chosen ports are never re-offered (guards against the same port
   * passing the probe twice between bind+release).
   */
  export async function pickFreePorts(
    count: number,
    options: PickPortsOptions = {},
  ): Promise<number[]> {
    const start = options.start ?? 21000
    const maxScan = options.maxScan ?? 2000
    const probe = options.probe ?? probePort
    const chosen: number[] = []
    for (let i = 0; i < maxScan && chosen.length < count; i++) {
      const port = start + i
      if (chosen.includes(port)) continue
      if (await probe(port)) chosen.push(port)
    }
    if (chosen.length < count) {
      throw new Error(
        `no free port: found ${chosen.length}/${count} within ${maxScan} from ${start}`,
      )
    }
    return chosen
  }
  ```

- [ ] **Step 4: Run the test to verify it passes.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/free-port.spec.ts
  ```

  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/src/main/free-port.ts apps/desktop/src/main/__tests__/free-port.spec.ts
  git commit -m "feat(desktop): add free-port picker with injectable probe"
  ```

---

### Task 6: `paths.ts` — userData layout + first-run bootstrap (TDD)

**Files:**

- Create `apps/desktop/src/main/paths.ts`
- Test `apps/desktop/src/main/__tests__/paths.spec.ts`

Defines the on-disk layout inside `app.getPath('userData')` and the first-run copy of `default-config.yaml` into the data dir. All fs ops are injected so the logic is unit-testable against a fake fs.

- [ ] **Step 1: Write the failing test.** Write `apps/desktop/src/main/__tests__/paths.spec.ts`:

  ```ts
  import { describe, expect, it, vi } from 'vitest'
  import { bootstrapDataDir, dataPaths } from '../paths'

  describe('dataPaths', () => {
    it('derives the home/profiles/active/state layout under userData', () => {
      const p = dataPaths('/u/data')
      expect(p).toEqual({
        homeDir: '/u/data/mihomo-home',
        profilesDir: '/u/data/mihomo-home/profiles',
        activeConfigPath: '/u/data/mihomo-home/config.yaml',
        stateFile: '/u/data/mihomo-home/state.json',
      })
    })
  })

  function fakeFs(existing: Set<string>) {
    const writes: Record<string, string> = {}
    const made: string[] = []
    return {
      writes,
      made,
      io: {
        existsSync: (p: string) => existing.has(p),
        mkdirSync: (p: string) => {
          made.push(p)
          existing.add(p)
        },
        readFileSync: (p: string) => {
          if (p === '/res/default-config.yaml') return 'mixed-port: 7890\n'
          throw new Error(`unexpected read ${p}`)
        },
        writeFileSync: (p: string, data: string) => {
          writes[p] = data
          existing.add(p)
        },
      },
    }
  }

  describe('bootstrapDataDir', () => {
    it('creates dirs and copies default config on first run', () => {
      const { io, writes, made } = fakeFs(new Set())
      const result = bootstrapDataDir('/u/data', '/res/default-config.yaml', io)

      expect(made).toContain('/u/data/mihomo-home')
      expect(made).toContain('/u/data/mihomo-home/profiles')
      expect(writes['/u/data/mihomo-home/config.yaml']).toBe(
        'mixed-port: 7890\n',
      )
      expect(result.copiedDefault).toBe(true)
      expect(result.activeConfigPath).toBe('/u/data/mihomo-home/config.yaml')
    })

    it('does NOT overwrite an existing active config (idempotent)', () => {
      const existing = new Set([
        '/u/data/mihomo-home',
        '/u/data/mihomo-home/profiles',
        '/u/data/mihomo-home/config.yaml',
      ])
      const { io, writes } = fakeFs(existing)
      const result = bootstrapDataDir('/u/data', '/res/default-config.yaml', io)

      expect(writes['/u/data/mihomo-home/config.yaml']).toBeUndefined()
      expect(result.copiedDefault).toBe(false)
    })
  })
  ```

- [ ] **Step 2: Run the test to verify it fails.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/paths.spec.ts
  ```

  Expected failure: `Failed to resolve import "../paths"`.

- [ ] **Step 3: Write the minimal implementation.** Write `apps/desktop/src/main/paths.ts`:

  ```ts
  import { join } from 'node:path'

  export interface DataPaths {
    homeDir: string
    profilesDir: string
    activeConfigPath: string
    stateFile: string
  }

  /** Pure: derive the on-disk layout under a userData root. */
  export function dataPaths(userData: string): DataPaths {
    const homeDir = join(userData, 'mihomo-home')
    return {
      homeDir,
      profilesDir: join(homeDir, 'profiles'),
      activeConfigPath: join(homeDir, 'config.yaml'),
      stateFile: join(homeDir, 'state.json'),
    }
  }

  /** Minimal fs surface so bootstrap is unit-testable with a fake. */
  export interface FsLike {
    existsSync: (p: string) => boolean
    mkdirSync: (p: string) => void
    readFileSync: (p: string) => string
    writeFileSync: (p: string, data: string) => void
  }

  export interface BootstrapResult extends DataPaths {
    copiedDefault: boolean
  }

  /**
   * Ensure the userData layout exists and, on first run only, copy the
   * bundled default config into the active config slot. Idempotent.
   */
  export function bootstrapDataDir(
    userData: string,
    defaultConfigPath: string,
    fs: FsLike,
  ): BootstrapResult {
    const p = dataPaths(userData)
    if (!fs.existsSync(p.homeDir)) fs.mkdirSync(p.homeDir)
    if (!fs.existsSync(p.profilesDir)) fs.mkdirSync(p.profilesDir)

    let copiedDefault = false
    if (!fs.existsSync(p.activeConfigPath)) {
      fs.writeFileSync(p.activeConfigPath, fs.readFileSync(defaultConfigPath))
      copiedDefault = true
    }
    return { ...p, copiedDefault }
  }
  ```

  Note: `mkdirSync` is called per-level top-down (`homeDir` before `profilesDir`), so the real call site (Task 8) must NOT pass `{ recursive: true }`-dependent fakes — the production `FsLike` adapter will wrap `node:fs` `mkdirSync(p, { recursive: true })` (recursive is harmless and idempotent for the real fs).

- [ ] **Step 4: Run the test to verify it passes.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run src/main/__tests__/paths.spec.ts
  ```

  Expected: `3 passed`.

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/src/main/paths.ts apps/desktop/src/main/__tests__/paths.spec.ts
  git commit -m "feat(desktop): add userData layout and first-run config bootstrap"
  ```

---

### Task 7: `default-config.yaml` — bootstrapped default profile

**Files:**

- Create `apps/desktop/resources/default-config.yaml`

A minimal, valid mihomo config. The agent overlays `external-controller`/`secret`/ports at start (spec §3), so this only needs sane defaults that pass `mihomo -t`.

- [ ] **Step 1: Write the default config.** Write `apps/desktop/resources/default-config.yaml`:

  ```yaml
  # Minimal default mihomo config bootstrapped on first run.
  # The desktop agent overlays external-controller, secret, and ports at start;
  # do not hardcode credentials or controller addresses here.
  mixed-port: 7890
  allow-lan: false
  mode: rule
  log-level: info
  ipv6: false
  proxies: []
  proxy-groups:
    - name: PROXY
      type: select
      proxies:
        - DIRECT
  rules:
    - MATCH,DIRECT
  ```

- [ ] **Step 2: Verify it is well-formed YAML.** Run:

  ```bash
  node -e "import('yaml').then(m => { const fs=require('node:fs'); const d=m.parse(fs.readFileSync('apps/desktop/resources/default-config.yaml','utf8')); console.log('parsed keys:', Object.keys(d).join(',')) })"
  ```

  Expected output includes: `parsed keys: mixed-port,allow-lan,mode,log-level,ipv6,proxies,proxy-groups,rules`. (Uses the `yaml` dep already in the workspace catalog.)

- [ ] **Step 3: Commit.**
  ```bash
  git add apps/desktop/resources/default-config.yaml
  git commit -m "feat(desktop): add bootstrap default mihomo config"
  ```

---

### Task 8: `fetch-mihomo.mjs` — stage the arch-correct binary into resources/

**Files:**

- Create `apps/desktop/scripts/fetch-mihomo.mjs`

Used in dev (Task 13) and CI (Plan 07) before packaging. Delegates to `@metacubexd/agent`'s `fetchKernel(os, arch, destDir)` (shared contract) so there is ONE downloader. Targets the CURRENT host's os/arch by default; honors `--os`/`--arch` overrides for cross-arch CI staging.

- [ ] **Step 1: Write the fetch script.** Write `apps/desktop/scripts/fetch-mihomo.mjs`:

  ```mjs
  #!/usr/bin/env node
  // Stage the arch-correct mihomo binary into apps/desktop/resources/.
  // Default: current host os/arch. Override with --os <linux|darwin|win32> --arch <x64|arm64>.
  // electron-builder's extraResources copies resources/mihomo[.exe] from here.
  import { fileURLToPath } from 'node:url'
  import { dirname, join } from 'node:path'
  import { fetchKernel } from '@metacubexd/agent/kernel/fetch-kernel'

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const resourcesDir = join(__dirname, '..', 'resources')

  function flag(name, fallback) {
    const i = process.argv.indexOf(`--${name}`)
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
  }

  const os = flag('os', process.platform) // 'linux' | 'darwin' | 'win32'
  const arch = flag('arch', process.arch) // 'x64' | 'arm64'

  console.log(`[fetch-mihomo] os=${os} arch=${arch} -> ${resourcesDir}`)
  const { binPath } = await fetchKernel(os, arch, resourcesDir)
  console.log(`[fetch-mihomo] staged: ${binPath}`)
  ```

  Notes: `@metacubexd/agent/kernel/fetch-kernel` is the source export declared in the shared contract (`fetchKernel(os, arch, destDir) -> { binPath }`). The agent's downloader handles gunzip-of-raw-binary vs zip and `chmod 0o755` and renames to `mihomo`/`mihomo.exe`. This script is intentionally thin.

- [ ] **Step 2: Verify the script's import + arg parsing without a network download.** Run a dry import check (will attempt a real download, so only confirm the module resolves + prints the plan line, then Ctrl-C is unnecessary because we pass an impossible arch to fail fast BEFORE download). Run:

  ```bash
  node apps/desktop/scripts/fetch-mihomo.mjs --os linux --arch bogus 2>&1 | head -5
  ```

  Expected: the first line is `[fetch-mihomo] os=linux arch=bogus -> .../apps/desktop/resources`, and then an error thrown by the agent's `mihomoAsset`/`fetchKernel` for the unknown arch (proving the import + delegation wired up correctly). The exact error text comes from Plan 02; any non-zero exit after the plan line is acceptable here.

- [ ] **Step 3: Do a REAL host-arch fetch and verify the binary lands and runs.** Run:

  ```bash
  node apps/desktop/scripts/fetch-mihomo.mjs
  ls -l apps/desktop/resources/
  apps/desktop/resources/mihomo -v
  ```

  Expected: `resources/mihomo` (or `mihomo.exe` on Windows) exists, is executable, and `mihomo -v` prints a version line containing `v1.19.27` (the pinned `MIHOMO_VERSION`). On macOS the agent already strips quarantine + chmods; if `-v` is killed, see Task 14's xattr note.

- [ ] **Step 4: Commit (script only — the binary is git-ignored).**
  ```bash
  git add apps/desktop/scripts/fetch-mihomo.mjs
  git commit -m "feat(desktop): add fetch-mihomo staging script via agent fetchKernel"
  ```

---

### Task 9: `preload/index.ts` — contextBridge surface

**Files:**

- Create `apps/desktop/src/preload/index.ts`

Exposes `window.metacubexd` exactly per the shared contract. Reads the env the main process injected into the renderer's `webPreferences.additionalArguments` / `process.env` (the main wiring in Task 12 sets these on the BrowserWindow's preload env).

- [ ] **Step 1: Write the preload.** Write `apps/desktop/src/preload/index.ts`:

  ```ts
  import { contextBridge } from 'electron'

  // Shared contract (spec §4): the renderer bridge shape consumed by
  // packages/ui/plugins/desktop-endpoint.client.ts + composables/useControlApi.ts.
  //   window.metacubexd = {
  //     isDesktop: true,
  //     control:  { base, token },
  //     endpoint: { url, secret },
  //   }
  // Values arrive via env vars the main process sets on this preload's process.
  contextBridge.exposeInMainWorld('metacubexd', {
    isDesktop: true,
    control: {
      base: process.env.MCXD_CONTROL_BASE,
      token: process.env.MCXD_CONTROL_TOKEN,
    },
    endpoint: {
      url: process.env.MCXD_CLASH_URL,
      secret: process.env.MCXD_CLASH_SECRET,
    },
  })
  ```

  Note the env var names — they are the desktop's private wiring (set in Task 12). `control.base` is the full `http://127.0.0.1:<port>/api/control` base; the UI composable appends route suffixes. `endpoint.url` is `http://127.0.0.1:<clashPort>` and `endpoint.secret` is the clash secret.

- [ ] **Step 2: Verify the preload builds in isolation via electron-vite.** (We cannot unit-test `contextBridge`; build is the check.) Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec electron-vite build
  ls apps/desktop/out/preload/
  ```

  Expected: `electron-vite build` reports building `main` and `preload` bundles (the `main` build will only fully succeed after Task 12 creates `src/main/index.ts`; if `index.ts` is missing this step errors on `main`, which is fine — confirm `out/preload/index.js` was produced regardless, OR temporarily run only after Task 12). To check just preload now, instead run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vite build --config electron.vite.config.ts 2>/dev/null || echo "build deferred to Task 12"
  ```

  Expected: either `out/preload/index.js` exists, or the explicit `build deferred to Task 12` line. (Preload is fully verified in the Task 14 manual launch.)

- [ ] **Step 3: Commit.**
  ```bash
  git add apps/desktop/src/preload/index.ts
  git commit -m "feat(desktop): expose window.metacubexd contextBridge in preload"
  ```

---

### Task 10: `control-server.ts` — bind the agent h3 router to loopback HTTP

**Files:**

- Create `apps/desktop/src/main/control-server.ts`

Adapts the h3 router returned by `createAgent().router` onto a Node `http.Server` bound to `127.0.0.1`. This module imports from `h3` (already a workspace dep, bundled by electron-vite) but NOT from `electron`, so it can be sanity-checked headless.

- [ ] **Step 1: Write the control server adapter.** Write `apps/desktop/src/main/control-server.ts`:

  ```ts
  import { createServer, type Server } from 'node:http'
  import { toNodeListener, type App } from 'h3'

  export interface ControlServer {
    server: Server
    port: number
  }

  /**
   * Bind an h3 app/router (from @metacubexd/agent createAgent().router) onto a
   * Node http server listening on 127.0.0.1:<port>. Loopback-only by design
   * (spec §4: only environ binding + per-launch token guard the surface).
   */
  export function startControlServer(
    router: App,
    port: number,
  ): Promise<ControlServer> {
    const server = createServer(toNodeListener(router))
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject)
        resolve({ server, port })
      })
    })
  }

  export function stopControlServer(cs: ControlServer): Promise<void> {
    return new Promise((resolve) => cs.server.close(() => resolve()))
  }
  ```

  Note: `toNodeListener` + `App` are h3's public API (spec §3 says `createControlRouter` returns "an h3 app/router"). If Plan 03 returns an h3 `Router` rather than `App`, the type annotation widens to `App` via h3's compatible types; the runtime `toNodeListener(router)` call is unchanged.

- [ ] **Step 2: Verify it binds to a free port and serves the agent health route headless.** Write a throwaway check (do NOT commit it) at `apps/desktop/scripts/_check-control.mjs`:

  ```mjs
  import { createApp, eventHandler } from 'h3'
  import { startControlServer, stopControlServer } from '../out/main/index.js' // not exported — see note
  ```

  This won't work because `control-server.ts` is bundled into `index.ts` output. Instead verify via a direct tsx-style run. Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec vitest run --root apps/desktop --dir src/main 2>/dev/null; \
  node --input-type=module -e "
  import { createApp, eventHandler, toNodeListener } from 'h3';
  import http from 'node:http';
  const app = createApp();
  app.use('/api/control/health', eventHandler(() => 'ok'));
  const srv = http.createServer(toNodeListener(app));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  const res = await fetch('http://127.0.0.1:' + port + '/api/control/health');
  console.log('health status', res.status, await res.text());
  srv.close();
  "
  ```

  Expected: `health status 200 ok`. This proves the exact `createServer(toNodeListener(app))` pattern used by `control-server.ts` serves an h3 app on loopback. (Full integration with the real agent router happens in the Task 14 launch.)

- [ ] **Step 3: Typecheck the module.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec tsc --noEmit -p tsconfig.json
  ```

  Expected: exits 0 (no type errors). If h3's `App`/`toNodeListener` types are not found, confirm `h3` is in the catalog and installed (it is per spec §1 catalog).

- [ ] **Step 4: Commit.**
  ```bash
  git add apps/desktop/src/main/control-server.ts
  git commit -m "feat(desktop): bind agent h3 router to loopback http server"
  ```

---

### Task 11: `tray.ts` — Tray menu + autostart toggle

**Files:**

- Create `apps/desktop/src/main/tray.ts`

Encapsulates the Tray + context menu so `index.ts` stays focused on lifecycle. Imports `electron`; verified manually in Task 14.

- [ ] **Step 1: Write the tray module.** Write `apps/desktop/src/main/tray.ts`:

  ```ts
  import { join } from 'node:path'
  import { app, Menu, Tray, nativeImage, type BrowserWindow } from 'electron'

  export interface TrayDeps {
    getWindow: () => BrowserWindow | null
    startKernel: () => void
    stopKernel: () => void
    quit: () => void
    /** Absolute path to a tray icon PNG (resources/tray.png). */
    iconPath: string
  }

  export function createTray(deps: TrayDeps): Tray {
    const image = nativeImage.createFromPath(deps.iconPath)
    const tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
    tray.setToolTip('MetaCubeXD')

    const rebuild = () => {
      const loginItem = app.getLoginItemSettings()
      const menu = Menu.buildFromTemplate([
        {
          label: 'Show',
          click: () => deps.getWindow()?.show(),
        },
        { type: 'separator' },
        { label: 'Start kernel', click: () => deps.startKernel() },
        { label: 'Stop kernel', click: () => deps.stopKernel() },
        { type: 'separator' },
        {
          label: 'Open at login',
          type: 'checkbox',
          checked: loginItem.openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked })
            rebuild()
          },
        },
        { type: 'separator' },
        { label: 'Quit', click: () => deps.quit() },
      ])
      tray.setContextMenu(menu)
    }

    rebuild()
    tray.on('click', () => deps.getWindow()?.show())
    return tray
  }

  /** Resolve the tray icon path relative to the main bundle (out/main). */
  export function trayIconPath(): string {
    return join(__dirname, '..', '..', 'resources', 'tray.png')
  }
  ```

  Note: `Tray` requires an icon; `nativeImage.createEmpty()` is the safe fallback if `resources/tray.png` is absent. (A real icon is optional polish; the menu still works with an empty image on all platforms.)

- [ ] **Step 2: Typecheck.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec tsc --noEmit -p tsconfig.json
  ```

  Expected: exits 0. (Electron types resolve from the `electron` devDependency.)

- [ ] **Step 3: Commit.**
  ```bash
  git add apps/desktop/src/main/tray.ts
  git commit -m "feat(desktop): add tray menu with autostart toggle"
  ```

---

### Task 12: `main/index.ts` — full app lifecycle wiring

**Files:**

- Create `apps/desktop/src/main/index.ts`

The orchestrator. Single-instance lock, window + `loadFile`, resolve+chmod binary, pick ports + secrets, bootstrap userData, `createAgent`, start control HTTP, start kernel, inject env into preload, kill kernel on quit, Tray + autostart. Pulls together every pure unit from Tasks 3-6 and the modules from Tasks 9-11. Verified manually in Tasks 13-14.

- [ ] **Step 1: Write the main entry.** Write `apps/desktop/src/main/index.ts`:

  ```ts
  import {
    chmodSync,
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync,
  } from 'node:fs'
  import { join } from 'node:path'
  import { app, BrowserWindow, type Tray } from 'electron'
  import { createAgent } from '@metacubexd/agent'
  import { resolveMihomoBinary } from './binary-path'
  import { pickFreePorts } from './free-port'
  import { bootstrapDataDir, type FsLike } from './paths'
  import { makeToken } from './secrets'
  import {
    startControlServer,
    stopControlServer,
    type ControlServer,
  } from './control-server'
  import { createTray, trayIconPath } from './tray'

  // Real fs adapter for bootstrapDataDir (recursive mkdir is idempotent).
  const fsAdapter: FsLike = {
    existsSync,
    mkdirSync: (p) => void mkdirSync(p, { recursive: true }),
    readFileSync: (p) => readFileSync(p, 'utf8'),
    writeFileSync: (p, data) => writeFileSync(p, data, 'utf8'),
  }

  let win: BrowserWindow | null = null
  let tray: Tray | null = null
  let agent: ReturnType<typeof createAgent> | null = null
  let controlServer: ControlServer | null = null

  function defaultConfigSource(): string {
    // packaged -> process.resourcesPath/default-config.yaml ; dev -> repo resources
    return app.isPackaged
      ? join(process.resourcesPath, 'default-config.yaml')
      : join(app.getAppPath(), 'resources', 'default-config.yaml')
  }

  async function boot(): Promise<void> {
    const userData = app.getPath('userData')
    const paths = bootstrapDataDir(userData, defaultConfigSource(), fsAdapter)

    // Resolve mihomo binary (user override read from a settings file if present).
    const overridePath = join(userData, 'mihomo-bin-override.txt')
    const userOverride = existsSync(overridePath)
      ? readFileSync(overridePath, 'utf8').trim()
      : undefined
    const binaryPath = resolveMihomoBinary({
      platform: process.platform,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      userOverride,
    })
    // chmod +x defensively on unix (asar/zip extraction may drop the bit).
    if (process.platform !== 'win32' && existsSync(binaryPath)) {
      try {
        chmodSync(binaryPath, 0o755)
      } catch {
        /* best-effort; agent also chmods on first spawn */
      }
    }

    // Pick two distinct free loopback ports: [controlPort, clashPort].
    const [controlPort, clashPort] = await pickFreePorts(2)
    const controlToken = makeToken()
    const clashSecret = makeToken()

    agent = createAgent({
      binaryPath,
      homeDir: paths.homeDir,
      activeConfigPath: paths.activeConfigPath,
      profilesDir: paths.profilesDir,
      // In-process (Electron) binding skips auth — but we still pass the token
      // so the loopback HTTP face requires it for any external caller.
      agentToken: controlToken,
      // Hand the pre-picked clash endpoint + secret to the supervisor. The
      // supervisor writes external-controller/secret into the active config
      // before spawn (Plan 02 C2 config injection) so the kernel binds exactly
      // these — state.externalController/state.secret echo them back.
      externalController: `127.0.0.1:${clashPort}`,
      secret: clashSecret,
    })

    controlServer = await startControlServer(agent.router, controlPort)

    // Start the kernel; capture the bound external-controller + secret.
    const state = await agent.supervisor.start()

    // Inject the renderer bridge env (consumed by preload/index.ts).
    process.env.MCXD_CONTROL_BASE = `http://127.0.0.1:${controlPort}/api/control`
    process.env.MCXD_CONTROL_TOKEN = controlToken
    process.env.MCXD_CLASH_URL = `http://${state.externalController}`
    process.env.MCXD_CLASH_SECRET = state.secret
  }

  function createWindow(): void {
    win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        preload: join(__dirname, '..', 'preload', 'index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })
    win.once('ready-to-show', () => win?.show())
    // UI is CSR + hashMode + relative baseURL -> loadFile works over file://.
    void win.loadFile(join(__dirname, '..', '..', 'renderer', 'index.html'))
  }

  async function shutdownKernel(): Promise<void> {
    try {
      await agent?.supervisor.stop()
    } catch {
      /* ignore */
    }
    if (controlServer) await stopControlServer(controlServer)
  }

  // Single-instance lock: focus the existing window on a second launch.
  if (!app.requestSingleInstanceLock()) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    })

    app.whenReady().then(async () => {
      await boot()
      createWindow()
      tray = createTray({
        getWindow: () => win,
        startKernel: () => void agent?.supervisor.start(),
        stopKernel: () => void agent?.supervisor.stop(),
        quit: () => app.quit(),
        iconPath: trayIconPath(),
      })
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })

    // Kill the kernel before quitting — orphaned kernel holding the clash port
    // is the classic leak (spec §4).
    let cleanedUp = false
    app.on('before-quit', (event) => {
      if (cleanedUp) return
      event.preventDefault()
      cleanedUp = true
      void shutdownKernel().finally(() => {
        tray?.destroy()
        app.quit()
      })
    })

    app.on('window-all-closed', () => {
      // Keep running in tray on all platforms (kernel stays supervised);
      // quit only via tray/menu.
    })
  }
  ```

  Notes:
  - The kernel's actual `externalController`/`secret` come back on the `KernelState` returned by `supervisor.start()` (spec §3 `KernelState.externalController`, `.secret`). The renderer's `endpoint.url`/`endpoint.secret` are set from that state — the source of truth is the agent, not our pre-picked guess. The pre-picked `clashPort`/`clashSecret` are passed into `createAgent` as `externalController: \`127.0.0.1:${clashPort}\``+`secret: clashSecret`; the supervisor writes them into the active config before spawn (Plan 02 C2 config injection), so the kernel binds exactly these and `state.externalController`/`state.secret`echo them back. Either way the UI is fed from`state`.
  - `before-quit` uses a `cleanedUp` guard + `preventDefault` so the async kernel stop completes before the process exits.

- [ ] **Step 2: Build the full main+preload bundle.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec electron-vite build
  ls -R apps/desktop/out
  ```

  Expected: `apps/desktop/out/main/index.js` and `apps/desktop/out/preload/index.js` both exist. The build log shows `@metacubexd/agent` (and its `tree-kill`/`yaml`/`h3` imports) bundled into the main chunk (no `external` warning for `@metacubexd/agent`). If you see `"@metacubexd/agent" is externalized`, the `exclude` in `electron.vite.config.ts` (Task 2) is wrong — fix and rebuild.

- [ ] **Step 3: Typecheck the whole package.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop typecheck
  ```

  Expected: exits 0. (Resolves `@metacubexd/agent` exports `createAgent`, `KernelState`, etc. from its source `exports` map.)

- [ ] **Step 4: Re-run the pure unit suite to confirm nothing regressed.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop test
  ```

  Expected: all tests from Tasks 3-6 pass (`secrets`, `binary-path`, `free-port`, `paths`) — `15 passed` total (3+6+3+3).

- [ ] **Step 5: Commit.**
  ```bash
  git add apps/desktop/src/main/index.ts
  git commit -m "feat(desktop): wire app lifecycle, control server, kernel and tray"
  ```

---

### Task 13: Renderer copy step + dev verification (MANUAL)

**Files:** none created — exercises the `copy:renderer` script (Task 1) and `electron-vite dev`.

This is the spec §10 step 6 dev check: `electron-vite dev` loads the UI, auto-connects to the locally-started kernel, Start/Stop/Restart works, and quitting leaves no orphan kernel.

- [ ] **Step 1: Build the UI and copy it into the renderer slot.** Run:

  ```bash
  pnpm --filter @metacubexd/ui generate
  pnpm --filter @metacubexd/desktop copy:renderer
  ls apps/desktop/renderer/index.html
  ```

  Expected: `apps/desktop/renderer/index.html` exists (the `nuxt generate` output copied verbatim). This is the exact step CI re-runs (Plan 07 / spec §7: `rm -rf apps/desktop/renderer && cp -r packages/ui/.output/public apps/desktop/renderer`).

- [ ] **Step 2: Ensure a host-arch kernel is staged.** Run:

  ```bash
  test -x apps/desktop/resources/mihomo && echo "kernel present" || node apps/desktop/scripts/fetch-mihomo.mjs
  ```

  Expected: `kernel present`, or a fresh fetch landing `resources/mihomo`.

- [ ] **Step 3: Launch the dev app.** Run (foreground; it opens a window):

  ```bash
  pnpm --filter @metacubexd/desktop dev
  ```

  Expected observations (record each):
  1. An Electron window opens and renders the MetaCubeXD dashboard (the prebuilt UI over `file://`).
  2. The dashboard is already connected to a local endpoint labelled "Local mihomo (desktop)" — no manual URL entry (proves `preload` → `window.metacubexd` → UI `desktop-endpoint.client.ts` seeded the endpoint store; this UI plugin is delivered by Plan 05, so if the UI build predates Plan 05 the endpoint will be absent — in that case verify the bridge directly via Step 4 instead).
  3. The Overview/Setup kernel control panel shows the kernel `running` with a version.

- [ ] **Step 4: Verify the bridge + control API from devtools.** In the open window, press the devtools shortcut (View menu, or `Cmd/Ctrl+Alt+I`) and in the Console run:

  ```js
  copy(window.metacubexd)
  window.metacubexd
  ```

  Expected: an object `{ isDesktop:true, control:{ base:"http://127.0.0.1:<port>/api/control", token:"<48 hex>" }, endpoint:{ url:"http://127.0.0.1:<clashPort>", secret:"<48 hex>" } }`. Then run:

  ```js
  fetch(window.metacubexd.control.base + '/health').then((r) => r.status)
  ```

  Expected: `200` (the agent health route on loopback).

- [ ] **Step 5: Exercise kernel control.** In the UI kernel panel click **Stop**, then **Start**, then **Restart**. Expected: status transitions stopped → running each time; the version reappears after Start/Restart. Confirm in a second terminal:

  ```bash
  pgrep -fl mihomo
  ```

  Expected: exactly ONE mihomo process while running, ZERO after Stop.

- [ ] **Step 6: Verify clean quit — NO orphan kernel.** Quit the app via the Tray → Quit (or `Cmd/Ctrl+Q`). In a terminal:

  ```bash
  pgrep -fl mihomo; echo "exit code $?"
  ```

  Expected: no mihomo line; `exit code 1` (pgrep found nothing). This confirms the `before-quit` shutdown killed the kernel (spec §4 orphan-leak guard).

- [ ] **Step 7: Commit nothing (verification-only), but record results.** If all observations pass, proceed. If the kernel orphaned, debug `before-quit`/`shutdownKernel` before continuing (do NOT proceed to packaging with a known orphan leak).

---

### Task 14: `electron-builder.yml` + `--dir` packaging dry run (MANUAL)

**Files:**

- Create `apps/desktop/electron-builder.yml`

The exact unsigned config from spec §4. Then verify with `electron-builder --dir` (no installer) that the app directory assembles with the kernel sideloaded.

- [ ] **Step 1: Write the electron-builder config.** Write `apps/desktop/electron-builder.yml` exactly:

  ```yaml
  appId: one.metacubex.desktop
  productName: MetaCubeXD
  directories:
    output: dist
    buildResources: build
  files:
    - 'out/**/*'
    - 'renderer/**/*'
    - 'package.json'
  asar: true
  asarUnpack:
    - 'resources/**'
  extraResources:
    - from: resources/mihomo${ext}
      to: mihomo${ext}
    - from: resources/default-config.yaml
      to: default-config.yaml
  mac:
    identity: null
    hardenedRuntime: false
    category: public.app-category.utilities
    target:
      - dmg
      - zip
    artifactName: ${productName}-${version}-mac-${arch}.${ext}
  win:
    target:
      - target: nsis
        arch:
          - x64
          - arm64
    artifactName: ${productName}-${version}-win-${arch}.${ext}
  nsis:
    oneClick: false
    allowToChangeInstallationDirectory: true
    perMachine: false
  linux:
    target:
      - target: AppImage
        arch:
          - x64
          - arm64
      - target: deb
        arch:
          - x64
          - arm64
    category: Network
    artifactName: ${productName}-${version}-linux-${arch}.${ext}
  ```

  Differences from the spec snippet are intentional and additive: `renderer/**/*` is added to `files` because the desktop renderer lives in `apps/desktop/renderer/` (copied from `packages/ui`), and it must ship inside the asar so `loadFile('renderer/index.html')` resolves at runtime. Everything else (appId, asar/asarUnpack, extraResources with `${ext}`, mac `identity:null`+`hardenedRuntime:false`+dmg/zip, win nsis x64+arm64, linux AppImage+deb x64+arm64, artifactNames) matches spec §4 verbatim.
  Note on `${ext}`: electron-builder substitutes `${ext}` for the platform binary extension (`.exe` on win, empty on unix) in `extraResources`, which is allowed; `${arch}` is NOT allowed in `extraResources.from` — that is why the binary is staged at the fixed `resources/mihomo${ext}` path by `fetch-mihomo.mjs` per target arch BEFORE packaging (spec §4).

- [ ] **Step 2: Stage prerequisites for a host-arch `--dir` build.** Run:

  ```bash
  pnpm --filter @metacubexd/ui generate
  pnpm --filter @metacubexd/desktop copy:renderer
  node apps/desktop/scripts/fetch-mihomo.mjs
  pnpm --filter @metacubexd/desktop build
  ```

  Expected: UI generated, `renderer/index.html` present, `resources/mihomo` present, `out/main/index.js` + `out/preload/index.js` present.

- [ ] **Step 3: Run an unpacked (`--dir`) package build.** Run:

  ```bash
  pnpm --filter @metacubexd/desktop exec electron-builder --dir -c electron-builder.yml
  ```

  Expected: completes without a codesign step (mac shows `skipped macOS application code signing  reason=identity explicitly is set to null`). Output lands in `apps/desktop/dist/`.

- [ ] **Step 4: Verify the kernel + default config are sideloaded OUTSIDE the asar.** Run (paths vary by OS; this is the macOS layout — adjust `*.app/Contents/Resources` → `dist/linux-unpacked/resources` on linux, `dist/win-unpacked/resources` on win):

  ```bash
  find apps/desktop/dist -name 'mihomo*' -not -path '*/app.asar/*'
  find apps/desktop/dist -name 'default-config.yaml'
  ```

  Expected: `mihomo` (or `mihomo.exe`) and `default-config.yaml` both appear under a `Resources/`/`resources/` directory NEXT TO `app.asar` (proving `extraResources` placed them spawnable, outside the archive).

- [ ] **Step 5: Verify the agent runtime deps made it INTO the asar.** Run (macOS path shown):

  ```bash
  npx --yes asar list "apps/desktop/dist/mac-arm64/MetaCubeXD.app/Contents/Resources/app.asar" 2>/dev/null | grep -E 'out/main/index.js|out/preload/index.js|renderer/index.html' | head
  ```

  Expected: all three paths listed. (On linux: `dist/linux-unpacked/resources/app.asar`; on win: `dist/win-unpacked/resources/app.asar`.) Because `@metacubexd/agent` + `tree-kill`/`yaml`/`h3` are BUNDLED into `out/main/index.js` by electron-vite, they need not appear as separate `node_modules` entries — their presence is proven by `index.js` existing and the launch test (Step 6) succeeding. This is the spec §4 / §9 "verify agent deps are in the asar" gate.

- [ ] **Step 6: Launch the unpacked app and confirm the kernel runs.** Run the unpacked binary directly (macOS shown):

  ```bash
  open "apps/desktop/dist/mac-arm64/MetaCubeXD.app"
  ```

  (linux: `./apps/desktop/dist/linux-unpacked/metacubexd`; win: `apps/desktop/dist/win-unpacked/MetaCubeXD.exe`.)
  Expected: window opens, dashboard loads, kernel reaches `running`. Verify:

  ```bash
  pgrep -fl mihomo
  ```

  Expected: exactly one mihomo process whose path points INTO the app's `Resources` dir (the sideloaded binary, not the dev `resources/`). Quit via Tray and confirm `pgrep -fl mihomo` returns nothing.

- [ ] **Step 7: Commit (config only — `dist/` is git-ignored).**
  ```bash
  git add apps/desktop/electron-builder.yml
  git commit -m "feat(desktop): add unsigned electron-builder config"
  ```

---

### Task 15: Full unsigned installer build on the current OS (MANUAL)

**Files:** none created — spec §10 step 7 final gate: a real installer (not just `--dir`), installed and launched, with the kernel running. On macOS this includes the quarantine strip the README documents.

- [ ] **Step 1: Build a full installer for the host platform/arch.** Run ONE of (matching your current OS):

  ```bash
  # macOS (arm64 host):
  pnpm --filter @metacubexd/desktop exec electron-builder --mac --arm64 -c electron-builder.yml -c.mac.identity=null --publish never
  # Linux (x64 host):
  pnpm --filter @metacubexd/desktop exec electron-builder --linux --x64 -c electron-builder.yml --publish never
  # Windows (x64 host):
  pnpm --filter @metacubexd/desktop exec electron-builder --win --x64 -c electron-builder.yml --publish never
  ```

  Expected: an installer artifact in `apps/desktop/dist/` — e.g. `MetaCubeXD-1.254.2-mac-arm64.dmg` (+ `.zip`), or `MetaCubeXD-1.254.2-linux-x64.AppImage` (+ `.deb`), or `MetaCubeXD-1.254.2-win-x64.exe`. `--publish never` is mandatory (spec §7) so the builder does NOT create a competing GitHub draft release. No codesign/notarize step runs.

- [ ] **Step 2 (macOS only): Strip the quarantine attribute and install.** Because the build is unsigned, Gatekeeper quarantines it. Run:

  ```bash
  open apps/desktop/dist/MetaCubeXD-1.254.2-mac-arm64.dmg
  # drag MetaCubeXD.app to /Applications in the mounted volume, then:
  xattr -dr com.apple.quarantine /Applications/MetaCubeXD.app
  open /Applications/MetaCubeXD.app
  ```

  Expected: the app launches without the "MetaCubeXD is damaged" dialog after the `xattr` strip (this is the exact instruction the README §3 must give end users). On Linux: `chmod +x dist/*.AppImage && ./dist/*.AppImage`, or `sudo dpkg -i dist/*.deb`. On Windows: run the `.exe`, click "More info → Run anyway" past SmartScreen.

- [ ] **Step 3: Confirm the installed app runs the kernel.** With the installed app open:

  ```bash
  pgrep -fl mihomo
  ```

  Expected: one mihomo process whose binary path is inside the INSTALLED app bundle (e.g. `/Applications/MetaCubeXD.app/Contents/Resources/mihomo`), not the repo. The dashboard shows the kernel `running` and auto-connected. Quit via Tray; confirm `pgrep -fl mihomo` returns nothing (no orphan).

- [ ] **Step 4: Record the result.** This is a verification-only gate. If the installer builds, installs, launches, runs the kernel, and quits cleanly on the current OS, the desktop plan's local scope is complete. (Cross-OS/arch matrix builds are Plan 07/CI.) Commit nothing.

---

## Verification Summary (run before declaring this plan done)

- [ ] `pnpm --filter @metacubexd/desktop test` → all pure-unit tests pass (`secrets`, `binary-path`, `free-port`, `paths`).
- [ ] `pnpm --filter @metacubexd/desktop typecheck` → exits 0.
- [ ] `pnpm --filter @metacubexd/desktop build` → produces `out/main/index.js` + `out/preload/index.js` with `@metacubexd/agent` bundled (not externalized).
- [ ] Task 13 dev launch: UI loads over `file://`, auto-connects, Start/Stop/Restart work, no orphan kernel on quit.
- [ ] Task 14 `--dir`: kernel + default-config sideloaded outside the asar; renderer + main inside the asar; unpacked app runs the kernel.
- [ ] Task 15: a real installer builds unsigned on the current OS, installs (mac: quarantine stripped), launches, runs the kernel, quits with no orphan.
