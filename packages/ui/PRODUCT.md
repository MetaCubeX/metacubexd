# MetaCubeXD Product

## Users

MetaCubeXD serves Mihomo users who operate their own proxy kernel: self-hosters,
network administrators, and technically literate power users. They use the
dashboard on desktop and mobile, often while diagnosing a live routing or
connectivity problem, so current state and the result of every action must be
immediately clear.

The bundled interface supports English, Simplified Chinese, Russian, Japanese,
Korean, French, and Persian. New workflows must remain usable across all seven
locales, including longer translations and right-to-left text.

## Core Jobs

- Understand current traffic, throughput, connections, kernel health, and
  routing behavior at a glance.
- Select a proxy-group member, test latency, and confirm that the change took
  effect.
- Find and terminate connections, inspect matching rules, and follow live logs
  during diagnosis.
- Connect the hosted panel to an existing Mihomo external controller.
- When a bundled agent is available, manage profiles, edit and validate config,
  control the kernel, and opt into system-proxy or TUN workflows.

## Product Scope

MetaCubeXD is the official control and observability surface for Mihomo. It ships
as a hosted/static panel, a desktop application, and an all-in-one server. The
core dashboard must remain useful with a standard remote Mihomo API; agent-only
features should appear progressively when the connected runtime supports them.

MetaCubeXD is not a proxy subscription provider, a VPN service, or a generic
infrastructure administration suite. It should expose Mihomo's capabilities
without inventing a second configuration model or hiding operational state.

## Brand

The product is confident, tactile, and precise. It should feel like a dependable
instrument for an informed operator: dense enough to be useful, calm enough to
scan under pressure, and explicit about state-changing actions. Visual and
interaction implementation belongs in [DESIGN.md](./DESIGN.md).

## Product Principles

- **Observability first.** Show what is happening now and when data was last
  updated before asking the user to act.
- **Safe control.** Preview impact where practical, validate destructive or
  privileged operations, and make recovery paths visible.
- **Progressive capability.** Keep remote-panel workflows independent of the
  bundled agent; reveal additional controls only when supported.
- **Density with hierarchy.** Preserve the information power users need while
  keeping priority, grouping, and status easy to scan.
- **Responsive parity.** Mobile and desktop provide the same essential jobs,
  adapted to their available space rather than reduced to separate products.
- **Explain failure.** Errors identify the failed operation, preserve useful
  diagnostic detail, and suggest a concrete next action.

## Accessibility and Inclusion

- Meet WCAG AA contrast targets and provide visible keyboard focus throughout
  every workflow.
- Give every action a keyboard path and every icon-only control an accessible
  name.
- Never encode latency, health, or success/failure by color alone.
- Respect reduced-motion preferences and avoid motion that blocks reading or
  interaction.
- Test layout, truncation, bidirectional text, and control order in all bundled
  locales and at mobile widths.
