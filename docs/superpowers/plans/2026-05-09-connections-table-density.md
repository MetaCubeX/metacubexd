# ConnectionsTable Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise ConnectionsTable per-row information density from ~1 field/cell to ~2 fields/cell via 6 composite columns with primary/auxiliary two-line cells, while preserving existing user column preferences (double-track migration).

**Architecture:** Add 4 new enum values to the column accessor key, register 4 composite column definitions in `allColumns`, extract a single `renderTwoLineCell(primary, aux)` utility for the main visual mechanism, and update the table's CSS to support stacked cells with strict equal-height rows. The 11 atomic columns remain intact, so existing localStorage column visibility/order configs continue to work. New users get 6 composite columns by default.

**Tech Stack:** Vue 3 (`h()` render functions), Nuxt 4, TypeScript, Tailwind CSS v4, daisyUI v5, vitest + jsdom for unit tests.

**Spec:** `docs/superpowers/specs/2026-05-09-connections-table-density-design.md`

---

## File Structure

| File                                           | Role                                                                                                                                                                      | Status |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `utils/connectionCells.ts`                     | New — `renderTwoLineCell(primary, aux)` factory; pure VNode output; the single visual primitive for all composite cells                                                   | Create |
| `utils/__tests__/connectionCells.spec.ts`      | New — vitest unit tests for renderTwoLineCell                                                                                                                             | Create |
| `constants/index.ts`                           | Add 4 enum values to `CONNECTIONS_TABLE_ACCESSOR_KEY`; flip `CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY` defaults                                                        | Modify |
| `constants/__tests__/connectionsTable.spec.ts` | New — vitest tests covering enum values + default visibility map                                                                                                          | Create |
| `pages/connections.vue`                        | Add 4 composite ConnectionColumn entries to `allColumns` (HostProcess / RuleChains / Traffic / Flow); each `render` calls `renderTwoLineCell(...)` with assembled strings | Modify |
| `components/connections/ConnectionsTable.vue`  | Adjust `.conn-td` padding; new scoped `.conn-cell-stack` / `.conn-primary` / `.conn-aux` styles; reduce fadeIn animationDelay step                                        | Modify |
| `assets/css/main.css`                          | Add `font-variant-numeric: tabular-nums` rule for `.conn-table-container`                                                                                                 | Modify |
| `i18n/locales/en.json`                         | Add `hostProcess` / `ruleChains` / `traffic` / `flow` keys                                                                                                                | Modify |
| `i18n/locales/zh.json`                         | Same keys, Chinese values                                                                                                                                                 | Modify |
| `i18n/locales/ru.json`                         | Same keys, Russian values                                                                                                                                                 | Modify |

**Not modified:** `types/index.ts` (Connection type unchanged), `stores/connections.ts`, `stores/config.ts` (column persistence is enum-driven and handles unknown keys gracefully).

---

## Task 0: Pre-flight verification

**Files:** none

- [ ] **Step 0.1: Confirm spec is on disk**

Run: `test -f docs/superpowers/specs/2026-05-09-connections-table-density-design.md && echo OK`
Expected: `OK`

- [ ] **Step 0.2: Confirm baseline tests pass**

Run: `pnpm test:unit`
Expected: All existing unit tests pass. If any fail, fix or skip them BEFORE starting Task 1 (do not introduce changes on a red baseline).

- [ ] **Step 0.3: Confirm typecheck and lint are clean**

Run: `pnpm typecheck && pnpm lint`
Expected: Both succeed with no errors. If existing errors are present, do not bury them under new work — surface them and decide with the user before continuing.

---

## Task 1: Create renderTwoLineCell utility (TDD)

**Files:**

- Create: `utils/connectionCells.ts`
- Test: `utils/__tests__/connectionCells.spec.ts`

- [ ] **Step 1.1: Write the failing test**

Create `utils/__tests__/connectionCells.spec.ts`:

