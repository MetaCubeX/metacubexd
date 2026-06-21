# Extract the General Config Seam Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete config.vue's parallel `localConfig` shadow-store for the kernel's General Config (allow-lan, running mode, unified-delay, interface-name, listener ports) and move that slice behind a new `useGeneralConfig` composable modeled on the proven `useDnsSettings` seam, so the page owns no General-Config reactive state and the sync/save logic becomes unit-testable.

**Architecture:** `useGeneralConfig` is a UI-framework-free composable: a `reactive` form, a `syncFromConfig(config)` hydrator, and per-field savers that dispatch through an injected `mutate({key,value}, {onSuccess?})` seam (the existing `useUpdateConfigMutation`). The load-bearing mode→closeAllConnections side-effect is re-homed via an injected `onModeChange` callback fired on the mode save's `onSuccess`. config.vue is rewired to delegate to it. The TUN fields stay in the page as a deliberate dual-source display adapter (desktop-live `tun.status` merged with remote backend config) — that consolidation is explicitly OUT OF SCOPE here.

**Tech Stack:** Nuxt 3 / Vue 3 (`<script setup>`, auto-imports), Pinia, TanStack Vue Query, Vitest (esbuild, no type-check), vue-tsc (strict). Domain glossary in `/CONTEXT.md` (General Config, Running Mode).

## Global Constraints

