---
# Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-package `metacubexd` Nuxt app into a pnpm 10 workspace with the entire current app relocated under `packages/ui` (as `@metacubexd/ui`) and a private root orchestrator (`metacubexd-monorepo`), with ZERO behavior change and ZERO dependency version bumps.

**Architecture:** A `pnpm-workspace.yaml` declares `packages/*` + `apps/*` globs, a single default `catalog:` holding every dependency at its current version, and the consolidated `overrides` (the vite conflict resolved in favor of `npm:rolldown-vite@latest`). The whole Vue app `git mv`s into `packages/ui/` and gets `srcDir: '.'` set explicitly in `nuxt.config.ts`; its `package.json` becomes `@metacubexd/ui` with every dep referenced as `catalog:`. A new private root `package.json` owns only husky/commitlint/lint-staged and `pnpm -r`/`--filter` orchestration scripts. A new root `tsconfig.base.json` provides a strict TS base for the future agent/desktop/server packages. The husky hooks, lint-staged config, commitlint config, and prettier config stay at the workspace root; `docs/`, `.github/`, `LICENSE`, `README.md`, `CHANGELOG.md`, `.gitignore`, `.node-version` stay at root.

**Tech Stack:** pnpm 10 workspaces + catalog, Nuxt 4 (`srcDir:'.'`, `ssr:false`, `hashMode`), rolldown-vite, vitest 4, husky 9, commitlint 21, lint-staged 17, TypeScript 6.

**Depends on:** none. This is plan 01 — every other plan (02-06) assumes this is DONE and references post-migration paths (`packages/ui`, `packages/agent`, `apps/*`).

---

---

## File Structure

Files **Created**:

- `pnpm-workspace.yaml` — REWRITTEN from a 4-line stub into the full workspace manifest: `packages:` globs, the single default `catalog:` (every dep from the old root `package.json`), and the consolidated `overrides` (merged `package.json#pnpm.overrides` + old workspace override, vite conflict resolved to `npm:rolldown-vite@latest`). (Technically a modify, but the entire content is replaced.)
- `package.json` (root) — REWRITTEN into the private orchestrator `metacubexd-monorepo` (scripts + husky/commitlint/lint-staged devDeps only). (The current root `package.json` is `git mv`d to `packages/ui/package.json` first, then a brand-new root one is written.)
- `tsconfig.base.json` (root) — strict TS base for `packages/agent`, `apps/desktop`, `apps/server` to extend later. NOT used by `packages/ui` (it keeps `extends ./.nuxt/tsconfig.json`).
- `packages/ui/package.json` — `@metacubexd/ui`; every dependency referenced as `"catalog:"`; keeps its own scripts (`dev`/`build`/`generate`/`test:unit`/`test:e2e`/`typecheck`/`lint`/`screenshot`/etc.) and `postinstall: nuxt prepare`.

Files **Moved** (via `git mv`, into `packages/ui/`) — the entire current app:

- `app.vue`, `nuxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`
- directories: `pages/`, `components/`, `composables/`, `stores/`, `utils/`, `constants/`, `types/`, `layouts/`, `middleware/`, `plugins/`, `assets/`, `public/`, `i18n/`, `scripts/`, `e2e/`, `__tests__/`, `test/`
- the old static-host docker files (replaced later by plan 05, but they belong with the UI for now): `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`
- the `dist` symlink (recreated under `packages/ui/`, pointing at `packages/ui/.output/public`)

Files **Modified**:

- `packages/ui/nuxt.config.ts` — add `srcDir: '.'` to the config object (line ~9, inside `defineNuxtConfig({...})`). The `import pkg from './package.json'` on line 3 still resolves (package.json moved alongside it).

Files that **STAY AT ROOT** (do NOT move): `.husky/`, `.github/`, `docs/`, `.node-version`, `LICENSE`, `README.md`, `CHANGELOG.md`, `.gitignore`, `.lintstagedrc.yml`, `.commitlintrc.yml`, `.prettierrc`, `.prettierignore`, `.vscode/`, `pnpm-lock.yaml`.

---

## Tasks

> **Ordering note:** Do tasks strictly in order. The `pnpm install` that re-resolves the lockfile happens only ONCE, in Task 8 (the final verification), so that intermediate states never produce a half-migrated `node_modules`. Tasks 1-7 are pure file edits + `git mv` with no install. There is a SINGLE commit at the very end (Task 9) — this entire migration is one atomic commit per spec §2 ("结构迁移单独一个 commit、零版本变更").

---

### Task 1: Write the full `pnpm-workspace.yaml`

**Files:** Modify `/Users/shikun/Developer/opensource/metacubexd/pnpm-workspace.yaml` (currently 4 lines: `neverBuiltDependencies: []` + a `vite` override — replace its entire content).

This task enumerates EVERY dependency from the current root `package.json` (the file you already read: `dependencies` block lines 25-91 + `devDependencies` block lines 114-119) into a single default `catalog:`, at the EXACT same version string (zero bumps). It also merges the two override sources and resolves the vite conflict.

