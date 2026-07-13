---
name: MetaCubeXD
description: The official Mihomo dashboard — real-time proxy control and observability.
colors:
  primary: 'oklch(74.703% 0.158 39.947)'
  primary-content: 'oklch(14.94% 0.031 39.947)'
  secondary: 'oklch(72.537% 0.177 2.72)'
  accent: 'oklch(71.294% 0.166 299.844)'
  neutral: 'oklch(26% 0.019 237.69)'
  base-100: 'oklch(22% 0.019 237.69)'
  base-200: 'oklch(20% 0.019 237.69)'
  base-300: 'oklch(18% 0.019 237.69)'
  base-content: 'oklch(77.383% 0.043 245.096)'
  info: 'oklch(85.559% 0.085 206.015)'
  success: 'oklch(85.56% 0.085 144.778)'
  warning: 'oklch(85.569% 0.084 74.427)'
  error: 'oklch(85.511% 0.078 16.886)'
typography:
  display:
    fontFamily: "Ubuntu, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', system-ui, sans-serif"
    fontSize: '1.5rem'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.01em'
  headline:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: '1.25rem'
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: '1rem'
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '{typography.display.fontFamily}'
    fontSize: '0.75rem'
    fontWeight: 600
    lineHeight: 1.3
rounded:
  field: '0.5rem'
  box: '1rem'
  pill: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.5rem'
  md: '1rem'
  lg: '1.5rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-content}'
    rounded: '{rounded.field}'
    padding: '0.5rem 1rem'
  button-primary-hover:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-content}'
    rounded: '{rounded.field}'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.base-content}'
    rounded: '{rounded.field}'
    padding: '0.5rem 1rem'
  card:
    backgroundColor: '{colors.base-200}'
    textColor: '{colors.base-content}'
    rounded: '{rounded.box}'
    padding: '1rem'
  input:
    backgroundColor: '{colors.base-100}'
    textColor: '{colors.base-content}'
    rounded: '{rounded.field}'
    padding: '0.5rem 0.75rem'
  latency-pill:
    backgroundColor: 'transparent'
    textColor: '{colors.base-content}'
    rounded: '{rounded.field}'
    padding: '0.25rem 0.375rem'
---

# MetaCubeXD Design System

## 1. Overview

**Creative North Star: "The Instrument Console"**

MetaCubeXD should read like a precision instrument: live values remain stable and
legible, controls give immediate feedback, and state changes never depend on
decoration alone. The default `sunset` theme provides the reference palette, but
the implementation is built on daisyUI semantic roles so it remains correct
across all 32 selectable themes and user overrides.

**Key characteristics:**

- Dark-default (`sunset`), theme-swappable across 32 daisyUI themes; the semantic role is the contract.
- Elastic-physics motion, applied only to real controls and state changes.
- Information-dense but hierarchy-first; tabular numerics for live-updating figures.
- Full parity across desktop and mobile; keyboard-reachable with visible focus rings.

Product users, jobs, scope, and brand principles live in
[PRODUCT.md](./PRODUCT.md). This document specifies visual and interaction
implementation and should not duplicate the product brief.

## 2. Sources of Truth

The YAML front matter above is a portable token reference for the default
`sunset` presentation. It is documentation, not a runtime input. When this file
and the implementation disagree, the running code is authoritative and this
document should be updated in the same change.

- [`assets/css/main.css`](./assets/css/main.css) owns global typography, motion,
  elevation, focus, reduced-motion behavior, and daisyUI theme enablement.
- [`constants/index.ts`](./constants/index.ts) owns the 32 themes exposed by the
  theme selector.
- [`utils/index.ts`](./utils/index.ts) owns latency-band classification and its
  current color classes; [`stores/config.ts`](./stores/config.ts) owns
  user-configurable thresholds.
- Components own their final structure, responsive behavior, and accessibility
  semantics. Reusable behavior should be implemented there or in shared CSS,
  then reflected here.

## 3. Colors

A dark, cool-slate foundation carrying one warm accent (terracotta) with violet and rose supporting hues, plus a full semantic-state set — all expressed as daisyUI roles that re-resolve under every theme.

### Primary

- **Terracotta Signal** (`oklch(74.703% 0.158 39.947)`): the single action/identity color. Primary buttons, the active nav item, the current selection, the scrollbar thumb, focus rings. Warm against the cool base so it reads as "the live thing on the panel." Text on it uses **Ember Ink** (`oklch(14.94% 0.031 39.947)`).