```ts
import type { VNode } from 'vue'
import { describe, expect, it } from 'vitest'
import { renderTwoLineCell } from '../connectionCells'

function findChildByClass(vnode: VNode, cls: string): VNode | null {
  if (
    typeof vnode.props?.class === 'string' &&
    vnode.props.class.split(/\s+/).includes(cls)
  ) {
    return vnode
  }
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (typeof child === 'object' && child !== null && 'type' in child) {
        const found = findChildByClass(child as VNode, cls)
        if (found) return found
      }
    }
  }
  return null
}

describe('renderTwoLineCell', () => {
  it('renders a stack with primary and aux children', () => {
    const vnode = renderTwoLineCell('example.com:443', 'my-app · /usr/bin/curl')

    expect(vnode.type).toBe('div')
    expect(vnode.props?.class).toBe('conn-cell-stack')
    expect(findChildByClass(vnode, 'conn-primary')?.children).toBe(
      'example.com:443',
    )
    expect(findChildByClass(vnode, 'conn-aux')?.children).toBe(
      'my-app · /usr/bin/curl',
    )
  })

  it('falls back to nbsp when aux is null (preserves equal-height rows)', () => {
    const vnode = renderTwoLineCell('example.com:443', null)

    expect(findChildByClass(vnode, 'conn-aux')?.children).toBe(' ')
  })

  it('falls back to nbsp when aux is an empty string', () => {
    const vnode = renderTwoLineCell('example.com:443', '')

    expect(findChildByClass(vnode, 'conn-aux')?.children).toBe(' ')
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run utils/__tests__/connectionCells.spec.ts`
Expected: FAIL — `Cannot find module '../connectionCells'`.

- [ ] **Step 1.3: Implement renderTwoLineCell**

Create `utils/connectionCells.ts`:

```ts
import type { VNode } from 'vue'
import { h } from 'vue'

const NBSP = ' '

/**
 * Render a two-line table cell with a primary (strong) line and an
 * auxiliary (softer) line. When aux is null/empty, a nbsp placeholder
 * preserves the equal-height row layout.
 */
export function renderTwoLineCell(
  primary: string,
  aux: string | null | undefined,
): VNode {
  return h('div', { class: 'conn-cell-stack' }, [
    h('div', { class: 'conn-primary' }, primary),
    h('div', { class: 'conn-aux' }, aux ? aux : NBSP),
  ])
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `pnpm vitest run utils/__tests__/connectionCells.spec.ts`
Expected: PASS — 3 of 3 tests green.

- [ ] **Step 1.5: Commit**

```bash
git add utils/connectionCells.ts utils/__tests__/connectionCells.spec.ts
git commit -m "feat(connections): add renderTwoLineCell utility for composite cells"
```

---

## Task 2: Add 4 enum values + flip default visibility (TDD)

**Files:**

- Modify: `constants/index.ts:82-101` (enum), `constants/index.ts:109-121` (default visibility)
- Test: `constants/__tests__/connectionsTable.spec.ts`

- [ ] **Step 2.1: Write the failing test**

Create `constants/__tests__/connectionsTable.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CONNECTIONS_TABLE_ACCESSOR_KEY,
  CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY,
} from '../index'

describe('CONNECTIONS_TABLE_ACCESSOR_KEY', () => {
  it('exposes the 4 new composite column keys', () => {
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess).toBe('hostProcess')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains).toBe('ruleChains')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic).toBe('traffic')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Flow).toBe('flow')
  })

  it('preserves all existing atomic column keys', () => {
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Host).toBe('host')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Process).toBe('process')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Rule).toBe('rule')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Chains).toBe('chains')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed).toBe('dlSpeed')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed).toBe('ulSpeed')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP).toBe('sourceIP')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.Destination).toBe('destination')
    expect(CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime).toBe('connectTime')
  })
})

describe('CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY', () => {
  const v = CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY

  it('enables the 6 default composite columns', () => {
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Close]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Details]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Flow]).toBe(true)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime]).toBe(true)
  })

  it('disables atomic columns superseded by composite columns', () => {
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Host]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Process]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Rule]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.Chains]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed]).toBe(false)
    expect(v[CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP]).toBe(false)
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `pnpm vitest run constants/__tests__/connectionsTable.spec.ts`
Expected: FAIL — `Property 'HostProcess' does not exist on type ...` and assertions on non-existent keys.