- Two independent CI gates, both must pass: `pnpm --filter @metacubexd/ui test:unit` (vitest, esbuild, no types) AND `pnpm --filter @metacubexd/ui typecheck` (vue-tsc, `strict` + `noUncheckedIndexedAccess`). Every `map[key]`/`form[key]` access stays optional-chained or keyed by an `as const` literal union.
- The composable MUST take the configs PATCH as an injected `mutate` seam (mirroring `useDnsSettings`), never import the mutation directly — that is what keeps it unit-testable without a component mount or network.
- Mode-change side-effect is load-bearing: a successful `mode` save must call `proxiesStore.closeAllConnections()`, and ONLY for `mode`, ONLY on success. This is preserved by `saveMode()` passing `{ onSuccess: onModeChange }` to the injected mutate — exactly as the current `updateConfig` does (config.vue:279-295).
- Coercion is fragile: ports bind with `v-model.number`; `syncFromConfig` MUST coerce every port with `|| 0` (config.vue:219-223) or an empty input PATCHes `NaN`. `unified-delay` MUST keep the legacy fallback `config['unified-delay'] ?? config.UnifiedDelay ?? false` (config.vue:209-210) or older mihomo cores break.
- No mount harness: tests are jsdom+vitest only, NO `@vue/test-utils`. config.vue is never mounted — template rewiring is verified by `vue-tsc` typecheck + manual smoke only; the composable carries the unit coverage.
- i18n CONTRACT (learned in the final whole-branch review): `PORT_FIELDS[].label` is a static name token ('Mixed'/'HTTP'/…), NOT a finished label. The template MUST render it through `t('port', { name: port.label })` for both the `<label>` and the `:placeholder` — the old `portList` localized via the `port` key (`"{name} Port"` in all 7 locales). Rendering `{{ port.label }}` bare is an i18n regression (typecheck/unit/grep cannot catch it; only manual or a label snapshot can). The deferred TUN/panelize follow-up must preserve this wrapping.
- `useI18n` is a global auto-import; in tests it is stubbed in `packages/ui/test/setup.ts` (returns the key). `useGeneralConfig` needs no i18n, so it declares nothing.
- OUT OF SCOPE (deferred follow-ups): TUN consolidation (the `tunForm` dual-source adapter, watch#2, `tun.device` home stay as-is — moving them into `useTunConfig` would require it to own remote display state, which is not minimal-blast-radius); panelizing the template into per-domain components. `useDnsSettings`, `useAppearance`, `useSettingsBackup`, `useConfigActions` stay exactly as they are.
- Conventional commits. Commit after every task. Run all commands from the repo root: `/Users/shikun/Developer/opensource/metacubexd`.
- Single-file test run: `pnpm --filter @metacubexd/ui exec vitest run <path-relative-to-packages/ui>`.

---

### Task 1: The `useGeneralConfig` composable

Create the composable + its unit test, modeled on `useDnsSettings`. This is the testable deliverable; config.vue is not touched in this task.

**Files:**

- Create: `packages/ui/composables/useGeneralConfig.ts`
- Test: `packages/ui/composables/__tests__/useGeneralConfig.spec.ts`

**Interfaces:**

- Consumes: the `Config` type from `~/types`; an injected `mutate` matching `useUpdateConfigMutation`'s `mutate(vars, options?)` shape.
- Produces:
  - `interface GeneralConfigMutation { mutate: (vars: { key: keyof Config; value: unknown }, options?: { onSuccess?: () => void }) => unknown }`
  - `interface UseGeneralConfigOptions { mutation: GeneralConfigMutation; onModeChange?: () => void }`
  - `const PORT_FIELDS` — an `as const` array of `{ key, configKey, label }` for the 5 listener ports.
  - `useGeneralConfig(options)` returning `{ form, modes, syncFromConfig, save, saveMode }` where `form` is `reactive`, `modes` is `Ref<string[]>`, `syncFromConfig(config: Config | null | undefined): void`, `save(key: keyof Config, value: unknown): void`, `saveMode(): void`.

- [ ] **Step 1: Write the failing test**

Create `packages/ui/composables/__tests__/useGeneralConfig.spec.ts`:

```ts
// packages/ui/composables/__tests__/useGeneralConfig.spec.ts
import type { Config } from '~/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PORT_FIELDS, useGeneralConfig } from '../useGeneralConfig'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    'allow-lan': true,
    mode: 'global',
    'unified-delay': true,
    'interface-name': 'eth0',
    'mixed-port': 7890,
    port: 7891,
    'socks-port': 7892,
    'redir-port': 7893,
    'tproxy-port': 7894,
    'mode-list': ['rule', 'direct', 'global', 'script'],
    ...overrides,
  } as unknown as Config
}

describe('composables/useGeneralConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('syncFromConfig populates the form from the loaded config', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(makeConfig())

    expect(g.form.allowLan).toBe(true)
    expect(g.form.mode).toBe('global')
    expect(g.form.unifiedDelay).toBe(true)
    expect(g.form.interfaceName).toBe('eth0')
    expect(g.form.mixedPort).toBe(7890)
    expect(g.form.port).toBe(7891)
    expect(g.form.socksPort).toBe(7892)
    expect(g.form.redirPort).toBe(7893)
    expect(g.form.tproxyPort).toBe(7894)
    expect(g.modes.value).toEqual(['rule', 'direct', 'global', 'script'])
  })

  it('syncFromConfig coerces missing ports to 0 and tolerates an empty config', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig({} as Config)

    expect(g.form.allowLan).toBe(false)
    expect(g.form.mode).toBe('rule')
    expect(g.form.interfaceName).toBe('')
    expect(g.form.mixedPort).toBe(0)
    expect(g.form.tproxyPort).toBe(0)
    expect(g.modes.value).toEqual(['rule', 'direct', 'global'])
  })

  it('syncFromConfig honors the legacy UnifiedDelay fallback when unified-delay is absent', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(
      makeConfig({ 'unified-delay': undefined, UnifiedDelay: true } as any),
    )

    expect(g.form.unifiedDelay).toBe(true)
  })

  it('syncFromConfig falls back mode-list -> modes -> default', () => {
    const g = useGeneralConfig({ mutation: { mutate: vi.fn() } })
    g.syncFromConfig(
      makeConfig({ 'mode-list': undefined, modes: ['rule', 'script'] } as any),
    )
    expect(g.modes.value).toEqual(['rule', 'script'])
  })

  it('save dispatches a per-key PATCH through the injected mutate', () => {
    const mutate = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate } })
    g.syncFromConfig(makeConfig())
    g.save('allow-lan', false)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({ key: 'allow-lan', value: false })
  })

  it('saveMode PATCHes mode and fires onModeChange on success only', () => {
    // mutate mock that simulates a SUCCESSFUL mutation by invoking onSuccess.
    const mutate = vi.fn((_vars, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    )
    const onModeChange = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate }, onModeChange })
    g.form.mode = 'global'
    g.saveMode()

    expect(mutate).toHaveBeenCalledWith(
      { key: 'mode', value: 'global' },
      { onSuccess: onModeChange },
    )
    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  it('saveMode does NOT fire onModeChange when the mutation does not succeed', () => {
    // mutate mock that does NOT invoke onSuccess (simulates a failed/pending save).
    const mutate = vi.fn()
    const onModeChange = vi.fn()
    const g = useGeneralConfig({ mutation: { mutate }, onModeChange })
    g.saveMode()

    expect(onModeChange).not.toHaveBeenCalled()
  })

  it('PORT_FIELDS maps every listener port to its config key', () => {
    expect(PORT_FIELDS.map((p) => [p.key, p.configKey])).toEqual([
      ['mixedPort', 'mixed-port'],
      ['port', 'port'],
      ['socksPort', 'socks-port'],
      ['redirPort', 'redir-port'],
      ['tproxyPort', 'tproxy-port'],
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metacubexd/ui exec vitest run composables/__tests__/useGeneralConfig.spec.ts`
Expected: FAIL — cannot find module `../useGeneralConfig`.

- [ ] **Step 3: Write the implementation**

Create `packages/ui/composables/useGeneralConfig.ts`:

```ts
// packages/ui/composables/useGeneralConfig.ts
import type { Config } from '~/types'

// Caller supplies the configs PATCH mutation (useUpdateConfigMutation) so the
// composable stays unit-testable without mounting a component / hitting net.
// `options` mirrors vue-query's mutate(vars, options?) so the mode save can hook
// onSuccess exactly as the page's updateConfig did.
export interface GeneralConfigMutation {
  mutate: (
    vars: { key: keyof Config; value: unknown },
    options?: { onSuccess?: () => void },
  ) => unknown
}

export interface UseGeneralConfigOptions {
  mutation: GeneralConfigMutation
  // Fired on a SUCCESSFUL running-mode change (config.vue wires this to
  // proxiesStore.closeAllConnections — changing mode re-routes the session).
  onModeChange?: () => void
}

// The kernel's listener ports. `as const` so form[port.key] stays a known key
// under noUncheckedIndexedAccess, and configKey is a literal keyof Config.
export const PORT_FIELDS = [
  { key: 'mixedPort', configKey: 'mixed-port', label: 'Mixed' },
  { key: 'port', configKey: 'port', label: 'HTTP' },
  { key: 'socksPort', configKey: 'socks-port', label: 'Socks' },
  { key: 'redirPort', configKey: 'redir-port', label: 'Redir' },
  { key: 'tproxyPort', configKey: 'tproxy-port', label: 'TProxy' },
] as const

// General Config editor backing the config-page Core Config card: the kernel's
// top-level scalar settings (allow-lan, running mode, unified-delay, outbound
// interface, listener ports), all hot-patched via PATCH /configs. Per-field
// auto-save preserves the page's instant-apply UX.
export function useGeneralConfig(options: UseGeneralConfigOptions) {
  const form = reactive({
    allowLan: false,
    mode: 'rule',
    unifiedDelay: false,
    interfaceName: '',
    mixedPort: 0,
    port: 0,
    socksPort: 0,
    redirPort: 0,
    tproxyPort: 0,
  })

  const modes = ref<string[]>(['rule', 'direct', 'global'])

  function syncFromConfig(config: Config | null | undefined) {
    if (!config) return
    form.allowLan = config['allow-lan'] || false
    form.mode = config.mode || 'rule'
    form.unifiedDelay =
      config['unified-delay'] ?? (config as any).UnifiedDelay ?? false
    form.interfaceName = config['interface-name'] || ''
    form.mixedPort = config['mixed-port'] || 0
    form.port = config.port || 0
    form.socksPort = config['socks-port'] || 0
    form.redirPort = config['redir-port'] || 0
    form.tproxyPort = config['tproxy-port'] || 0
    modes.value = config['mode-list'] ||
      (config as any).modes || ['rule', 'direct', 'global']
  }

  function save(key: keyof Config, value: unknown) {
    options.mutation.mutate({ key, value })
  }

  // Running mode is the one field with a side-effect: a successful change drops
  // active connections so the re-route takes effect immediately. Hook it via
  // onSuccess so it fires ONLY for mode and ONLY on success.
  function saveMode() {
    options.mutation.mutate(
      { key: 'mode', value: form.mode },
      { onSuccess: options.onModeChange },
    )
  }

  return { form, modes, syncFromConfig, save, saveMode }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metacubexd/ui exec vitest run composables/__tests__/useGeneralConfig.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck, full suite, commit**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: no errors.
Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: all green.

```bash
git add packages/ui/composables/useGeneralConfig.ts packages/ui/composables/__tests__/useGeneralConfig.spec.ts
git commit -m "feat(ui): add useGeneralConfig composable for the general config seam"
```

---

### Task 2: Rewire config.vue onto `useGeneralConfig`

Delete the General-Config half of `localConfig` and its hydration/save inline logic; wire the page to `useGeneralConfig`; rename the residual TUN-only bag to `tunForm`. No new test — config.vue is never mounted; verified by typecheck + the full suite + manual smoke.

**Files:**

- Modify: `packages/ui/pages/config.vue`

**Interfaces:**

- Consumes: `useGeneralConfig`, `PORT_FIELDS` (Task 1); the existing `useUpdateConfigMutation`, `useTunConfig`, `proxiesStore`.

- [ ] **Step 1: Wire `useGeneralConfig` and shrink the inline state (script)**

In `packages/ui/pages/config.vue`:

(a) Replace the `localConfig` reactive (lines 185-198) with a TUN-only `tunForm`:

```ts
// TUN display adapter — deliberately merges desktop-live tun.status (watch #2)
// with the remote backend config (watch #1) into one bound value. NOT pure
// duplication; consolidating it into useTunConfig is a deferred follow-up.
const tunForm = reactive({
  tunEnable: false,
  tunStack: 'Mixed',
  tunDevice: '',
})
```

(b) Replace the `modes` ref (line 200) and add the `useGeneralConfig` wiring + a tiny TUN PATCH helper. Put this just after the `updateConfigMutation` line (line 88) so `tunConfig` can use `saveTun`:

```ts
// TUN PATCH (remote backends only — desktop routes through /api/control/tun).
function saveTun(value: { enable?: boolean; stack?: string; device?: string }) {
  updateConfigMutation.mutate({ key: 'tun', value: value as any })
}

const generalConfig = useGeneralConfig({
  mutation: {
    mutate: (vars, opts) => updateConfigMutation.mutate(vars as any, opts),
  },
  onModeChange: () => proxiesStore.closeAllConnections(),
})
```

(c) Update `tunConfig` to use `saveTun` instead of the deleted `updateConfig` (line 110):

```ts
const tunConfig = useTunConfig({
  patch: (value) => saveTun(value),
})
```

(d) Update the TUN on\* wrappers (lines 114-140) to read/write `tunForm` instead of `localConfig`:

```ts
async function onTunToggle() {
  await tunConfig.onToggle(tunForm.tunEnable, tunForm.tunStack)
  if (tunConfig.desktopMode.value) {
    tunForm.tunEnable = tunConfig.enabled.value
  }
}

function onTunStackChange() {
  void tunConfig.onStackChange(tunForm.tunStack)
}

async function onRecoverNetwork() {
  await tunConfig.onRecoverNetwork()
  tunForm.tunEnable = tunConfig.enabled.value
}

async function onUninstallHelper() {
  if (!confirm(t('tunUninstallConfirm'))) return
  await tunConfig.onUninstall()
  tunForm.tunEnable = tunConfig.enabled.value
}
```

(e) Replace the hydration watch (lines 203-230) with a thin orchestration watch that delegates to the composables and seeds only the TUN form:

```ts
// Hydrate the domain composables + the TUN adapter from the loaded config.
watch(
  backendConfig,
  (config) => {
    if (!config) return
    generalConfig.syncFromConfig(config)
    dnsSettings.syncFromConfig(config)
    // On desktop the live TUN enable is owned by /api/control/tun (watch below);
    // only seed it from the Clash config on a remote backend.
    if (!tunConfig.desktopMode.value) {
      tunForm.tunEnable = config.tun?.enable || false
    }
    tunForm.tunStack = config.tun?.stack || 'Mixed'
    tunForm.tunDevice = config.tun?.device || ''
  },
  { immediate: true },
)
```

(f) Update the desktop TUN mirror watch (lines 234-241) to target `tunForm`:

```ts
watch(
  () => [tunConfig.enabled.value, tunConfig.stack.value] as const,
  ([enabled, stack]) => {
    if (!tunConfig.desktopMode.value) return
    tunForm.tunEnable = enabled
    if (stack) tunForm.tunStack = stack
  },
)
```

(g) Delete `portList` (lines 243-269) and `updateConfig` (lines 279-295) entirely. Add the `PORT_FIELDS` import to the existing import block (it is a Nuxt auto-imported composable export, so import explicitly to be safe):

```ts
import { PORT_FIELDS, useGeneralConfig } from '~/composables/useGeneralConfig'
```

Keep `getModeLabel` (lines 271-277) as-is — it is a pure i18n label helper, not state.

- [ ] **Step 2: Rewire the template bindings**

In the template, swap the deleted `localConfig`/`updateConfig`/`portList` bindings for the composable. The exact replacements:

- allow-lan (lines 480, 483):

```html
v-model="generalConfig.form.allowLan" @change="generalConfig.save('allow-lan',
generalConfig.form.allowLan)"
```

- mode select (lines 505, 507, 509):

```html
v-model="generalConfig.form.mode" @change="generalConfig.saveMode()"
<option v-for="mode in generalConfig.modes" :key="mode" :value="mode"></option>
```

(the `{{ getModeLabel(mode) }}` at line 510 stays unchanged)

- unified-delay (lines 535, 539):

```html
v-model="generalConfig.form.unifiedDelay"
@change="generalConfig.save('unified-delay', generalConfig.form.unifiedDelay)"
```

- interface-name (lines 563, 567):

```html
v-model="generalConfig.form.interfaceName"
@change="generalConfig.save('interface-name', generalConfig.form.interfaceName)"
```

- TUN toggle / stack / device (lines 603, 709, 737, 741) — rename `localConfig` → `tunForm`:

```html
v-model="tunForm.tunEnable" v-model="tunForm.tunStack"
v-model="tunForm.tunDevice" @change="saveTun({ device: tunForm.tunDevice })"
```

- ports loop (lines 752, 766):

```html
v-for="port in PORT_FIELDS" v-model.number="generalConfig.form[port.key]"
@change="generalConfig.save(port.configKey, generalConfig.form[port.key])"
```

- [ ] **Step 3: Typecheck (the primary gate for this task)**

Run: `pnpm --filter @metacubexd/ui typecheck`
Expected: 0 errors. (vue-tsc will catch any leftover `localConfig`/`portList`/`updateConfig` reference, and any `form[port.key]` index error if `PORT_FIELDS` lost its `as const`.)

Then confirm nothing still references the deleted symbols:

Run: `grep -n "localConfig\|portList\|function updateConfig" packages/ui/pages/config.vue`
Expected: no matches.

- [ ] **Step 4: Full suite + lint**

Run: `pnpm --filter @metacubexd/ui test:unit`
Expected: all green (the suite is unchanged; config.vue has no unit test).
Run: `pnpm --filter @metacubexd/ui exec eslint pages/config.vue composables/useGeneralConfig.ts`
Expected: clean (exit 0) — catches any dangling unused import/local.

- [ ] **Step 5: Manual smoke (real app)**

Run: `pnpm --filter @metacubexd/ui dev:mock`
Open the Config page and verify: the Core Config card shows allow-lan / mode / unified-delay / interface-name / the 5 ports seeded from the backend; toggling allow-lan or changing a port applies immediately; changing the running mode applies (and, with autoCloseConns on, closes connections); the TUN toggle/stack/device still reflect and apply correctly.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/pages/config.vue
git commit -m "refactor(ui): delegate general config to useGeneralConfig, drop the localConfig shadow-store

TUN fields kept as the deliberate dual-source display adapter (tunForm);
consolidating TUN into useTunConfig is a deferred follow-up."
```