### Secondary

- **Console Rose** (`oklch(72.537% 0.177 2.72)`): secondary emphasis and occasional category accents. Used sparingly; it never competes with Terracotta Signal for "the primary action."

### Accent

- **Signal Violet** (`oklch(71.294% 0.166 299.844)`): the accent role — highlights, charts, the occasional distinct affordance. The third voice, not a fourth surface.

### Neutral

- **Deep Slate 100 / 200 / 300** (`oklch(22% / 20% / 18% 0.019 237.69)`): the three-step surface ramp. base-100 is the app canvas, base-200 lifts panels and cards a step forward, base-300 is the recessed / toolbar layer. The tiny 0.019 chroma toward blue keeps it a _cool_ dark, never a dead gray.
- **Panel Text** (`oklch(77.383% 0.043 245.096)`): base-content. The default readout/label color; light blue-gray, tuned to clear 4.5:1 on base-100.
- **Neutral Surface** (`oklch(26% 0.019 237.69)`): the `neutral` role for muted chips and inert fills.

### Semantic states

- **Info Cyan** (`oklch(85.559% 0.085 206.015)`), **Success Green** (`oklch(85.56% 0.085 144.778)`), **Warning Amber** (`oklch(85.569% 0.084 74.427)`), **Error Salmon** (`oklch(85.511% 0.078 16.886)`): status and feedback. High-lightness so they stay legible as text on the dark base.

### Named Rules

**The Role-Is-The-Contract Rule.** Never hardcode a hex or a raw Tailwind color (`text-red-500`) for a themeable surface. Bind to the daisyUI role (`text-error`, `bg-primary`, `var(--color-base-content)`) so it re-resolves under all 32 themes and honors user color overrides. Raw palette colors are a bug the moment the theme changes.

**The One Signal Rule.** Terracotta Signal marks the _one_ primary action or current selection on a surface. If two things on screen are both terracotta-primary, one of them is wrong.

## 4. Typography

**Display / Body / Label Font:** Ubuntu (with `PingFang SC`, `Hiragino Sans GB`, `Microsoft YaHei`, `Noto Sans CJK SC`, `system-ui` CJK + system fallbacks). One family across the whole product.
**Flag glyphs:** `Twemoji Mozilla`, scoped by `unicode-range` to regional-indicator flag codepoints only — it is never the primary family for body text.

**Character:** One humanist sans, four weights (300/400/500/700), doing all the work — headings, controls, labels, and dense data. Product UI doesn't need a display/body pairing; contrast comes from weight and size on a tight scale, not from mixing families.

### Hierarchy

- **Display** (700, 1.5rem / 24px, lh 1.2, tracking −0.01em): page and panel titles. Fixed rem, not fluid — a dashboard title should not shrink when it lands in a sidebar.
- **Headline** (700, 1.25rem / 20px, lh 1.25): section headers within a page.
- **Title** (500, 1rem / 16px, lh 1.4): card headers, group names, prominent labels.
- **Body** (400, 0.875rem / 14px, lh 1.5): the workhorse — descriptions, list content, most UI text. Prose caps at 65–75ch; dense tables may run wider.
- **Label** (600, 0.75rem / 12px, lh 1.3): meta, badges, latency pills, table column heads. Not uppercase-tracked by default.

### Named Rules

**The Tabular-Numerics Rule.** Any figure that updates live — download/upload speeds, latency, connection counts — uses `font-variant-numeric: tabular-nums` so columns don't twitch as digits change. This is mandatory in `ConnectionsTable` and every live readout.

## 5. Elevation

Flat at rest, lifted by state. The reference `sunset` theme uses
`--depth: 0` and `--noise: 0`; other selectable daisyUI themes may define
different values. Project-owned surfaces still use the base-100/200/300 tonal
ramp rather than resting shadows. Depth is a _response_: it appears on hover,
drag, and floating layers (modals, tooltips, dropdowns). A three-step lift
vocabulary encodes this, tuned in `oklab` from `--color-base-content` so it
works under light and dark themes.

### Shadow Vocabulary

- **Lift 1** (`--lift-1`): low elevation for subtle floating chips and hover states.
- **Lift 2** (`--lift-2`): the standard hover elevation — cards and pressables translate up 2px into this shadow.
- **Lift 3** (`--lift-3`): pronounced float for dragged items and prominent overlays.
- **Inner Highlight** (`--inner-highlight`): a 1px inset top-edge highlight ("light catch") that gives pressable surfaces an ambient-lit edge.

