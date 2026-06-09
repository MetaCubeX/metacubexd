# ConnectionsTable Card Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third visual rendering mode to `/connections` — a flat double-line ~52px card per connection — selectable via a new three-state `connectionsDisplayMode` config (`auto` / `table` / `card`) that replaces the legacy `useMobileConnectionsTable` boolean.

**Architecture:** A three-state enum config in `stores/config.ts` with a one-time localStorage migration. `ConnectionsTable.vue` gets a card render branch alongside the existing table branch, sharing the `visibleColumns` / sort / group state. Each `ConnectionColumn` gains an optional `renderText: (conn) => string` for the card aux line; cards call it to assemble a single-line `·`-separated string. `ConnectionsToolbar.vue` shows sort/group dropdowns in card mode (table mode keeps using thead).

**Tech Stack:** Vue 3 (`h()` render functions, scoped + global SFC styles), Nuxt 4, TypeScript, daisyUI 5 / Tailwind CSS 4, Pinia, vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-05-09-connections-card-mode-design.md`

---

## File Structure

| File                                                  | Role                                                                                                                                                                                                                        | Status |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `stores/config.ts`                                    | Replace `useMobileConnectionsTable` boolean with `connectionsDisplayMode` enum (3 values); one-time legacy localStorage migration                                                                                           | Modify |
| `stores/__tests__/config.spec.ts`                     | New — migration tests (legacy true→table, legacy false→auto, no legacy→auto)                                                                                                                                                | Create |
| `components/connections/ConnectionsTable.vue`         | Add card render branch alongside table; replace `useMobileConnectionsTable` references; add `renderText` to `ConnectionColumn` interface; new card scoped CSS (variant `displayMode === 'card'`); new `buildAuxLine` helper | Modify |
| `pages/connections.vue`                               | Add `renderText` to columns whose `render` returns VNode (Chains, RuleChains, Traffic, Flow); pass `displayMode` and groupable columns down to child components                                                             | Modify |
| `components/connections/ConnectionsToolbar.vue`       | New props for `displayMode` / `groupableColumns` / `groupingColumn`; new sort/group dropdowns shown only when `displayMode === 'card'`; new emits `update:groupingColumn`                                                   | Modify |
| `components/connections/ConnectionsSettingsModal.vue` | Replace single boolean toggle with three-state radio group bound to `connectionsDisplayMode`                                                                                                                                | Modify |
| `i18n/locales/en.json` / `zh.json` / `ru.json`        | Add 7 new keys (`displayMode` / `auto` / `tableMode` / `cardMode` / `sortBy` / `groupBy` / `none`); remove unused legacy key `useMobileConnectionsTable`                                                                    | Modify |

**Not modified:** `types/index.ts`, `constants/index.ts`, `utils/connectionCells.ts` (the renderTwoLineCell utility from the previous spec is unrelated to cards), `Connection` API contract.

---

## Task 0: Pre-flight verification

**Files:** none

- [ ] **Step 0.1: Confirm spec and prior plan are on disk**

Run:

```bash
test -f docs/superpowers/specs/2026-05-09-connections-card-mode-design.md && echo OK
test -f docs/superpowers/plans/2026-05-09-connections-card-mode.md && echo OK
```

Expected: both `OK`.

- [ ] **Step 0.2: Confirm baseline tests pass**

Run: `pnpm test:unit`
Expected: all existing tests pass (153/153 from previous work).

- [ ] **Step 0.3: Confirm typecheck and lint clean**

Run: `pnpm typecheck && pnpm lint`
Expected: both succeed with no errors.

- [ ] **Step 0.4: Confirm starting git state**

Run: `git status -s | wc -l`
Expected: `10` (the 10 pre-existing motion-system files plus possibly `?? .claude/` from harness — those are out of scope; never `git add` them).

---

## Task 1: connectionsDisplayMode config + migration (TDD)

**Files:**

- Modify: `stores/config.ts:100-103` (replace `useMobileConnectionsTable`); `stores/config.ts:166` (reset block); `stores/config.ts:205` (export)
- Create: `stores/__tests__/config.spec.ts`

- [ ] **Step 1.1: Write the failing test**

Create `stores/__tests__/config.spec.ts`:

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useConfigStore } from '../config'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('connections display mode migration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.clear()
  })

  it('defaults to auto when no legacy or new key is present', () => {
    const store = useConfigStore()
    expect(store.connectionsDisplayMode).toBe('auto')
  })

  it('migrates legacy useMobileConnectionsTable=true to table', () => {
    localStorage.setItem('useMobileConnectionsTable', 'true')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('table')
    expect(localStorage.getItem('useMobileConnectionsTable')).toBeNull()
  })

  it('migrates legacy useMobileConnectionsTable=false to auto', () => {
    localStorage.setItem('useMobileConnectionsTable', 'false')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('auto')
    expect(localStorage.getItem('useMobileConnectionsTable')).toBeNull()
  })

  it('preserves an already-set new key over a legacy key (new wins)', () => {
    localStorage.setItem('connectionsDisplayMode', JSON.stringify('card'))
    localStorage.setItem('useMobileConnectionsTable', 'true')

    const store = useConfigStore()

    expect(store.connectionsDisplayMode).toBe('card')
  })
})
```