---

## Self-Review

**1. Spec coverage** (against the grilled design):

- Delete the General-Config `localConfig` slice + its inline sync/save → ✓ Task 2 Steps 1, 2.
- New `useGeneralConfig` mirroring the `useDnsSettings` seam (injected mutate, reactive form, syncFromConfig) → ✓ Task 1.
- Per-field auto-save (instant-apply UX preserved) → ✓ `save`/`saveMode`, template `@change`.
- Mode→closeAllConnections re-homed via injected `onModeChange` on `onSuccess` → ✓ Task 1 `saveMode` + Task 2 wiring; tested both fires-on-success and not-otherwise.
- Coercion: ports `|| 0`, `unified-delay` legacy fallback → ✓ `syncFromConfig` + dedicated tests.
- `mode-list → modes → default` → ✓ `syncFromConfig` + test.
- DNS stays delegated to `useDnsSettings` unchanged → ✓ (only its `syncFromConfig` call is retained in the thin watch).
- TUN consolidation OUT OF SCOPE; `tunForm` adapter + watch#2 + `saveTun` preserved → ✓ Global Constraints + Task 2.
- Net-new unit coverage for previously-untestable page logic → ✓ Task 1 spec.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every code step shows complete code; every template swap lists exact old→new bindings with line anchors.

**3. Type consistency:** `GeneralConfigMutation.mutate(vars, options?)` (Task 1) is what config.vue injects (Task 2 Step 1b) and matches `useUpdateConfigMutation`'s `mutate(vars, options)` (vue-query). `PORT_FIELDS` (`{key, configKey, label}` `as const`) is consumed in Task 2 Step 2 as `form[port.key]` / `port.configKey`. `save(key, value)` / `saveMode()` / `syncFromConfig` / `form` / `modes` names are identical across Task 1 definition and Task 2 call sites. `saveTun({enable?,stack?,device?})` matches both `tunConfig`'s `patch` value shape and the device `@change`.
