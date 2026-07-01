# Product

## Register

product

## Users

Mihomo (Clash Meta) users — self-hosters and technically-literate power users who run a proxy kernel and need to observe and control it. They arrive with a concrete task in mind: switch a proxy group, test node latency, kill a runaway connection, read why a request matched a rule, tail live logs, or edit config. They use the dashboard across both desktop and mobile, often on the same day, and in English, 中文, or Русский. Their context is operational — something is (or might be) wrong, or they are tuning — so answers need to be immediate.

## Product Purpose

The official Mihomo dashboard: real-time control and observability for a running Mihomo/Clash kernel. It provides live traffic monitoring and statistics, proxy group management with latency testing, connection tracking and termination, a searchable rule viewer, live log streaming, and config editing. Success is when a user can answer "what is my proxy doing right now, and change it" in seconds, on any device, without leaving the dashboard.

## Brand Personality

Confident, tactile, precise. The interface has physical feedback — an elastic-physics motion voice (springy settles, tactile press, decisive expo-out easing) that makes control actions feel like manipulating real hardware — paired with clean, information-dense layouts that never feel cluttered. Three words: **tactile, precise, alive**. It should feel like a well-built instrument in the hands of someone who knows what they're doing, not a toy and not a spreadsheet.

## Anti-references

- **Bloated enterprise admin consoles** (SAP, generic Bootstrap back-offices): no personality, controls stacked without hierarchy, dense-but-unreadable.
- **Flashy gradient-heavy consumer apps**: gradients everywhere, decorative glow/glass piled on, motion as ornament rather than feedback.

## Design Principles

- **Observability at a glance.** Live state — traffic, connections, latency, health — must read instantly. The dashboard's core job is answering "what's happening right now" without the user having to dig for it.
- **Density with hierarchy, not clutter.** Power users want information density; earn it through typographic and spatial hierarchy so every dense screen stays scannable, never by cramming.
- **Motion confirms, never decorates.** The tactile/elastic voice exists to give physical feedback on real control actions (switching nodes, testing latency, pressing controls). If a motion isn't reporting state or action, it doesn't ship.
- **Theme-agnostic correctness.** All daisyUI themes are enabled. Contrast, the _meaning_ of status colors, and readability must hold under every theme — not just the default one.
- **Responsive parity.** Full capability on mobile and desktop. The mobile view is a first-class surface, not a stripped-down afterthought.

## Accessibility & Inclusion

- **WCAG AA baseline:** body text ≥ 4.5:1 contrast, large text ≥ 3:1, full keyboard reachability, visible `:focus-visible` rings (already in place), and a `prefers-reduced-motion` alternative for every animation (already respected globally).
- **Color-blind-safe status.** Latency, health, and up/down states must not rely on red/green hue alone — pair with shape, icon, label, or position.
- **Multi-theme compliance.** Contrast and status legibility must pass under every enabled daisyUI theme, not only the shipped default.