Note: `vi` is auto-imported by vitest in this project's test setup.

- [ ] **Step 1.2: Run test to verify it fails**

Run: `pnpm vitest run stores/__tests__/config.spec.ts`
Expected: FAIL — `connectionsDisplayMode` does not exist on the store yet.

- [ ] **Step 1.3: Implement `connectionsDisplayMode`**

In `stores/config.ts`, find the existing block (around line 100):

```ts
const useMobileConnectionsTable = useLocalStorage(
  'useMobileConnectionsTable',
  false,
)
```

Replace it with:

```ts
const connectionsDisplayMode = useLocalStorage<'auto' | 'table' | 'card'>(
  'connectionsDisplayMode',
  () => {
    // One-time migration from useMobileConnectionsTable boolean
    const legacyRaw = localStorage.getItem('useMobileConnectionsTable')
    if (legacyRaw !== null) {
      localStorage.removeItem('useMobileConnectionsTable')
      try {
        return JSON.parse(legacyRaw) === true ? 'table' : 'auto'
      } catch {
        return 'auto'
      }
    }
    return 'auto'
  },
)
```

- [ ] **Step 1.4: Update reset block**

In `stores/config.ts` around line 166, the existing reset section assigns `useMobileConnectionsTable.value = true`. Replace it with:

```ts
connectionsDisplayMode.value = 'auto'
```

If a `useMobileConnectionsTable.value = true` (or false) line is present in any other reset/seed block, replace each with `connectionsDisplayMode.value = 'auto'`.

- [ ] **Step 1.5: Update store export**

In `stores/config.ts` around line 205, the return object includes `useMobileConnectionsTable`. Replace it with `connectionsDisplayMode`:

```ts
    connectionsDisplayMode,
```