- [ ] **Step 1: Confirm the current dependency set** (verification before edit). Run:

  ```bash
  cat /Users/shikun/Developer/opensource/metacubexd/package.json | python3 -c "import json,sys; d=json.load(sys.stdin); deps={**d.get('dependencies',{}),**d.get('devDependencies',{})}; print(len(deps),'deps'); [print(f'{k}: {v}') for k,v in deps.items()]"
  ```

  Expected output: `69 deps` (65 `dependencies` + 4 `devDependencies`, no name overlap) followed by every name/version pair. This is the exact list to transcribe into the catalog (each line `'<name>': <version>` — quote names that contain `@` or `/`). If the count or any version differs from what is written below, the root `package.json` changed since this plan was written — transcribe from the live output, not from this plan.

- [ ] **Step 2: Replace the entire `pnpm-workspace.yaml`** with the full manifest. Write this EXACT content:

  ```yaml
  packages:
    - 'packages/*'
    - 'apps/*'

  # Single default catalog: every package references deps as "catalog:".
  # Versions are transcribed verbatim from the pre-migration root package.json
  # (dependencies + devDependencies). ZERO version bumps in this migration.
  catalog:
    '@antfu/eslint-config': ^9.0.0
    '@commitlint/config-conventional': ^21.0.2
    '@floating-ui/vue': ^1.1.11
    '@nuxt/fonts': ^0.14.0
    '@nuxtjs/i18n': ^10.4.0
    '@nuxtjs/tailwindcss': ^6.14.0
    '@pinia/nuxt': ^0.11.3
    '@playwright/test': ^1.60.0
    '@prettier/plugin-oxc': ^0.1.4
    '@tabler/icons-vue': ^3.44.0
    '@tailwindcss/typography': ^0.5.20
    '@tailwindcss/vite': ^4.3.0
    '@tanstack/vue-query': ^5.101.0
    '@tanstack/vue-table': ^8.21.3
    '@tanstack/vue-virtual': ^3.13.28
    '@types/byte-size': ^8.1.2
    '@types/d3': ^7.4.3
    '@types/lodash': ^4.17.24
    '@types/lodash-es': ^4.17.12
    '@types/markdown-it': ^14.1.2
    '@types/node': ^25.9.2
    '@types/sortablejs': ^1.15.9
    '@types/uuid': ^11.0.0
    '@vueuse/core': ^14.3.0
    '@vueuse/integrations': ^14.3.0
    '@vueuse/nuxt': ^14.3.0
    byte-size: ^9.0.1
    commitlint: ^21.0.2
    d3: ^7.9.0
    daisyui: ^5.5.23
    dayjs: ^1.11.21
    eslint: ^10.4.1
    eslint-plugin-format: ^2.0.1
    highcharts: ^12.6.0
    husky: ^9.1.7
    is-ip: ^5.0.1
    ky: ^2.0.2
    lint-staged: ^17.0.7
    lodash: ^4.18.1
    lodash-es: ^4.18.1
    markdown-it: ^14.2.0
    match-sorter: ^8.3.0
    nuxt: 4.4.8
    pinia: ^3.0.4
    playwright: ^1.60.0
    prettier: ^3.8.4
    prettier-plugin-tailwindcss: ^0.8.0
    semver: ^7.8.3
    sort-package-json: ^4.0.0
    sortablejs: ^1.15.7
    tailwind-merge: ^3.6.0
    tailwind-variants: ^3.2.2
    tailwindcss: ^4.3.0
    tslib: ^2.8.1
    tsx: ^4.22.4
    typescript: ^6.0.3
    uuid: ^14.0.0
    vite: 8.0.16
    vitest: ^4.1.8
    vue: ^3.5.35
    vue-router: ^5.1.0
    vue-sonner: ^2.0.9
    vue-tsc: ^3.3.4
    vue3-marquee: ^4.2.2
    zod: ^4.4.3
    '@types/semver': ^7.7.1
    '@vite-pwa/nuxt': ^1.1.1
    '@vitest/coverage-v8': ^4.1.8
    jsdom: ^29.1.1
    # NEW-SUBSYSTEM deps (consumed by the future agent/server/desktop packages
    # in plans 02-05, NOT by packages/ui). These are brand-new catalog entries
    # for brand-new packages — they do NOT bump any existing dependency, so the
    # "ZERO version bumps" rule still holds (it forbids changing the version of
    # an already-present dep, not adding a new one). Versions come from spec §1.
    h3: ^1.15.11
    tree-kill: ^1.2.2
    yaml: ^2.9.0
    nitro: ^2.12.6
    electron: ^42.0.0
    electron-vite: ^5.0.0
    electron-builder: ^26.0.0
    monaco-editor: ^0.55.1
    monaco-yaml: ^5.5.1
    meta-json-schema: ^1.19.27

  # overrides MUST live only at the workspace root (pnpm 10/11). This is the
  # merge of OLD package.json#pnpm.overrides + the OLD workspace override.
  # CONFLICT RESOLUTION (see spec §2): the old package.json pinned
  # vite: 8.0.16 in BOTH dependencies and pnpm.overrides, but the old
  # pnpm-workspace.yaml override 'vite: npm:rolldown-vite@latest' WON at install
  # time — the project already runs on rolldown-vite. Keep ONLY rolldown-vite
  # here; drop the 8.0.16 pin. (The 8.0.16 entry survives in the catalog above
  # only as the plain `vite` dependency version for any package that lists it;
  # the override below remaps it to rolldown-vite at resolution time, exactly as
  # today.)
  overrides:
    '@isaacs/brace-expansion': '>=5.0.1'
    '@nuxt/devtools-kit': 3.2.4
    '@unhead/vue': 2.1.15
    'brace-expansion@^1': '>=1.1.15'
    'brace-expansion@^2': '>=2.1.1'
    defu: 6.1.7
    diff: '>=9.0.0'
    h3: '>=1.15.11'
    koa: '>=3.2.1'
    node-forge: '>=1.4.0'
    picomatch: '>=4.0.4'
    rollup: '>=4.60.4'
    serialize-javascript: '>=7.0.5'
    srvx: '>=0.11.16'
    tar: '>=7.5.15'
    yaml: '>=2.9.0'
    vite: 'npm:rolldown-vite@latest'

  neverBuiltDependencies: []
  ```