- [ ] **Step 2.3: Add enum values**

Modify `constants/index.ts` — find the `CONNECTIONS_TABLE_ACCESSOR_KEY` enum (currently at line 82) and add 4 entries before the closing brace:

```ts
export enum CONNECTIONS_TABLE_ACCESSOR_KEY {
  Details = 'details',
  Close = 'close',
  ID = 'ID',
  Type = 'type',
  Process = 'process',
  Host = 'host',
  SniffHost = 'sniffHost',
  Rule = 'rule',
  Chains = 'chains',
  DlSpeed = 'dlSpeed',
  UlSpeed = 'ulSpeed',
  Download = 'dl',
  Upload = 'ul',
  ConnectTime = 'connectTime',
  SourceIP = 'sourceIP',
  SourcePort = 'sourcePort',
  Destination = 'destination',
  InboundUser = 'inboundUser',
  // Composite columns (two-line cells aggregating multiple atomic fields)
  HostProcess = 'hostProcess',
  RuleChains = 'ruleChains',
  Traffic = 'traffic',
  Flow = 'flow',
}
```

- [ ] **Step 2.4: Update default visibility map**

Replace the `CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY` block (currently at lines 109-121) with:

```ts
export const CONNECTIONS_TABLE_INITIAL_COLUMN_VISIBILITY = {
  ...Object.fromEntries(
    CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER.map((i) => [i, false]),
  ),
  // Default 6 columns: Action(Details+Close) | HostProcess | RuleChains | Traffic | Flow | ConnectTime
  [CONNECTIONS_TABLE_ACCESSOR_KEY.Details]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.Close]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.Flow]: true,
  [CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime]: true,
}
```

Note: `CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER = Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY)` automatically picks up the new enum values; no change needed there. The new composite columns will appear at the end of the order, which is fine — users can re-order via Settings Modal.

- [ ] **Step 2.5: Run test to verify it passes**

Run: `pnpm vitest run constants/__tests__/connectionsTable.spec.ts`
Expected: PASS — all assertions green.

- [ ] **Step 2.6: Verify typecheck still clean**