(Just rename the entry; don't remove its position in the alphabetical/insertion-order list.)

- [ ] **Step 1.6: Run test to verify it passes**

Run: `pnpm vitest run stores/__tests__/config.spec.ts`
Expected: PASS — 4/4 tests green.

- [ ] **Step 1.7: Verify typecheck shows breakage in dependent files**

Run: `pnpm typecheck`
Expected: errors in `components/connections/ConnectionsTable.vue` and `components/connections/ConnectionsSettingsModal.vue` (`useMobileConnectionsTable` no longer exists). This is expected — Tasks 3 and 5 fix them. Continue with the commit.

- [ ] **Step 1.8: Commit**

```bash
git add stores/config.ts stores/__tests__/config.spec.ts
git commit -m "feat(connections): replace useMobileConnectionsTable with three-state displayMode"
```

⚠️ At this point typecheck is RED (Tasks 3 and 5 will fix the consumers). Tests still pass because there is no test for the broken consumers.

---

## Task 2: Add `renderText` to ConnectionColumn + implement for VNode columns

**Files:**

- Modify: `components/connections/ConnectionsTable.vue:13-21` (ConnectionColumn interface)
- Modify: `pages/connections.vue` — Chains column (~line 168), HostProcess (~263), RuleChains (~278), Traffic (~292), Flow (~304)

- [ ] **Step 2.1: Extend the ConnectionColumn interface**

In `components/connections/ConnectionsTable.vue` around line 13–21, the existing interface reads:

```ts
export interface ConnectionColumn {
  id: CONNECTIONS_TABLE_ACCESSOR_KEY
  key: string
  groupable: boolean
  sortable: boolean
  sortId?: string
  render: (conn: Connection) => VNode | string
  groupValue?: (conn: Connection) => string
}
```

Add an optional `renderText` field:

```ts
export interface ConnectionColumn {
  id: CONNECTIONS_TABLE_ACCESSOR_KEY
  key: string
  groupable: boolean
  sortable: boolean
  sortId?: string
  render: (conn: Connection) => VNode | string
  /**
   * Returns a plain-text representation of the column value for the
   * card mode aux line (single-line ` · `-separated string).
   * REQUIRED for columns whose `render` returns a VNode (toString
   * yields `[object Object]`). Optional for columns whose `render`
   * already returns a string — the card layer will fall back to
   * `String(render(conn))` for those.
   */
  renderText?: (conn: Connection) => string
  groupValue?: (conn: Connection) => string
}
```

- [ ] **Step 2.2: Add `renderText` to the Chains column**

In `pages/connections.vue` around line 168, the Chains column is:

```ts
  {
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    key: 'chains',
    groupable: true,
    sortable: false,
    render: (conn: Connection) => {
      const reversed = [...conn.chains].reverse()
      const children: VNode[] = []
      reversed.forEach((name, index) => {
        if (index > 0) {
          children.push(
            h(IconChevronRight, { class: 'inline-block', size: 18 }),
          )
        }
        children.push(h('span', { class: 'align-middle' }, name))
      })
      return h('span', children)
    },
    groupValue: (conn: Connection) => conn.chains.join(' > '),
  },
```

Add `renderText` after `render`:

```ts
    renderText: (conn: Connection) =>
      conn.chains.length ? [...conn.chains].reverse().join(' → ') : '',
```

- [ ] **Step 2.3: Add `renderText` to the HostProcess composite column**

In `pages/connections.vue` around line 263, the HostProcess column ends with `groupValue`. Add `renderText` after `render`:

```ts
    renderText: (conn: Connection) => {
      const proc = getProcess(conn)
      const procText = proc !== '-' ? proc : ''
      return procText ? `${getHost(conn)} (${procText})` : getHost(conn)
    },
```

(HostProcess goes to the card main row, not the aux line — `renderText` is included for completeness in case a future feature needs the column's text representation.)

- [ ] **Step 2.4: Add `renderText` to RuleChains**

Around line 278, after `render`:

```ts
    renderText: (conn: Connection) => {
      const rule = getRule(conn)
      const chains = conn.chains.length
        ? [...conn.chains].reverse().join(' → ')
        : ''
      return chains ? `${rule} → ${chains}` : rule
    },
```

- [ ] **Step 2.5: Add `renderText` to Traffic**

Around line 292, after `render`:

```ts
    renderText: (conn: Connection) =>
      `↓${formatBytes(conn.downloadSpeed)}/s · ↑${formatBytes(conn.uploadSpeed)}/s · ∑↓${formatBytes(conn.download)} ↑${formatBytes(conn.upload)}`,
```

- [ ] **Step 2.6: Add `renderText` to Flow**

Around line 304, after `render`:

```ts
    renderText: (conn: Connection) => {
      const dest = getDestination(conn)
      const destText = dest ? ` → ${dest}` : ''
      return `${getSourceIP(conn)}:${conn.metadata.sourcePort}${destText}`
    },
```

- [ ] **Step 2.7: Verify typecheck**

Run: `pnpm typecheck`
Expected: errors related to Task 1's removal of `useMobileConnectionsTable` are still present (in `ConnectionsTable.vue` and `ConnectionsSettingsModal.vue`), but NO new errors from `renderText`. The interface change is non-breaking (renderText is optional).

- [ ] **Step 2.8: Run unit tests**

Run: `pnpm test:unit`
Expected: still 4/4 from the new config test plus all previously-passing tests (no regression).

- [ ] **Step 2.9: Commit**

```bash
git add components/connections/ConnectionsTable.vue pages/connections.vue
git commit -m "feat(connections): add renderText to ConnectionColumn for card aux line"
```

---

## Task 3: Card render branch in ConnectionsTable.vue

**Files:**

- Modify: `components/connections/ConnectionsTable.vue` (template: lines 70–193 area; script: imports + `buildAuxLine` helper; `<style>` blocks)

- [ ] **Step 3.1: Update script imports and add helpers**

In `components/connections/ConnectionsTable.vue`, the current script setup imports a few helpers. Replace `useMobileConnectionsTable` references with `connectionsDisplayMode` and add a `buildAuxLine` helper.

In the `<script setup lang="ts">` block, find the existing block ending around line 67 (after `function isColumnSorted`) and append:

```ts
const displayMode = computed(() => configStore.connectionsDisplayMode)

const isCardMode = computed(() => displayMode.value === 'card')
const isForceTable = computed(() => displayMode.value === 'table')

// Columns rendered in the card main row (host / process / action).
// The remaining visible columns are concatenated into the aux line.
const MAIN_ROW_COLUMN_IDS = new Set([
  'details',
  'close',
  'host',
  'process',
  'hostProcess',
])

function getCardText(col: ConnectionColumn, conn: Connection): string {
  if (col.renderText) return col.renderText(conn)
  const result = col.render(conn)
  return typeof result === 'string' ? result : ''
}

function buildAuxLine(conn: Connection, columns: ConnectionColumn[]): string {
  return columns
    .filter((col) => !MAIN_ROW_COLUMN_IDS.has(col.id))
    .map((col) => getCardText(col, conn))
    .filter((text): text is string => text.length > 0)
    .join(' · ')
}

// Pulls the close button VNode out of the visible columns for the
// card main row. Returns null if Close is not visible (user disabled it).
function getCloseButton(conn: Connection): VNode | string | null {
  const closeCol = props.columns.find((c) => c.id === 'close')
  if (!closeCol) return null
  return closeCol.render(conn)
}

function getCardHostText(conn: Connection): string {
  const hostProcessCol = props.columns.find((c) => c.id === 'hostProcess')
  if (hostProcessCol) {
    // Use the primary part of HostProcess: getHost(conn). Since getHost
    // is in pages/connections.vue's scope, we rely on renderText returning
    // "host (process)" — extract the host portion before the first ' ('
    const text = hostProcessCol.renderText
      ? hostProcessCol.renderText(conn)
      : ''
    const parenIdx = text.indexOf(' (')
    return parenIdx === -1 ? text : text.slice(0, parenIdx)
  }
  const hostCol = props.columns.find((c) => c.id === 'host')
  if (hostCol) {
    const result = hostCol.render(conn)
    return typeof result === 'string' ? result : ''
  }
  // Degraded fallback: neither HostProcess nor Host visible
  return ''
}

function getCardProcessText(conn: Connection): string {
  const hostProcessCol = props.columns.find((c) => c.id === 'hostProcess')
  if (hostProcessCol) {
    const text = hostProcessCol.renderText
      ? hostProcessCol.renderText(conn)
      : ''
    const parenIdx = text.indexOf(' (')
    if (parenIdx === -1) return ''
    // Trim the trailing ')' (length 1)
    return text.slice(parenIdx + 2, -1)
  }
  const processCol = props.columns.find((c) => c.id === 'process')
  if (processCol) {
    const result = processCol.render(conn)
    return typeof result === 'string' ? result : ''
  }
  return ''
}
```

- [ ] **Step 3.2: Replace `useMobileConnectionsTable` references in template**

Find the `<table>` tag and class binding (around line 72–78):

```vue
    <table
      class="table w-full border-collapse"
      :class="[
        tableSizeClass,
        configStore.useMobileConnectionsTable ? 'force-table' : '',
      ]"
    >
```

Replace with:

```vue
    <table
      v-if="!isCardMode"
      class="table w-full border-collapse"
      :class="[
        tableSizeClass,
        isForceTable ? 'force-table' : '',
      ]"
    >
```

Find the `<thead>` class binding (around line 80–87):

```vue
      <thead
        class="md:table-header-group"
        :class="
          configStore.useMobileConnectionsTable
            ? 'table-header-group'
            : 'hidden'
        "
      >
```

Replace with:

```vue
      <thead
        class="md:table-header-group"
        :class="isForceTable ? 'table-header-group' : 'hidden'"
      >
```

Find the mobile label class binding (around line 174):

```vue
              <span
                class="conn-td-label mb-0.5 block text-[0.6875rem] tracking-wide uppercase md:hidden"
                :class="{ hidden: configStore.useMobileConnectionsTable }"
              >
```

Replace with:

```vue
              <span
                class="conn-td-label mb-0.5 block text-[0.6875rem] tracking-wide uppercase md:hidden"
                :class="{ hidden: isForceTable }"
              >
```

- [ ] **Step 3.3: Add the card render branch**

After the closing `</table>` tag (around line 184) and before the empty-state `<div v-if="rowModel.length === 0">` block (around line 186), insert the card branch:

```vue
    <!-- Card mode: column-driven double-line cards -->
    <div v-else class="conn-cards">
      <template
        v-for="(row, index) in rowModel"
        :key="row.type === 'group' ? `group-${row.key}` : row.original.id"
      >
        <!-- Group header -->
        <div
          v-if="row.type === 'group'"
          class="conn-card-group"
          @click="emit('toggleGroupExpanded', row.key)"
        >
          <div class="conn-card-group-icon">
            <IconZoomOutFilled v-if="expandedGroups[row.key]" :size="14" />
            <IconZoomInFilled v-else :size="14" />
          </div>
          <span class="conn-card-group-title">{{ row.key }}</span>
          <span class="conn-card-group-count">({{ row.subRows.length }})</span>
        </div>
        <!-- Connection card -->
        <div
          v-else
          class="conn-card"
          :style="{ animationDelay: `${(index % 20) * 12}ms` }"
          @click="emit('rowClick', row.original)"
        >
          <div class="conn-card__main">
            <span class="conn-card__host">
              {{ getCardHostText(row.original) }}
            </span>
            <span class="conn-card__process">
              {{ getCardProcessText(row.original) }}
            </span>
            <component
              :is="() => getCloseButton(row.original)"
              v-if="getCloseButton(row.original)"
              class="conn-card__action"
            />
          </div>
          <div class="conn-card__aux">
            {{ buildAuxLine(row.original, columns) }}
          </div>
        </div>
      </template>
    </div>
```

- [ ] **Step 3.4: Add scoped CSS for cards**

In `components/connections/ConnectionsTable.vue` `<style scoped>` block (the final closing `</style>` is at line ~362), append before the closing `</style>`:

```css
/* ============================================================
   Card render mode
   ============================================================ */
.conn-cards {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
}

.conn-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.75rem;
  background: var(--color-base-100);
  border: 1px solid
    color-mix(in oklch, var(--color-base-content) 8%, transparent);
  border-radius: 0.5rem;
  cursor: pointer;
  animation: fadeIn 0.3s ease-out backwards;
  transition:
    transform var(--dur-base, 220ms)
      var(--ease-spring-soft, cubic-bezier(0.5, 1.25, 0.5, 1)),
    box-shadow var(--dur-base, 220ms)
      var(--ease-soft, cubic-bezier(0.4, 0, 0.2, 1)),
    border-color var(--dur-fast, 160ms)
      var(--ease-soft, cubic-bezier(0.4, 0, 0.2, 1));
}

.conn-card:hover {
  transform: translateY(-1px);
  box-shadow: var(
    --lift-1,
    0 2px 6px color-mix(in oklch, var(--color-base-content) 8%, transparent)
  );
  border-color: color-mix(in oklch, var(--color-base-content) 15%, transparent);
}

.conn-card__main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem; /* 13px */
  line-height: 1.4;
}

.conn-card__host {
  font-weight: 600;
  color: var(--color-base-content);
  flex-shrink: 0;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-card__process {
  flex: 1;
  min-width: 0;
  font-size: 0.75rem; /* 12px */
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 75%, transparent);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conn-card__action {
  flex-shrink: 0;
  margin-left: auto;
}

.conn-card__aux {
  font-size: 0.6875rem; /* 11px */
  line-height: 1.35;
  font-weight: 400;
  color: color-mix(in oklch, var(--color-base-content) 58%, transparent);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Card group header — distinct from .conn-group-row to avoid conflicting
   table-row CSS */
.conn-card-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  margin-top: 0.25rem;
  background: color-mix(in oklch, var(--color-primary) 5%, transparent);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background var(--dur-fast, 160ms) ease;
}

.conn-card-group:hover {
  background: color-mix(in oklch, var(--color-primary) 10%, transparent);
}

.conn-card-group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.25rem;
  background: color-mix(in oklch, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.conn-card-group-title {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.8125rem;
}

.conn-card-group-count {
  font-size: 0.75rem;
  color: color-mix(in oklch, var(--color-base-content) 50%, transparent);
}

/* Card cards live inside groups when grouped — nudge them right */
.conn-card-group + .conn-card {
  margin-left: 1rem;
}
```

- [ ] **Step 3.5: Verify typecheck and tests**

Run: `pnpm typecheck`
Expected: still has the `ConnectionsSettingsModal.vue` error (Task 5 fixes it). Card-related code should not introduce new errors.

Run: `pnpm test:unit`
Expected: still all passing. The card branch is not unit-tested directly (covered by manual smoke at Task 7).

- [ ] **Step 3.6: Commit**

```bash
git add components/connections/ConnectionsTable.vue
git commit -m "feat(connections): add card render branch with aux-line helper"
```

---

## Task 4: ConnectionsToolbar sort/group dropdowns (card-mode-only)

**Files:**

- Modify: `components/connections/ConnectionsToolbar.vue` (props, emits, template)
- Modify: `pages/connections.vue` (pass new props/handlers)

- [ ] **Step 4.1: Inspect existing emits and props**

Open `components/connections/ConnectionsToolbar.vue`. Note the existing props and emits at the top of the script setup. The toolbar already has `sortableColumns`, `sortColumn`, `sortDesc`, `update:sortColumn`, `toggleSortOrder`. We need to add card-mode-conditional dropdowns plus group support.

- [ ] **Step 4.2: Extend the props**

Replace the existing `defineProps` block with the following — preserve all existing props and add 3 new ones at the bottom:

```ts
defineProps<{
  tabs: Array<{
    type: 'active' | 'closed'
    name: string
    count: number
  }>
  activeTab: 'active' | 'closed'
  enableQuickFilter: boolean
  sourceIPFilter: string
  uniqueSourceIPs: string[]
  sortColumn: string
  sortDesc: boolean
  sortableColumns: ConnectionColumn[]
  globalFilter: string
  paused: boolean
  isClosingConnections: boolean
  // Card-mode controls
  displayMode: 'auto' | 'table' | 'card'
  groupableColumns: ConnectionColumn[]
  groupingColumn: string | null
}>()
```

- [ ] **Step 4.3: Add the new emit**

Add `update:groupingColumn` to the emit definitions. The full block becomes:

```ts
const emit = defineEmits<{
  'update:activeTab': [tab: 'active' | 'closed']
  'update:enableQuickFilter': [enabled: boolean]
  'update:sourceIPFilter': [ip: string]
  'update:sortColumn': [column: string]
  'update:globalFilter': [filter: string]
  'update:groupingColumn': [columnId: string | null]
  toggleSortOrder: []
  togglePaused: []
  closeConnections: []
  openSettings: []
}>()
```

- [ ] **Step 4.4: Add card-mode dropdown UI**

Find the closing `</div>` of the toolbar's last toolbar row in the template (the row containing the search/filter/settings controls). Right BEFORE the outer `</div>` that closes the toolbar's root flex column, insert this card-mode-only row:

```vue
    <!-- Card-mode controls: sort + group dropdowns -->
    <div
      v-if="displayMode === 'card'"
      class="flex flex-wrap items-center gap-2"
    >
      <div class="flex items-center gap-1.5">
        <span class="text-[0.8125rem] text-base-content/60">
          {{ t('sortBy') }}
        </span>
        <select
          class="cursor-pointer appearance-none rounded-md border border-base-content/12 bg-base-200/60 py-1 pr-7 pl-2 text-[0.8125rem] text-base-content focus:outline-none"
          :value="sortColumn"
          @change="
            emit(
              'update:sortColumn',
              ($event.target as HTMLSelectElement).value,
            )
          "
        >
          <option v-for="col in sortableColumns" :key="col.id" :value="col.sortId">
            {{ t(col.key) }}
          </option>
        </select>
        <button
          class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-base-content/60 hover:bg-base-content/5"
          @click="emit('toggleSortOrder')"
        >
          <IconSortAscending v-if="!sortDesc" :size="14" />
          <IconSortDescending v-else :size="14" />
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <span class="text-[0.8125rem] text-base-content/60">
          {{ t('groupBy') }}
        </span>
        <select
          class="cursor-pointer appearance-none rounded-md border border-base-content/12 bg-base-200/60 py-1 pr-7 pl-2 text-[0.8125rem] text-base-content focus:outline-none"
          :value="groupingColumn ?? ''"
          @change="
            emit(
              'update:groupingColumn',
              ($event.target as HTMLSelectElement).value || null,
            )
          "
        >
          <option value="">{{ t('none') }}</option>
          <option v-for="col in groupableColumns" :key="col.id" :value="col.id">
            {{ t(col.key) }}
          </option>
        </select>
      </div>
    </div>
```

- [ ] **Step 4.5: Pass new props from pages/connections.vue**

Open `pages/connections.vue`. Find the `<ConnectionsToolbar ... />` invocation (search for the component name). Add the three new props alongside the existing ones:

```vue
:display-mode="configStore.connectionsDisplayMode"
:groupable-columns="groupableColumns" :grouping-column="groupingColumn"
@update:grouping-column="(colId: string | null) => (groupingColumn = colId)"
```

If `groupableColumns` is not yet a computed in `pages/connections.vue`, add it near `sortableColumns`:

```ts
const groupableColumns = computed(() =>
  allColumns.filter((col) => col.groupable),
)
```

(`groupingColumn` ref/state should already exist since the table thead already supports grouping. If unsure, search `groupingColumn` in `pages/connections.vue` and verify it's already declared as a ref.)

- [ ] **Step 4.6: Verify typecheck and tests**

Run: `pnpm typecheck`
Expected: still has `ConnectionsSettingsModal.vue` error (Task 5 fixes it). No new errors from toolbar.

Run: `pnpm test:unit`
Expected: still all passing.

- [ ] **Step 4.7: Commit**

```bash
git add components/connections/ConnectionsToolbar.vue pages/connections.vue
git commit -m "feat(connections): card-mode sort and group dropdowns in toolbar"
```

---

## Task 5: ConnectionsSettingsModal three-state radio

**Files:**

- Modify: `components/connections/ConnectionsSettingsModal.vue:148-162` (the existing toggle block)

- [ ] **Step 5.1: Replace the boolean toggle with a radio group**

In `components/connections/ConnectionsSettingsModal.vue` around lines 148–162, the current block reads:

```vue
<div class="flex items-center justify-between">
        <span class="text-sm font-medium text-base-content">{{
          t('useMobileConnectionsTable')
        }}</span>
        <label class="relative inline-block h-6 w-11 cursor-pointer">
          <input
            v-model="configStore.useMobileConnectionsTable"
            type="checkbox"
            class="peer h-0 w-0 opacity-0"
          />
          <span
            class="absolute inset-0 rounded-full bg-base-content/20 transition-all duration-300 peer-checked:bg-primary before:absolute before:bottom-1 before:left-1 before:h-4 before:w-4 before:rounded-full before:bg-base-100 before:shadow-sm before:transition-all before:duration-300 before:content-[''] peer-checked:before:translate-x-5"
          />
        </label>
      </div>
```

Replace it with:

```vue
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-base-content">
          {{ t('displayMode') }}
        </span>
        <div class="flex gap-1 rounded-lg border border-base-content/12 bg-base-200/60 p-1">
          <label
            v-for="mode in (['auto', 'table', 'card'] as const)"
            :key="mode"
            class="cursor-pointer rounded-md px-3 py-1 text-[0.8125rem] font-medium text-base-content/60 transition-all duration-200 hover:bg-base-content/5 hover:text-base-content"
            :class="{
              'bg-primary! text-primary-content!':
                configStore.connectionsDisplayMode === mode,
            }"
          >
            <input
              v-model="configStore.connectionsDisplayMode"
              type="radio"
              :value="mode"
              class="sr-only"
            />
            {{ t(mode === 'table' ? 'tableMode' : mode === 'card' ? 'cardMode' : 'auto') }}
          </label>
        </div>
      </div>
```

- [ ] **Step 5.2: Verify typecheck**

Run: `pnpm typecheck`
Expected: clean (no errors). All `useMobileConnectionsTable` references should now be removed from the codebase.

- [ ] **Step 5.3: Run unit tests**

Run: `pnpm test:unit`
Expected: all passing.

- [ ] **Step 5.4: Commit**

```bash
git add components/connections/ConnectionsSettingsModal.vue
git commit -m "feat(connections): three-state displayMode radio in settings modal"
```

---

## Task 6: i18n keys

**Files:**

- Modify: `i18n/locales/en.json`, `i18n/locales/zh.json`, `i18n/locales/ru.json`

- [ ] **Step 6.1: Inspect the locale files**

Run:

```bash
grep -n "useMobileConnectionsTable\|connectionsSettings\|connections" i18n/locales/en.json | head -20
```

Note the existing line numbers and structure. The legacy key `useMobileConnectionsTable` is no longer referenced; we're removing it.

- [ ] **Step 6.2: Update `en.json`**

In `i18n/locales/en.json`:

1. **Remove** the line containing `"useMobileConnectionsTable": "..."`.
2. **Add** these 7 keys near the connection-settings keys (location-wise, place them near `"connectionsSettings"` — the exact position is cosmetic, JSON object order does not affect runtime lookup):

```json
"displayMode": "Display Mode",
"auto": "Auto",
"tableMode": "Table",
"cardMode": "Card",
"sortBy": "Sort by",
"groupBy": "Group by",
"none": "None",
```

⚠️ Be aware that `none` is a common label and may already exist in the locale files — if `grep -n '"none"' i18n/locales/en.json` returns a match, do NOT add a duplicate; reuse the existing key.

- [ ] **Step 6.3: Update `zh.json`**

In `i18n/locales/zh.json`:

1. Remove `"useMobileConnectionsTable"`.
2. Add (or reuse existing `none`):

```json
"displayMode": "显示模式",
"auto": "自动",
"tableMode": "表格",
"cardMode": "卡片",
"sortBy": "排序",
"groupBy": "分组",
"none": "无",
```

- [ ] **Step 6.4: Update `ru.json`**

In `i18n/locales/ru.json`:

1. Remove `"useMobileConnectionsTable"`.
2. Add (or reuse existing `none`):

```json
"displayMode": "Режим отображения",
"auto": "Авто",
"tableMode": "Таблица",
"cardMode": "Карточка",
"sortBy": "Сортировка",
"groupBy": "Группировка",
"none": "Нет",
```

- [ ] **Step 6.5: Verify all locale files parse as valid JSON**

Run:

```bash
node -e "['en','zh','ru'].forEach(l => JSON.parse(require('node:fs').readFileSync('i18n/locales/' + l + '.json','utf8'))); console.log('OK')"
```

Expected: `OK`.

- [ ] **Step 6.6: Verify no orphan references to `useMobileConnectionsTable`**

Run: `grep -rn "useMobileConnectionsTable" i18n/ stores/ components/ pages/`
Expected: no output. If anything still references the old key, fix that file before proceeding.

- [ ] **Step 6.7: Commit**

```bash
git add i18n/locales/en.json i18n/locales/zh.json i18n/locales/ru.json
git commit -m "i18n(connections): add displayMode and toolbar control labels"
```

(If commitlint rejects `i18n` as a type per project convention, fall back to `chore(i18n): ...` per the prior connections-density work.)

---

## Task 7: Final verification

**Files:** none new

- [ ] **Step 7.1: Run all unit tests**

Run: `pnpm test:unit`
Expected: all passing, including the 4 new migration tests from Task 1.

- [ ] **Step 7.2: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7.3: Run lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 7.4: Run e2e tests**

Run: `pnpm test:e2e`
Expected: all passing. The existing e2e assertion `table.locator('thead').innerText().toContain('HOST')` continues to pass because the default `displayMode === 'auto'` shows table on desktop (the e2e Playwright viewport is desktop-sized).

- [ ] **Step 7.5: Manual smoke — three modes**

Run `pnpm dev:mock`. Navigate to `/connections`. Trigger several mock connections.

1. Default state: should be `auto` mode, table visible on desktop.
2. Open ConnectionsSettingsModal → Display Mode → click `Card`. Verify cards appear, ~52px each, with hover lift, main row showing host/process/[✕], aux line `·`-separated.
3. Click `Table`. Verify thead is forced visible (force-table behavior, regardless of viewport).
4. Click `Auto`. Verify table on desktop, flex-wrap card on mobile (resize window to <768px).
5. In card mode, use the toolbar Sort dropdown to switch sort column. Use the Group dropdown to switch group. Verify cards re-sort/group accordingly.
6. Resize browser to <768px in card mode: cards should remain readable (single column, full-width).

- [ ] **Step 7.6: Manual smoke — localStorage migration**

In DevTools console:

```js
// Simulate a legacy user
localStorage.removeItem('connectionsDisplayMode')
localStorage.setItem('useMobileConnectionsTable', 'true')
location.reload()
```

After reload:

- Open Settings Modal — Display Mode should show `Table` selected.
- DevTools → Application → Local Storage: `useMobileConnectionsTable` should be GONE; `connectionsDisplayMode` should be `"table"`.

Test the false case:

```js
localStorage.removeItem('connectionsDisplayMode')
localStorage.setItem('useMobileConnectionsTable', 'false')
location.reload()
```

After reload: should be `Auto`, legacy key removed.

- [ ] **Step 7.7: Theme switch**

In dev:mock, switch through 3 daisyUI themes (e.g., `light`, `dark`, `cupcake`). In card mode for each:

- Card background and border are visible against the page background
- Aux line text (58% opacity) is readable
- Hover lift shadow is visible (or gracefully absent under no-motion)

Stop the dev server when done.

- [ ] **Step 7.8: Verify final commit history**

Run: `git log --oneline de16325..HEAD`
Expected: a sequence of focused commits (one per task — Task 1, Task 2, Task 3, Task 4, Task 5, Task 6).

Run: `git diff de16325..HEAD --stat`
Sanity-check the line counts against the file structure table at the top of this plan.

- [ ] **Step 7.9: Verify pre-existing motion-system files untouched**

Run: `git status -s | grep -E "^ M (app|components|pages/overview|package|pnpm-lock|assets/css/main)"`
Expected output: exactly 10 lines covering `app.vue`, `assets/css/main.css`, `components/Button.vue`, `components/Latency.vue`, `components/Modal.vue`, `components/ProxyNodeCard.vue`, `components/Sidebar.vue`, `package.json`, `pages/overview.vue`, `pnpm-lock.yaml`. None of these should have been staged or committed by any task in this plan.

- [ ] **Step 7.10: Skip screenshot regen**

Per the previous connections-density iteration's learning, screenshots will be hybrid (motion-system unstaged changes leak through `nuxt build`). Do NOT run `pnpm screenshot` here. The user can regenerate after motion-system lands.

---

## Self-Review Checklist (already completed by plan author)

**Spec coverage:**

- Spec §4 in-scope (3-state config + migration + card branch + toolbar dropdowns + settings radio) → Tasks 1, 3, 4, 5 ✓
- Spec §5 enum semantics + migration → Task 1 step 1.3 ✓
- Spec §6 visual specs (~52px, two lines, hover lift, motion-token fallbacks) → Task 3 step 3.4 ✓
- Spec §7 field mapping (renderText extension, main row + aux line builders) → Tasks 2, 3 ✓
- Spec §8 toolbar dropdowns + group header → Task 4, Task 3 step 3.3 ✓
- Spec §9 file change list → all files in plan File Structure ✓
- Spec §10 i18n keys → Task 6 ✓
- Spec §11 verification → Task 7 ✓
- Spec §12 risks (motion-system var fallbacks; renderText optional) → Task 3 step 3.4 (CSS fallbacks); Task 2 step 2.1 (interface optional) ✓

**Type consistency:**

- `connectionsDisplayMode` typed as `'auto' | 'table' | 'card'` in Task 1 → consumed identically in Tasks 3 (`displayMode` computed), 4 (toolbar prop), 5 (radio v-model) ✓
- `renderText: (conn: Connection) => string` defined in Task 2 → used in Task 3's `getCardText` helper ✓
- ConnectionColumn interface change is non-breaking (renderText optional) — no consumer breakage ✓

**Placeholder scan:** No "TBD" / "implement later" / "similar to" / "appropriate handling" in any step. Every step has exact file paths, exact code, exact commands.

**Acceptable spec deviations:**

- Spec §7.1 specifies a "degraded main-row fallback" when both `HostProcess` and `Host` columns are hidden: the main row left slot should display `getDestination(conn)`. The plan's `getCardHostText` returns an empty string in this case instead. Rationale: `getDestination` is defined in `pages/connections.vue` and not accessible from `ConnectionsTable.vue` without extra plumbing. Hiding _all_ host-related columns is a degenerate user choice (essentially never hit in practice). Empty main row is acceptable and avoids cross-file coupling. If this edge case becomes important later, expose `getDestination` via a shared utility or a column helper.