- [ ] **Step 3: Verify the YAML parses and the override conflict is resolved.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && python3 -c "import yaml; d=yaml.safe_load(open('pnpm-workspace.yaml')); print('packages:', d['packages']); print('catalog count:', len(d['catalog'])); print('vite override:', d['overrides']['vite']); assert d['overrides']['vite']=='npm:rolldown-vite@latest'; assert '8.0.16' not in str(d['overrides'].get('vite','')); print('OK')"
  ```

  Expected output:

  ```
  packages: ['packages/*', 'apps/*']
  catalog count: 79
  vite override: npm:rolldown-vite@latest
  OK
  ```

  (79 = the 69 transcribed UI deps [65 `dependencies` + 4 `devDependencies` from the old root] + 10 NEW-subsystem catalog entries [`h3`, `tree-kill`, `yaml`, `nitro`, `electron`, `electron-vite`, `electron-builder`, `monaco-editor`, `monaco-yaml`, `meta-json-schema`] for the future agent/server/desktop packages. The 10 new entries add NEW deps for NEW packages — they are NOT version bumps of any existing dep, so the "ZERO version bumps" rule still holds. If Step 1 reported a different transcribed total, expect that total + 10 here.)

- [ ] **Step 4: Do NOT commit yet.** (Single atomic commit happens in Task 9.) Leave the file staged for now by NOT running git — just proceed to Task 2.

---

### Task 2: Create the `packages/ui` directory and `git mv` the entire app into it

**Files:** Create directory `/Users/shikun/Developer/opensource/metacubexd/packages/ui/`. `git mv` every app file/dir listed below into it. The `dist` symlink is handled separately (Task 3) because it points at an absolute path.

> Use `git mv` (not plain `mv`) so git records renames and the diff stays reviewable. Each `git mv <src> packages/ui/<src>` preserves history.

- [ ] **Step 1: Create the target directory.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && mkdir -p packages/ui
  ```

  Expected: no output, exit 0.

- [ ] **Step 2: `git mv` the top-level app FILES** (everything except dirs, the symlink, and the root-staying files). Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  git mv app.vue nuxt.config.ts vitest.config.ts eslint.config.mjs tsconfig.json package.json \
         Dockerfile docker-entrypoint.sh .dockerignore \
         packages/ui/
  ```

  Expected: no output, exit 0. (`Dockerfile`/`docker-entrypoint.sh`/`.dockerignore` are the old static-host docker setup; they move with the UI now and are replaced by `apps/server` in plan 05.)

- [ ] **Step 3: `git mv` the app DIRECTORIES.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  git mv pages components composables stores utils constants types \
         layouts middleware plugins assets public i18n \
         scripts e2e __tests__ test \
         packages/ui/
  ```

  Expected: no output, exit 0.

- [ ] **Step 4: Verify the move is complete and nothing app-related is left at root.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  echo "=== still at root (should be ONLY root-staying entries) ===" && \
  git ls-files | awk -F/ '{print $1}' | sort -u && \
  echo "=== now under packages/ui ===" && \
  ls packages/ui
  ```

  Expected: the "still at root" list contains exactly: `.commitlintrc.yml`, `.github`, `.gitignore`, `.husky`, `.lintstagedrc.yml`, `.node-version`, `.prettierignore`, `.prettierrc`, `.vscode`, `CHANGELOG.md`, `LICENSE`, `README.md`, `docs`, `packages`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`. The `packages/ui` listing contains `app.vue`, `nuxt.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, `Dockerfile`, `docker-entrypoint.sh`, `pages`, `components`, `composables`, `stores`, `utils`, `constants`, `types`, `layouts`, `middleware`, `plugins`, `assets`, `public`, `i18n`, `scripts`, `e2e`, `__tests__`, `test`. (NO `app.vue` / `pages` / etc. left at the repo root.)

- [ ] **Step 5: Do NOT commit yet.** Proceed to Task 3.

---

### Task 3: Recreate the `dist` symlink under `packages/ui`

**Files:** The current root `dist` is a symlink → `/Users/shikun/Developer/opensource/metacubexd/.output/public` (absolute path). After migration the Nuxt build output lives at `packages/ui/.output/public`, so the symlink target must be repointed. It is git-tracked as a symlink, so we re-create it with the correct relative target.

- [ ] **Step 1: Remove the stale root symlink from git.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && git rm dist
  ```

  Expected: `rm 'dist'`.