Run: `pnpm typecheck`
Expected: No errors. If new errors appear in unrelated files (e.g., switch statements over `CONNECTIONS_TABLE_ACCESSOR_KEY` that don't yet handle new values), fix them by adding default branches that fall through to existing behavior — do not introduce custom logic for composite keys here (Task 3+ wires render).

- [ ] **Step 2.7: Commit**

```bash
git add constants/index.ts constants/__tests__/connectionsTable.spec.ts
git commit -m "feat(connections): add composite column enum keys and default visibility"
```

---

## Task 3: Wire HostProcess composite column

**Files:**

- Modify: `pages/connections.vue` — imports section, `allColumns` array

- [ ] **Step 3.1: Add import for renderTwoLineCell**

In `pages/connections.vue`, find the existing `~/utils` import (around line 13):

```ts
import { formatIPv6, formatTimeFromNow } from '~/utils'
```

Add a new import line below it:

```ts
import { renderTwoLineCell } from '~/utils/connectionCells'
```

- [ ] **Step 3.2: Add HostProcess column entry to `allColumns`**

`allColumns` declaration order in `pages/connections.vue` is cosmetic — `visibleColumns` re-sorts by `configStore.connectionsTableColumnOrder` at render time, and `CONNECTIONS_TABLE_INITIAL_COLUMN_ORDER` (in `constants/index.ts`) is the persisted default order, derived from `Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY)`. Place the 4 composite entries in a clearly-marked block at the **end** of the `allColumns` array for source readability.

After the `InboundUser` entry (around line 260, just before the closing `]`), insert:

```ts
  // ===== Composite columns (default 6-column layout) =====
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess,
    key: 'hostProcess',
    groupable: true,
    sortable: true,
    sortId: 'Host',
    render: (conn: Connection) => {
      const primary = getHost(conn)
      const aux = [
        conn.metadata.process,
        conn.metadata.processPath,
      ]
        .filter((s): s is string => Boolean(s) && s !== '-')
        .join(' · ')
      return renderTwoLineCell(primary, aux)
    },
    groupValue: (conn: Connection) => getHost(conn),
  },
```

Why the aux assembly differs from `getProcess()`: `getProcess()` falls back to `'-'` for display. In the aux line, `'-'` is noise — better to render nbsp via empty string. The filter `s !== '-'` ensures process and processPath that are placeholder dashes don't pollute aux.

- [ ] **Step 3.3: Manually verify HostProcess column displays**

Run: `pnpm dev:mock`

In a browser, navigate to `http://localhost:3000/connections`. With at least one mock connection visible:

- HostProcess should render two lines per row: host:port on top, process · path below (or empty space if neither present).
- Open ConnectionsSettingsModal, confirm "hostProcess" appears in the column toggle list (label will be `hostProcess` until i18n is added in Task 8 — that is expected at this stage).

If the column does not render or throws a console error, fix before proceeding. Stop the dev server with Ctrl+C.

- [ ] **Step 3.4: Commit**

```bash
git add pages/connections.vue
git commit -m "feat(connections): wire HostProcess composite column"
```

---

## Task 4: Wire RuleChains composite column

**Files:**

- Modify: `pages/connections.vue` — `allColumns` array

- [ ] **Step 4.1: Add RuleChains entry**

After the HostProcess entry added in Task 3 (still inside the `// ===== Composite columns =====` block), append:

```ts
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.RuleChains,
    key: 'ruleChains',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => {
      const primary = getRule(conn)
      const aux = conn.chains.length
        ? [...conn.chains].reverse().join(' → ')
        : ''
      return renderTwoLineCell(primary, aux)
    },
    groupValue: (conn: Connection) => getRule(conn),
  },
```

Note: aux uses plain string `→` (not `IconChevronRight` icons as the atomic Chains column does). Icons would prevent `text-overflow: ellipsis` and break the equal-height aux row. The plain-text arrow is intentional for composite cells.

- [ ] **Step 4.2: Manually verify**

Run: `pnpm dev:mock`. Reload `/connections`. RuleChains column should render `Rule(payload)` in primary and `chain1 → chain2 → ...` (right-to-left, matching atomic Chains column's reverse) in aux. Stop dev server.

- [ ] **Step 4.3: Commit**

```bash
git add pages/connections.vue
git commit -m "feat(connections): wire RuleChains composite column"
```

---

## Task 5: Wire Traffic composite column

**Files:**

- Modify: `pages/connections.vue` — `allColumns` array

- [ ] **Step 5.1: Add Traffic entry**

After the RuleChains entry, append:

```ts
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Traffic,
    key: 'traffic',
    groupable: false,
    sortable: true,
    sortId: 'DlSpeed',
    render: (conn: Connection) => {
      const primary = `↓ ${formatBytes(conn.downloadSpeed)}/s · ↑ ${formatBytes(conn.uploadSpeed)}/s`
      const aux = `∑ ↓${formatBytes(conn.download)} · ↑${formatBytes(conn.upload)}`
      return renderTwoLineCell(primary, aux)
    },
  },
```

The cumulative aux line is always meaningful (total bytes is never undefined), so it never falls back to nbsp.

- [ ] **Step 5.2: Manually verify**

Run `pnpm dev:mock`. Confirm Traffic column shows live download/upload rates in primary line and cumulative totals in aux line, with arrows visible. Watch for column-width jitter as numbers update — if it jitters, Task 7's `tabular-nums` rule has not landed yet (expected; will be fixed there). Stop dev server.

- [ ] **Step 5.3: Commit**

```bash
git add pages/connections.vue
git commit -m "feat(connections): wire Traffic composite column"
```

---

## Task 6: Wire Flow composite column

**Files:**

- Modify: `pages/connections.vue` — `allColumns` array

- [ ] **Step 6.1: Add Flow entry**

After the Traffic entry, append:

```ts
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Flow,
    key: 'flow',
    groupable: true,
    sortable: true,
    sortId: 'SourceIP',
    render: (conn: Connection) => {
      const primary = `${getSourceIP(conn)}:${conn.metadata.sourcePort}`
      const aux = `→ ${getDestination(conn)}`
      return renderTwoLineCell(primary, aux)
    },
    groupValue: (conn: Connection) => getSourceIP(conn),
  },
```

`getSourceIP` and `getDestination` are existing local helpers in `pages/connections.vue` (lines 74 and 80) — no import needed.

- [ ] **Step 6.2: Manually verify**

Run `pnpm dev:mock`. Confirm Flow column shows `sourceIP:sourcePort` on primary line and `→ destinationIP-or-host` on aux line. Stop dev server.

- [ ] **Step 6.3: Commit**

```bash
git add pages/connections.vue
git commit -m "feat(connections): wire Flow composite column"
```

---

## Task 7: CSS — composite cell styles, padding, fadeIn, tabular-nums

**Files:**

- Modify: `components/connections/ConnectionsTable.vue` — `<style scoped>` block (currently lines 195-361)
- Modify: `assets/css/main.css` — add tabular-nums for `.conn-table-container`

- [ ] **Step 7.1: Add composite cell styles to ConnectionsTable.vue**

Inside `<style scoped>` in `components/connections/ConnectionsTable.vue`, append the following block at the end of the file (before the closing `</style>`):

```css
/* ============================================================
   Composite-cell two-line layout (HostProcess / RuleChains /
   Traffic / Flow). Strict equal-height rows are preserved by
   .conn-aux's nbsp placeholder when aux content is empty.
   ============================================================ */
.conn-cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.conn-primary {
  font-size: 0.8125rem; /* 13px */
  line-height: 1.4;
  font-weight: 500;
  color: var(--color-base-content);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-aux {
  font-size: 0.6875rem; /* 11px */
  line-height: 1.35;
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 58%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-height: 14.85px; /* 11px × 1.35 — preserves equal height when aux is nbsp */
}
```

- [ ] **Step 7.2: Adjust .conn-td padding**

In the same scoped style block, find the existing `.conn-td` rule and verify it does not currently set explicit `padding`. Add a desktop-only padding rule. Locate the `@media (min-width: 768px) { .conn-td { ... } }` block (around line 332) and insert padding declarations:

Replace this block:

```css
@media (min-width: 768px) {
  .conn-td {
    width: auto;
    min-width: 0;
    text-align: left !important;
    vertical-align: middle;
    white-space: nowrap;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-base-content) 5%, transparent);
  }
}
```

With:

```css
@media (min-width: 768px) {
  .conn-td {
    width: auto;
    min-width: 0;
    padding: 0.5rem 0.625rem; /* tighter vertical to make room for two lines */
    text-align: left !important;
    vertical-align: middle;
    white-space: nowrap;
    border-bottom: 1px solid
      color-mix(in oklch, var(--color-base-content) 5%, transparent);
  }
}
```

Apply the same padding to the `.force-table .conn-td` rule (around line 344):

Replace:

```css
.force-table .conn-td {
  width: auto;
  min-width: 0;
  text-align: left !important;
  vertical-align: middle;
  white-space: nowrap;
  border-bottom: 1px solid
    color-mix(in oklch, var(--color-base-content) 5%, transparent);
}
```

With:

```css
.force-table .conn-td {
  width: auto;
  min-width: 0;
  padding: 0.5rem 0.625rem;
  text-align: left !important;
  vertical-align: middle;
  white-space: nowrap;
  border-bottom: 1px solid
    color-mix(in oklch, var(--color-base-content) 5%, transparent);
}
```

- [ ] **Step 7.3: Tighten fadeIn animationDelay step**

In `pages/connections.vue` find the line (currently 164 in the data row template):

```ts
:style="{ animationDelay: `${(index % 20) * 15}ms` }"
```

Change `15` to `12`:

```ts
:style="{ animationDelay: `${(index % 20) * 12}ms` }"
```

- [ ] **Step 7.4: Add tabular-nums to main.css**

In `assets/css/main.css`, locate the existing motion design system block. Append a new section at the end of the file (before any final closing braces):

```css
/* ============================================================
   ConnectionsTable — tabular numerics
   Required for column-width stability as live download/upload
   numbers refresh; pairs with composite cell typography in
   components/connections/ConnectionsTable.vue.
   ============================================================ */
.conn-table-container {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7.5: Manually verify visual changes**

Run `pnpm dev:mock`, navigate to `/connections`. Trigger several mock connections. Confirm:

1. Each data row is approximately 50–54px tall (was ~40px before).
2. Composite cells show clear primary/aux hierarchy: aux text is visibly smaller (11px) and dimmer (~58% opacity) than primary (13px / full opacity).
3. Live Traffic numbers do **not** cause column-width jitter (tabular-nums working).
4. Rows with empty aux fields (e.g., a connection with no process info) maintain the same height as rows with full aux content.
5. Switch daisyUI themes via the theme switcher: aux text remains readable in dark, light, and at least one high-contrast theme.

Stop dev server.

- [ ] **Step 7.6: Commit**

```bash
git add components/connections/ConnectionsTable.vue assets/css/main.css pages/connections.vue
git commit -m "style(connections): composite cell typography and tabular-nums"
```

---

## Task 8: i18n — add 4 translation keys

**Files:**

- Modify: `i18n/locales/en.json`
- Modify: `i18n/locales/zh.json`
- Modify: `i18n/locales/ru.json`

- [ ] **Step 8.1: Inspect current locale structure**

Run: `head -30 i18n/locales/en.json`
Note the JSON structure (flat or nested) and where existing connection-related keys (e.g., `host`, `process`, `rule`) are placed. Mirror that placement for the new keys.

- [ ] **Step 8.2: Add keys to en.json**

In `i18n/locales/en.json`, add the following 4 keys at the same nesting level as the existing `host` / `process` / `rule` / `chains` keys:

```json
"hostProcess": "Host / Process",
"ruleChains": "Rule / Chains",
"traffic": "Traffic",
"flow": "Flow"
```

If the existing keys are alphabetically sorted, place new keys to maintain ordering; if not, group them after the related atomic keys.

- [ ] **Step 8.3: Add keys to zh.json**

In `i18n/locales/zh.json`, add at the matching location:

```json
"hostProcess": "主机 / 进程",
"ruleChains": "规则 / 链路",
"traffic": "流量",
"flow": "流向"
```

- [ ] **Step 8.4: Add keys to ru.json**

In `i18n/locales/ru.json`, add at the matching location:

```json
"hostProcess": "Хост / Процесс",
"ruleChains": "Правило / Цепочки",
"traffic": "Трафик",
"flow": "Поток"
```

- [ ] **Step 8.5: Verify all locale files parse as valid JSON**

Run: `node -e "['en','zh','ru'].forEach(l => JSON.parse(require('node:fs').readFileSync('i18n/locales/' + l + '.json','utf8'))); console.log('OK')"`
Expected: `OK`. Any error means a locale file has invalid JSON syntax — fix before continuing.

- [ ] **Step 8.6: Manually verify column header labels**

Run `pnpm dev:mock`. Navigate to `/connections`. Confirm column headers show "Host / Process", "Rule / Chains", "Traffic", "Flow" (in English locale). Switch language to Chinese via the language switcher; confirm headers update to "主机 / 进程", "规则 / 链路", "流量", "流向". Stop dev server.

- [ ] **Step 8.7: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh.json i18n/locales/ru.json
git commit -m "i18n(connections): add composite column header labels"
```

---

## Task 9: Final verification and screenshot regeneration

**Files:** none new; verification across the changed surface

- [ ] **Step 9.1: Run unit test suite**

Run: `pnpm test:unit`
Expected: All tests pass, including the 6 new tests added in Tasks 1–2.

- [ ] **Step 9.2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 9.3: Run lint**

Run: `pnpm lint`
Expected: No errors. Lint may auto-fix formatting in modified files; if so, stage and squash-commit those fixes.

- [ ] **Step 9.4: Run e2e tests**

Run: `pnpm test:e2e`
Expected: All e2e tests pass. If any e2e test was asserting on specific column headers (e.g., "Host" appears in connections page), it may now fail because the default columns changed. If so, update the assertion to expect "Host / Process" or whichever new label is appropriate. Do not weaken the test — update the expected value to match the new default.

- [ ] **Step 9.5: Smoke-test localStorage migration scenarios**

Run `pnpm dev:mock`. In the browser:

1. **Fresh install case:** Open DevTools → Application → Local Storage → clear all entries for the site. Reload. Confirm 6 composite columns are visible by default.
2. **Existing user case:** Run this in the DevTools console to simulate a user who saved the old default visibility before this change:
   ```js
   const cfg = JSON.parse(localStorage.getItem('config') || '{}')
   cfg.connectionsTableColumnVisibility = {
     details: true,
     close: true,
     host: true,
     rule: true,
     chains: true,
     dlSpeed: true,
     ulSpeed: true,
     sourceIP: true,
   }
   localStorage.setItem('config', JSON.stringify(cfg))
   ```
   (Adjust the localStorage key and structure if `configStore` uses a different name — inspect existing entries to confirm.) Reload. Confirm the user still sees the **old 8 atomic columns** as they had configured. Open ConnectionsSettingsModal and confirm the 4 composite columns appear in the toggle list (currently disabled), so the user can opt in.
3. **Re-default case:** If a "reset to defaults" button exists in the settings modal, click it. Confirm the user is migrated to the new 6 composite columns.

Stop dev server.

- [ ] **Step 9.6: Regenerate screenshots**

Run: `pnpm screenshot`
Expected: `pc/connections.png` (and any mobile screenshot covering this page) is regenerated with the new layout. Inspect the new screenshot — it should show two-line cells with visible primary/aux hierarchy.

- [ ] **Step 9.7: Commit screenshot updates (if any)**

Run: `git status -s pc/ mobile/`
If new or modified screenshots are listed, commit them:

```bash
git add pc/ mobile/
git commit -m "chore: update screenshots for connections table density"
```

If no screenshot changes appear, skip this step.

- [ ] **Step 9.8: Final review of the diff**

Run: `git log --oneline main..HEAD`
Expected: a sequence of focused commits, one per task in this plan. If any commit is overly broad (mixing concerns), consider that a signal that the plan was deviated from; flag to the user before merging.

Run: `git diff main..HEAD --stat`
Sanity-check the line counts against the file structure table at the top of this plan. Significant divergence (e.g., 500-line change in `pages/connections.vue` when ~120 was expected) means review where extra changes came from.

---

## Self-Review Checklist (already completed by plan author)

**Spec coverage:**

- Spec §5 (6-column structure) → Tasks 2–6 ✓
- Spec §6 (typography / row height / padding) → Task 7 ✓
- Spec §6 (motion system: no row lift, fadeIn step 12ms, no double-stage entrance) → Task 7 step 7.3 ✓
- Spec §7 (file change list) → File Structure section + Tasks 1–8 cover all listed files ✓
- Spec §8 (i18n keys) → Task 8 ✓
- Spec §9 (verification) → Task 9 ✓
- Spec §10 (risks: localStorage compatibility) → Task 9 step 9.5 explicit smoke test ✓

**Type consistency:**

- `renderTwoLineCell(primary: string, aux: string | null | undefined)` — defined Task 1, used Tasks 3–6 ✓
- `CONNECTIONS_TABLE_ACCESSOR_KEY.HostProcess/RuleChains/Traffic/Flow` — defined Task 2, used Tasks 3–6 ✓
- Existing helpers (`getHost` / `getRule` / `getSourceIP` / `getDestination`) used as-is from pages/connections.vue local scope ✓

**Placeholder scan:** No "TBD" / "implement later" / "similar to" found. Every step has exact file paths, exact code, exact commands.