### Named Rules

**The Flat-By-Default Rule.** Surfaces carry no shadow at rest. A shadow that isn't reporting hover, drag, or float-layer state is decoration — remove it. Tonal layering (base-100 → 200 → 300) does the resting separation.

## 6. Components

### Buttons

- **Shape:** field radius (`0.5rem` / 8px, `rounded-lg` is the workhorse; pills use `rounded-full`).
- **Primary:** `bg-primary` on `text-primary-content`, padding `0.5rem 1rem`. daisyUI `btn btn-primary` + the project's `.btn-press` layer.
- **Hover / Focus / Active:** hover translates up 1px on `--ease-spring`; active drops to `scale(0.96)` on `--ease-press` at `--dur-instant` (the tactile press); `:focus-visible` draws a 2px `--color-primary` ring at 2px offset. Loading swaps the label for a `loading-spinner` and disables the control.
- **Ghost:** transparent on `text-base-content`, same shape and press behavior — for low-emphasis and toolbar actions.

### Latency Pill (signature component)

- **Style:** a fixed-width (`w-11`) `rounded-md` pill, `text-xs font-semibold`, `tabular-nums`, showing latency in ms or `---`.
- **State:** classified into bands (good / medium / slow / not-connected). Testing shows a spinning ring; the value flips in with a `latency-flip` transition. Carries a full `aria-label` (value + unit + action) and is keyboard-operable only when `interactive`.
- **Note:** band colors currently use raw Tailwind hues — see the color-blind-safe Don't below.

### Cards / Panels

- **Corner Style:** box radius (`1rem` / 16px; `rounded-2xl`). Use
  `rounded-xl` only for deliberately more compact panels.
- **Background:** `base-200` lifted one tonal step above the `base-100` canvas; recessed toolbars use `base-300`.
- **Shadow Strategy:** flat at rest; `.lift-hover` raises interactive cards 2px into `--lift-2`. Never nest a card inside a card.
- **Border:** daisyUI `--border: 1px` where a divider is needed; tonal step often carries separation alone.
- **Internal Padding:** `1rem` (md) standard.

### Inputs / Fields

- **Style:** `base-100` fill, field radius (8px), 1px border.
- **Focus:** the global `:focus-visible` ring (2px `--color-primary`, 2px offset). Icon-search fields wrap a transparent input in a focus-within container that draws the ring once — the inner input sets `outline-none` to avoid a doubled ring.

### Navigation

- **Desktop:** a persistent side drawer (daisyUI `drawer`); active route carries the primary color, hover gets a tonal lift.
- **Mobile:** a bottom nav bar (`MobileBottomNav`) — first-class, not a hamburger afterthought; parity with desktop capability.

### Named Rules

**The Consistent-Affordance Rule.** The same action wears the same component everywhere. One button shape, one form-control vocabulary, one icon family (`@tabler/icons-vue`). If "test latency" looks different on two screens, one is wrong.

## 7. Implementation Guidelines

### Do

- **Do** bind color to daisyUI roles (`bg-primary`, `text-error`, `var(--color-base-content)`) so every surface survives a theme switch and honors user color overrides.
- **Do** verify body text clears ≥4.5:1 (large/bold ≥3:1) **under every enabled theme**, not just `sunset` — placeholders included. All 32 themes ship; all 32 must read.
- **Do** reserve motion for state and action: hover lift, tactile press, latency flip, page cross-fade. Each animation has its `prefers-reduced-motion` fallback (already handled globally).
- **Do** use `tabular-nums` for every live-updating figure so columns hold still.
- **Do** keep the mobile surface at full capability — the bottom nav and responsive tables are the design, not a downgrade.
- **Do** keep depth a response: flat at rest, `--lift-*` on hover/drag/float only.

### Don't

- **Don't** hardcode hex or raw Tailwind palette colors (`text-red-500`, `text-yellow-500`, `text-green-600`) for themeable UI — they don't re-resolve across themes and break user overrides. _(The latency bands currently do this; treat it as debt, migrate to semantic `error/warning/success`.)_
- **Don't** signal status by hue alone. Latency/health/up-down must pair red/amber/green with shape, icon, position, or a number so a color-blind user can still read it. Green-vs-red is not an accessible status system.
- **Don't** nest cards inside cards, or reach for a modal first — exhaust inline and progressive alternatives.
- **Don't** introduce a second type family or a display font for UI labels; weight and size on Ubuntu carry the hierarchy.