- [ ] **Step 2: Create the new symlink inside `packages/ui` with a RELATIVE target** (so it works regardless of where the repo is cloned). Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd/packages/ui && ln -s .output/public dist
  ```

  Expected: no output, exit 0.

- [ ] **Step 3: Stage the new symlink.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && git add packages/ui/dist
  ```

  Expected: no output, exit 0.

- [ ] **Step 4: Verify it is a symlink with the relative target.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && ls -l packages/ui/dist && git ls-files -s packages/ui/dist
  ```

  Expected: `ls -l` shows `packages/ui/dist -> .output/public`; `git ls-files -s` shows mode `120000` (a symlink) for `packages/ui/dist`.

- [ ] **Step 5: Do NOT commit yet.** Proceed to Task 4.

---

### Task 4: Set `srcDir: '.'` in `packages/ui/nuxt.config.ts`

**Files:** Modify `/Users/shikun/Developer/opensource/metacubexd/packages/ui/nuxt.config.ts` (the `defineNuxtConfig({...})` object opens at line 9; insert `srcDir: '.'` as the first key). Per spec §2: Nuxt 4 auto-detects this project's legacy root layout (top-level `pages/`+`components/`, no `app/` dir), but we set `srcDir` explicitly so the layout never depends on a heuristic.

- [ ] **Step 1: Read the top of the config to confirm the anchor.** Run:

  ```bash
  sed -n '9,13p' /Users/shikun/Developer/opensource/metacubexd/packages/ui/nuxt.config.ts
  ```

  Expected output:

  ```
  export default defineNuxtConfig({
    devtools: { enabled: true },

    css: ['~/assets/css/main.css'],
  ```

- [ ] **Step 2: Insert `srcDir: '.'` as the first config key.** Use an exact edit: replace

  ```ts
  export default defineNuxtConfig({
    devtools: { enabled: true },
  ```

  with

  ```ts
  export default defineNuxtConfig({
    // Workspace move: the Nuxt app is the package root. Pin srcDir explicitly
    // so the legacy root layout (top-level pages/, components/, no app/ dir)
    // never depends on Nuxt 4 auto-detection.
    srcDir: '.',

    devtools: { enabled: true },
  ```

- [ ] **Step 3: Verify the key is present and the file still imports its own package.json.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && grep -n "srcDir: '.'" packages/ui/nuxt.config.ts && grep -n "import pkg from './package.json'" packages/ui/nuxt.config.ts
  ```

  Expected: one match for `srcDir: '.'` and one match for `import pkg from './package.json'` (the package.json moved alongside the config, so this relative import still resolves).

- [ ] **Step 4: Do NOT commit yet.** Proceed to Task 5.

---

### Task 5: Rewrite `packages/ui/package.json` as `@metacubexd/ui` with `catalog:` refs

**Files:** Modify `/Users/shikun/Developer/opensource/metacubexd/packages/ui/package.json` (the file that was just moved from the root). Rename it to `@metacubexd/ui`, rewrite every dependency value to the literal string `"catalog:"`, KEEP its own scripts, KEEP `postinstall: nuxt prepare`, and REMOVE the `pnpm.overrides` block (overrides now live only at the workspace root per spec §2). Do NOT bump any version, do NOT change `version` (still `1.254.2`), do NOT change the dependency NAMES or which list (`dependencies`/`devDependencies`) they sit in.

> Why `"catalog:"`: pnpm resolves `"catalog:"` to the version named in the workspace default catalog (Task 1). Net effect on `node_modules` and the lockfile is identical to the literal versions — only the protocol marker changes.

- [ ] **Step 1: Write the new `packages/ui/package.json`.** Replace the entire file content with this EXACT JSON (note: `name` changed to `@metacubexd/ui`, every dep value is `"catalog:"`, the `pnpm` block is gone, scripts unchanged, version unchanged):

  ```json
  {
    "name": "@metacubexd/ui",
    "version": "1.254.2",
    "description": "Mihomo Dashboard, The Official One, XD",
    "license": "MIT",
    "type": "module",
    "scripts": {
      "build": "nuxt build",
      "build:mock": "MOCK_MODE=true nuxt build",
      "dev": "nuxt dev --host",
      "dev:mock": "MOCK_MODE=true nuxt dev --host",
      "format": "pnpm prettier --write --ignore-unknown .",
      "generate": "nuxt generate",
      "generate:mock": "MOCK_MODE=true nuxt generate",
      "postinstall": "nuxt prepare",
      "lint": "eslint --fix .",
      "preview": "nuxt preview --host",
      "screenshot": "tsx scripts/screenshot.ts",
      "test:e2e": "vitest run e2e/",
      "test:unit": "vitest run --exclude='e2e/**'",
      "test:coverage": "vitest run --coverage --exclude='e2e/**'",
      "typecheck": "vue-tsc --noEmit"
    },
    "dependencies": {
      "@antfu/eslint-config": "catalog:",
      "@commitlint/config-conventional": "catalog:",
      "@floating-ui/vue": "catalog:",
      "@nuxt/fonts": "catalog:",
      "@nuxtjs/i18n": "catalog:",
      "@nuxtjs/tailwindcss": "catalog:",
      "@pinia/nuxt": "catalog:",
      "@playwright/test": "catalog:",
      "@prettier/plugin-oxc": "catalog:",
      "@tabler/icons-vue": "catalog:",
      "@tailwindcss/typography": "catalog:",
      "@tailwindcss/vite": "catalog:",
      "@tanstack/vue-query": "catalog:",
      "@tanstack/vue-table": "catalog:",
      "@tanstack/vue-virtual": "catalog:",
      "@types/byte-size": "catalog:",
      "@types/d3": "catalog:",
      "@types/lodash": "catalog:",
      "@types/lodash-es": "catalog:",
      "@types/markdown-it": "catalog:",
      "@types/node": "catalog:",
      "@types/sortablejs": "catalog:",
      "@types/uuid": "catalog:",
      "@vueuse/core": "catalog:",
      "@vueuse/integrations": "catalog:",
      "@vueuse/nuxt": "catalog:",
      "byte-size": "catalog:",
      "commitlint": "catalog:",
      "d3": "catalog:",
      "daisyui": "catalog:",
      "dayjs": "catalog:",
      "eslint": "catalog:",
      "eslint-plugin-format": "catalog:",
      "highcharts": "catalog:",
      "husky": "catalog:",
      "is-ip": "catalog:",
      "ky": "catalog:",
      "lint-staged": "catalog:",
      "lodash": "catalog:",
      "lodash-es": "catalog:",
      "markdown-it": "catalog:",
      "match-sorter": "catalog:",
      "nuxt": "catalog:",
      "pinia": "catalog:",
      "playwright": "catalog:",
      "prettier": "catalog:",
      "prettier-plugin-tailwindcss": "catalog:",
      "semver": "catalog:",
      "sort-package-json": "catalog:",
      "sortablejs": "catalog:",
      "tailwind-merge": "catalog:",
      "tailwind-variants": "catalog:",
      "tailwindcss": "catalog:",
      "tslib": "catalog:",
      "tsx": "catalog:",
      "typescript": "catalog:",
      "uuid": "catalog:",
      "vite": "catalog:",
      "vitest": "catalog:",
      "vue": "catalog:",
      "vue-router": "catalog:",
      "vue-sonner": "catalog:",
      "vue-tsc": "catalog:",
      "vue3-marquee": "catalog:",
      "zod": "catalog:"
    },
    "devDependencies": {
      "@types/semver": "catalog:",
      "@vite-pwa/nuxt": "catalog:",
      "@vitest/coverage-v8": "catalog:",
      "jsdom": "catalog:"
    }
  }
  ```

  Notes on what changed vs the original: `name` `metacubexd` → `@metacubexd/ui`; the `prepare` script (`nuxt prepare && husky`) is REMOVED from the UI package (husky belongs to the root; `nuxt prepare` is already handled by `postinstall`); the entire `pnpm` block (lines 93-113 of the original) is removed; `packageManager` is removed (it now lives on the root package.json). Everything else (every dep name, version-via-catalog, all other scripts) is unchanged.

- [ ] **Step 2: Verify the JSON is valid and every dep is `catalog:`.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && python3 -c "
  import json
  d=json.load(open('packages/ui/package.json'))
  assert d['name']=='@metacubexd/ui', d['name']
  assert 'pnpm' not in d, 'pnpm block must be removed'
  assert 'prepare' not in d['scripts'], 'prepare must be removed from ui'
  assert d['scripts']['postinstall']=='nuxt prepare'
  deps={**d.get('dependencies',{}),**d.get('devDependencies',{})}
  bad=[k for k,v in deps.items() if v!='catalog:']
  assert not bad, f'non-catalog deps: {bad}'
  print('deps:',len(deps),'all catalog: OK; name:',d['name'])
  "
  ```

  Expected output: `deps: 69 all catalog: OK; name: @metacubexd/ui`. (This counts the UI package's OWN deps, which stay 69 — the 10 NEW-subsystem catalog entries added in Task 1 belong to the future agent/server/desktop packages and are NOT referenced by `packages/ui`. The workspace `catalog:` now has 79 entries, but `packages/ui` references only 69 of them.)

- [ ] **Step 3: Verify the catalog covers every dep this package references** (no `catalog:` ref points at a missing catalog entry). Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && python3 -c "
  import json, yaml
  ui=json.load(open('packages/ui/package.json'))
  cat=yaml.safe_load(open('pnpm-workspace.yaml'))['catalog']
  refs=set({**ui.get('dependencies',{}),**ui.get('devDependencies',{})}.keys())
  missing=[r for r in refs if r not in cat]
  assert not missing, f'catalog missing entries: {missing}'
  print('every ui dep is in the catalog: OK')
  "
  ```

  Expected output: `every ui dep is in the catalog: OK`.

- [ ] **Step 4: Do NOT commit yet.** Proceed to Task 6.

---

### Task 6: Write the private root `package.json` (`metacubexd-monorepo`)

**Files:** Create `/Users/shikun/Developer/opensource/metacubexd/package.json` (a brand-new root file — the old root `package.json` was already `git mv`d into `packages/ui` in Task 2). This is the private orchestrator. It owns ONLY husky/commitlint/lint-staged (the root-level tooling) via `catalog:`, and `pnpm -r`/`--filter` orchestration scripts. The `prepare`/`postinstall` SPLIT (spec §2) lives here: root `prepare: husky` (sets up the root hooks); the `nuxt prepare` stays as `packages/ui`'s `postinstall` (Task 5). Without this split, a root install would run `nuxt prepare` and fail with `nuxt: command not found`.

- [ ] **Step 1: Write `package.json` (root).** Write this EXACT content:

  ```json
  {
    "name": "metacubexd-monorepo",
    "private": true,
    "type": "module",
    "packageManager": "pnpm@10.34.1",
    "scripts": {
      "dev": "pnpm --filter @metacubexd/ui dev",
      "build:ui": "pnpm --filter @metacubexd/ui generate",
      "build:server": "pnpm --filter @metacubexd/server... build",
      "build:desktop": "pnpm --filter @metacubexd/desktop... build",
      "build": "pnpm build:ui && pnpm build:server",
      "typecheck": "pnpm -r typecheck",
      "lint": "pnpm -r lint",
      "prepare:husky": "husky",
      "prepare": "husky"
    },
    "devDependencies": {
      "husky": "catalog:",
      "commitlint": "catalog:",
      "@commitlint/config-conventional": "catalog:",
      "lint-staged": "catalog:"
    }
  }
  ```

  Notes: `prepare` runs `husky` (installs the root hooks at install time); a `prepare:husky` alias is also provided because the spec §2 root-script list names `prepare:husky` explicitly — both point at `husky` so either invocation works. `build:server`/`build:desktop` reference `@metacubexd/server`/`@metacubexd/desktop` (created by plans 04/06); the `...` suffix means "this package AND its workspace dependencies", so it pulls `@metacubexd/ui` + `@metacubexd/agent` first. Those filters resolve to nothing today (the packages don't exist yet) — that is fine; they are wired now so the root script surface is stable for later plans.

- [ ] **Step 2: Verify the JSON is valid, private, and has the orchestration scripts.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && python3 -c "
  import json
  d=json.load(open('package.json'))
  assert d['name']=='metacubexd-monorepo'
  assert d['private'] is True
  assert d['packageManager']=='pnpm@10.34.1'
  for s in ['dev','build:ui','build:server','build:desktop','build','typecheck','lint','prepare','prepare:husky']:
      assert s in d['scripts'], f'missing script {s}'
  assert d['scripts']['prepare']=='husky', 'root prepare must be husky only (no nuxt prepare)'
  assert d['scripts']['dev']=='pnpm --filter @metacubexd/ui dev'
  dd=d['devDependencies']
  assert set(dd)=={'husky','commitlint','@commitlint/config-conventional','lint-staged'}, dd
  assert all(v=='catalog:' for v in dd.values())
  assert 'dependencies' not in d, 'root must have no runtime deps'
  print('root orchestrator OK')
  "
  ```

  Expected output: `root orchestrator OK`.

- [ ] **Step 3: Do NOT commit yet.** Proceed to Task 7.

---

### Task 7: Add the root `tsconfig.base.json`

**Files:** Create `/Users/shikun/Developer/opensource/metacubexd/tsconfig.base.json`. Per spec §1/§2 this is the strict TS base that `packages/agent`, `apps/desktop`, and `apps/server` will `extends` later. `packages/ui` does NOT use it — it keeps `extends ./.nuxt/tsconfig.json` (Nuxt-generated). No package references `tsconfig.base.json` in THIS plan; it is created now so plans 02/04/06 can extend a stable base.

- [ ] **Step 1: Write `tsconfig.base.json`.** Write this EXACT content:

  ```json
  {
    "$schema": "https://json.schemastore.org/tsconfig",
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "lib": ["ES2023"],
      "types": ["node"],
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true,
      "esModuleInterop": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "verbatimModuleSyntax": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "declaration": false,
      "noEmit": true
    }
  }
  ```

  Notes: this is a base only — it has no `include`/`files`, so it never type-checks anything on its own. `"types": ["node"]` and `"declaration": false`/`"noEmit": true` match the agent's "source-exported, NO dist build" contract (plan 02). Consumers (agent/desktop/server) add their own `include` and override fields as needed.

- [ ] **Step 2: Verify the JSON is valid and strict.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && python3 -c "
  import json
  d=json.load(open('tsconfig.base.json'))
  co=d['compilerOptions']
  assert co['strict'] is True
  assert co['module']=='ESNext'
  assert co['moduleResolution']=='Bundler'
  assert co['noEmit'] is True
  assert 'include' not in d and 'files' not in d, 'base must not include files'
  print('tsconfig.base.json OK')
  "
  ```

  Expected output: `tsconfig.base.json OK`.

- [ ] **Step 3: Confirm `packages/ui/tsconfig.json` was NOT changed** (it must still extend the Nuxt-generated config, NOT the new base). Run:

  ```bash
  cat /Users/shikun/Developer/opensource/metacubexd/packages/ui/tsconfig.json
  ```

  Expected output exactly:

  ```json
  {
    "extends": "./.nuxt/tsconfig.json"
  }
  ```

- [ ] **Step 4: Do NOT commit yet.** Proceed to Task 8.

---

### Task 8: Adjust husky hooks for the workspace root and run the install verification

**Files:**

- Verify (no change expected): `/Users/shikun/Developer/opensource/metacubexd/.husky/pre-commit` (contains `pnpm lint-staged`), `/Users/shikun/Developer/opensource/metacubexd/.husky/commit-msg` (contains `pnpm commitlint -e`), `/Users/shikun/Developer/opensource/metacubexd/.lintstagedrc.yml`, `/Users/shikun/Developer/opensource/metacubexd/.commitlintrc.yml`.

The husky hooks, lint-staged config, and commitlint config already sit at the repo root and are already root-appropriate — `pnpm lint-staged` and `pnpm commitlint -e` resolve `lint-staged`/`commitlint` from the root `devDependencies` (Task 6 keeps them via `catalog:`). Because hooks STAY at root, NO file move is needed; we only verify they reference root-level tooling and then perform the single install + boot/build/test verification for the whole migration.

- [ ] **Step 1: Confirm the hooks and configs are root-level and reference root tooling.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  echo "--- pre-commit ---"  && cat .husky/pre-commit && \
  echo "--- commit-msg ---"  && cat .husky/commit-msg && \
  echo "--- .lintstagedrc.yml ---" && cat .lintstagedrc.yml && \
  echo "--- .commitlintrc.yml ---" && cat .commitlintrc.yml
  ```

  Expected output:

  ```
  --- pre-commit ---
  pnpm lint-staged
  --- commit-msg ---
  pnpm commitlint -e
  --- .lintstagedrc.yml ---
  '*': prettier --write --ignore-unknown
  '*.{js,ts,vue,json}': eslint --fix
  --- .commitlintrc.yml ---
  extends:
    - '@commitlint/config-conventional'

  rules:
    'body-max-line-length': [0]
  ```

  No edit needed: `lint-staged`/`commitlint`/`@commitlint/config-conventional` are in the root `devDependencies` (Task 6). `prettier`/`eslint` invoked by lint-staged are resolved from `packages/ui` when lint-staged runs against UI files — pnpm hoists workspace bins, so the root `pnpm lint-staged` finds them. (If a future root-only file needs prettier and the bin is not found, that surfaces as a hook error — verified live in Step 5 below.)

- [ ] **Step 2: Run the install** (this is the ONLY install in the migration — it re-resolves the lockfile with the `catalog:` protocol). Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && pnpm install 2>&1 | tail -40
  ```

  Expected: install completes without error; the `packages/ui` `postinstall` runs `nuxt prepare` (regenerating `packages/ui/.nuxt/`); the root `prepare` runs `husky` (re-installs hooks). No `nuxt: command not found`. Exit 0.

- [ ] **Step 3: Assert the lockfile diff is MINIMAL — only catalog-protocol lines, ZERO version changes.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && git --no-pager diff -- pnpm-lock.yaml | grep -E '^[+-]' | grep -vE '^[+-]{3} ' | grep -viE "catalog|importers|packages/ui|settings|lockfileVersion|^\+\s*$|^\-\s*$" | head -60
  ```

  Expected: NO lines that show a changed package VERSION (e.g. you must NOT see a `-  foo: 1.2.3` paired with `+  foo: 1.3.0`). The only `+`/`-` churn allowed is: the lockfile moving deps under an `importers: packages/ui:` section, adding a top-level `catalogs:` block, and `specifier:`/`catalog:` protocol markers. If ANY resolved version (`version:` field or `/pkg@x.y.z` key) changed, STOP — a version bumped; re-check the catalog in Task 1 against the original `package.json`. (A clean migration changes specifiers and structure, never resolved versions.)

- [ ] **Step 4: Verify the UI dev server boots.** Run (background it, give it time, then check, then kill):

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  timeout 90 pnpm --filter @metacubexd/ui dev > /tmp/ui-dev.log 2>&1 & \
  DEV_PID=$!; \
  for i in $(seq 1 60); do grep -qiE "Local:|localhost:3000|listening|Nuxt .* ready" /tmp/ui-dev.log && break; sleep 1; done; \
  echo "=== dev log tail ==="; tail -25 /tmp/ui-dev.log; \
  kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null; true
  ```

  Expected: `/tmp/ui-dev.log` shows Nuxt starting and a `Local:    http://localhost:3000/` (or similar "ready"/"listening") line, with NO module-resolution / `srcDir` / `Cannot find` errors. The filter `@metacubexd/ui` resolves to the moved package (proves the workspace + package name are correct).

- [ ] **Step 5: Verify `generate` produces `.output/public`.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  pnpm --filter @metacubexd/ui generate 2>&1 | tail -20 && \
  echo "=== output check ===" && \
  test -f packages/ui/.output/public/index.html && echo "index.html: OK" && \
  test -L packages/ui/dist && echo "dist symlink resolves to: $(readlink packages/ui/dist)" && \
  test -f packages/ui/dist/index.html && echo "dist/index.html via symlink: OK"
  ```

  Expected: generate completes; `packages/ui/.output/public/index.html` exists; `index.html: OK`; `dist symlink resolves to: .output/public`; `dist/index.html via symlink: OK`. (Confirms both the build output path and the recreated symlink from Task 3.)

- [ ] **Step 6: Verify unit tests pass via the filter.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && pnpm --filter @metacubexd/ui test:unit 2>&1 | tail -25
  ```

  Expected: vitest runs and reports all test files passing (e.g. `Test Files  N passed` / `Tests  M passed`), exit 0. This exercises `packages/ui/test/setup.ts` (the Nuxt auto-import stubs) and the `__tests__/`/in-source specs from their new location. (If a test fails with `X is not defined`, it predates this migration's structure — but a pure move must not introduce that; investigate before proceeding.)

- [ ] **Step 7: Verify typecheck passes across the workspace.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && pnpm -r typecheck 2>&1 | tail -25
  ```

  Expected: `pnpm -r` runs `typecheck` in `@metacubexd/ui` (the only package with that script today) — `vue-tsc --noEmit` completes with no type errors, exit 0. (Confirms `srcDir:'.'`, the moved `tsconfig.json` extending `./.nuxt/tsconfig.json`, and the `~`/`@` aliases all still resolve from the new location.)

- [ ] **Step 8: Do NOT commit yet.** Proceed to Task 9 for the single atomic commit.

---

### Task 9: Single atomic commit (zero version bumps)

**Files:** Stage and commit ALL of the migration changes from Tasks 1-8 as ONE commit. Per spec §2/§10 step 1: the structural migration is one commit with zero version changes, so the `pnpm-lock.yaml` diff is reviewable as catalog-only.

- [ ] **Step 1: Review the full staged + unstaged change surface.** Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && git add -A && git status && echo "=== rename detection ===" && git --no-pager diff --cached --find-renames --stat | tail -40
  ```

  Expected: `git status` shows renames `<file> -> packages/ui/<file>` for the whole app, new files `pnpm-workspace.yaml` (modified), `package.json` (root, new), `tsconfig.base.json`, modified `pnpm-lock.yaml`, and the `packages/ui/dist` symlink. The `--stat` should show the moves as renames (history preserved). No `CHANGELOG.md`/`LICENSE`/`README.md`/`docs/`/`.github/` changes.

- [ ] **Step 2: Assert NO version bump landed anywhere** (defense against an accidental edit). Run:

  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && \
  python3 -c "import json; print('ui version:', json.load(open('packages/ui/package.json'))['version'])" && \
  git --no-pager diff --cached -- pnpm-lock.yaml | grep -E '^[+-]\s+version:' | head -20 || echo "no resolved-version churn: OK"
  ```

  Expected: `ui version: 1.254.2`; and the `version:` grep prints nothing (followed by `no resolved-version churn: OK`) — i.e. NO resolved package version changed in the lockfile.

- [ ] **Step 3: Commit with a conventional-commit message.** Run:
  ```bash
  cd /Users/shikun/Developer/opensource/metacubexd && git commit -m "refactor(repo): migrate to pnpm workspace monorepo
  ```

Move the entire Nuxt app into packages/ui (@metacubexd/ui) and add a
private root orchestrator (metacubexd-monorepo). Introduce a single
default pnpm catalog holding every dependency at its current version
and consolidate all overrides at the workspace root (vite conflict
resolved to npm:rolldown-vite@latest, dropping the 8.0.16 pin). Split
prepare (root: husky) from postinstall (ui: nuxt prepare) and add a
strict root tsconfig.base.json for the future agent/desktop/server
packages. Pure structural move: zero behavior change, zero version
bumps; lockfile diff is catalog-protocol only."

````
Expected: commit succeeds; the `pre-commit` hook (`pnpm lint-staged`) and `commit-msg` hook (`pnpm commitlint -e`) both pass (the conventional `refactor(repo): ...` subject is valid). Exit 0.

- [ ] **Step 4: Final verification of the committed tree.** Run:
```bash
cd /Users/shikun/Developer/opensource/metacubexd && \
echo "=== HEAD ===" && git --no-pager log -1 --oneline && \
echo "=== working tree clean? ===" && git status --porcelain && echo "(empty above = clean)" && \
echo "=== workspace packages ===" && pnpm -r ls --depth -1 2>/dev/null | grep -E "metacubexd" || pnpm list -r --depth 0 2>/dev/null | head
````

Expected: HEAD is the migration commit; `git status --porcelain` is empty (clean working tree); pnpm reports `@metacubexd/ui` as a workspace package. Migration complete.

---

## Done criteria

- `pnpm-workspace.yaml` has `packages: ['packages/*','apps/*']`, a single `catalog:` with all 79 deps (the 69 transcribed UI deps + 10 NEW-subsystem entries for the future agent/server/desktop packages) at original versions, and consolidated root `overrides` with `vite: npm:rolldown-vite@latest` (no `8.0.16`).
- The entire app lives under `packages/ui/` as `@metacubexd/ui`, every dep via `catalog:`, `srcDir:'.'` set, `postinstall: nuxt prepare` kept, `pnpm.overrides` block removed.
- Root `package.json` is the private `metacubexd-monorepo` orchestrator (scripts + husky/commitlint/lint-staged via `catalog:`), root `prepare: husky`.
- `tsconfig.base.json` exists at root (strict, no `include`); `packages/ui/tsconfig.json` still `extends ./.nuxt/tsconfig.json`.
- husky hooks / lint-staged / commitlint configs remain at root and resolve their bins from root devDeps.
- `pnpm install` succeeds; lockfile diff is catalog-protocol only; `pnpm --filter @metacubexd/ui dev` boots; `generate` produces `.output/public`; `test:unit` passes; `pnpm -r typecheck` passes.
- ONE commit, zero version bumps.
