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

# Design System: MetaCubeXD

## 1. Overview

**Creative North Star: "The Instrument Console"**

MetaCubeXD is a precision instrument you operate, not a page you read. Controls press down and settle back with a physical, elastic recoil; live readouts — traffic, latency, connection counts — glow against a deep, cool-slate panel and update in place without shuffling the layout. Every value is legible at a glance, and every action reports itself. The dashboard shipped default is `sunset`: a dark theme where a warm terracotta primary and a violet accent sit on near-black slate, so the readouts feel lit rather than printed. This is a tool in the hands of someone who already knows what they're doing.

The system's identity lives in two layers. The **color layer is theme-swappable**: it rides entirely on daisyUI's semantic roles (primary, accent, base, the state colors) across 32 curated themes plus per-token user overrides — so a token's _role_ is normative, never a specific hex. The **motion and interaction layer is the project's own committed voice**: a small elastic-physics vocabulary (springy hover lifts, a tactile press that scales to 0.96, expo-out settles) applied only where it reports state or action. Density is earned through hierarchy and tabular alignment, never by cramming.

It explicitly rejects two things. It is **not a bloated enterprise admin console** — no personality-free grids of stacked controls, no dense-but-unreadable back-office. And it is **not a flashy gradient-heavy consumer app** — no decorative gradients, no glow-for-glow's-sake, no motion as ornament. Warmth and life come from the accent, the type, and the physical feedback, not from surface decoration.

**Key Characteristics:**

- Dark-default (`sunset`), theme-swappable across 32 daisyUI themes; the semantic role is the contract.
- Elastic-physics motion, applied only to real controls and state changes.
- Information-dense but hierarchy-first; tabular numerics for live-updating figures.
- Full parity across desktop and mobile; keyboard-reachable with visible focus rings.

## 2. Colors

A dark, cool-slate foundation carrying one warm accent (terracotta) with violet and rose supporting hues, plus a full semantic-state set — all expressed as daisyUI roles that re-resolve under every theme.

### Primary

- **Terracotta Signal** (`oklch(74.703% 0.158 39.947)`): the single action/identity color. Primary buttons, the active nav item, the current selection, the scrollbar thumb, focus rings. Warm against the cool base so it reads as "the live thing on the panel." Text on it uses **Ember Ink** (`oklch(14.94% 0.031 39.947)`).

### Secondary

- **Console Rose** (`oklch(72.537% 0.177 2.72)`): secondary emphasis and occasional category accents. Used sparingly; it never competes with Terracotta Signal for "the primary action."

### Tertiary

- **Signal Violet** (`oklch(71.294% 0.166 299.844)`): the accent role — highlights, charts, the occasional distinct affordance. The third voice, not a fourth surface.

### Neutral

- **Deep Slate 100 / 200 / 300** (`oklch(22% / 20% / 18% 0.019 237.69)`): the three-step surface ramp. base-100 is the app canvas, base-200 lifts panels and cards a step forward, base-300 is the recessed / toolbar layer. The tiny 0.019 chroma toward blue keeps it a _cool_ dark, never a dead gray.
- **Panel Text** (`oklch(77.383% 0.043 245.096)`): base-content. The default readout/label color; light blue-gray, tuned to clear 4.5:1 on base-100.
- **Neutral Surface** (`oklch(26% 0.019 237.69)`): the `neutral` role for muted chips and inert fills.

### Semantic State (color-blind-safe rule applies — see Do's and Don'ts)

- **Info Cyan** (`oklch(85.559% 0.085 206.015)`), **Success Green** (`oklch(85.56% 0.085 144.778)`), **Warning Amber** (`oklch(85.569% 0.084 74.427)`), **Error Salmon** (`oklch(85.511% 0.078 16.886)`): status and feedback. High-lightness so they stay legible as text on the dark base.

### Named Rules

**The Role-Is-The-Contract Rule.** Never hardcode a hex or a raw Tailwind color (`text-red-500`) for a themeable surface. Bind to the daisyUI role (`text-error`, `bg-primary`, `var(--color-base-content)`) so it re-resolves under all 32 themes and honors user color overrides. Raw palette colors are a bug the moment the theme changes.

**The One Signal Rule.** Terracotta Signal marks the _one_ primary action or current selection on a surface. If two things on screen are both terracotta-primary, one of them is wrong.

## 3. Typography

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

## 4. Elevation

Flat at rest, lifted by state. daisyUI runs with `--depth: 0` and `--noise: 0`, so surfaces are separated tonally (the base-100/200/300 ramp), not by resting shadows. Depth is a _response_: it appears on hover, on drag, and on floating layers (modals, tooltips, dropdowns). A three-step lift vocabulary encodes this, tuned in `oklab` off `--color-base-content` so it reads correctly under both light and dark themes.

### Shadow Vocabulary

- **Lift 1** (`--lift-1`): resting elevation for subtle floating chips / small hovers.
- **Lift 2** (`--lift-2`): the standard hover elevation — cards and pressables translate up 2px into this shadow.
- **Lift 3** (`--lift-3`): pronounced float for dragged items and prominent overlays.
- **Inner Highlight** (`--inner-highlight`): a 1px inset top-edge highlight ("light catch") that gives pressable surfaces an ambient-lit edge.

### Named Rules

**The Flat-By-Default Rule.** Surfaces carry no shadow at rest. A shadow that isn't reporting hover, drag, or float-layer state is decoration — remove it. Tonal layering (base-100 → 200 → 300) does the resting separation.

## 5. Components

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

- **Corner Style:** box radius (`1rem` / 16px; `rounded-xl`/`rounded-2xl`).
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

## 6. Do's and Don'ts

### Do:

- **Do** bind color to daisyUI roles (`bg-primary`, `text-error`, `var(--color-base-content)`) so every surface survives a theme switch and honors user color overrides.
- **Do** verify body text clears ≥4.5:1 (large/bold ≥3:1) **under every enabled theme**, not just `sunset` — placeholders included. All 32 themes ship; all 32 must read.
- **Do** reserve motion for state and action: hover lift, tactile press, latency flip, page cross-fade. Each animation has its `prefers-reduced-motion` fallback (already handled globally).
- **Do** use `tabular-nums` for every live-updating figure so columns hold still.
- **Do** keep the mobile surface at full capability — the bottom nav and responsive tables are the design, not a downgrade.
- **Do** keep depth a response: flat at rest, `--lift-*` on hover/drag/float only.

### Don't:

- **Don't** hardcode hex or raw Tailwind palette colors (`text-red-500`, `text-yellow-500`, `text-green-600`) for themeable UI — they don't re-resolve across themes and break user overrides. _(The latency bands currently do this; treat it as debt, migrate to semantic `error/warning/success`.)_
- **Don't** signal status by hue alone. Latency/health/up-down must pair red/amber/green with shape, icon, position, or a number so a color-blind user can still read it. Green-vs-red is not an accessible status system.
- **Don't** build it like a **bloated enterprise admin console** — no personality-free stacks of controls, no dense-but-unreadable back-office grids.
- **Don't** build it like a **flashy gradient-heavy consumer app** — no decorative gradients, no `background-clip: text` gradient headings, no glow or glassmorphism as default, no motion as ornament.
- **Don't** nest cards inside cards, or reach for a modal first — exhaust inline and progressive alternatives.
- **Don't** introduce a second type family or a display font for UI labels; weight and size on Ubuntu carry the hierarchy.
