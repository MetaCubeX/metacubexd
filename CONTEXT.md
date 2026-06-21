# metacubexd — mihomo proxy dashboard

The web/desktop control surface for the mihomo (clash.meta) proxy kernel. This
glossary fixes the dashboard's ubiquitous language so modules can be named after
concepts rather than after the kernel's wire shapes.

## Language

### Proxy routing

**Proxy Node**:
A single outbound endpoint the kernel can route traffic through — the leaf of a
routing decision.
_Avoid_: server, outbound, proxy (bare)

**Proxy Group**:
A named policy that selects among proxy nodes or other groups; at any moment it
has exactly one selected member.
_Avoid_: selector, policy group

**Selected Node**:
The node a proxy group currently routes through, resolved by following the
selection recursively when a group points at another group. This is the canonical
name for what the kernel reports as `now` — and what the wire shape misleadingly
carries in a field named `latency`.
_Avoid_: now, current node, active node

**Proxy Provider**:
An external subscription that supplies a set of proxy nodes as one updatable unit.
_Avoid_: subscription (when meaning the node set), source

### Latency

**Latency**:
The measured round-trip delay of a proxy node for a given test URL. The absence of
a successful measurement is "not connected" — a distinct state, not a delay of zero.
_Avoid_: delay, ping, speed

**Test URL**:
The target a latency probe measures against. Latency is always per (proxy node,
test URL) pair — never a single number for a node.
_Avoid_: test endpoint, probe url

**Latency Band**:
The quality bucket a latency reading falls into (good / medium / bad), decided by
one shared threshold ladder.
_Avoid_: latency color, latency class, quality level

**Latency Trend**:
A proxy node's rolling history of latency readings, summarized as
min / average / jitter / success-rate and drawn as a sparkline.
_Avoid_: latency history chart, latency stats

### Kernel configuration

**General Config**:
The kernel's top-level scalar settings — allow-lan, running mode (+ mode list),
unified-delay, outbound interface, and the listener ports (mixed / http / socks /
redir / tproxy) — edited via `PATCH /configs`. Distinct from DNS, TUN, profile,
and proxy configuration, which have their own seams.
_Avoid_: core config, basic settings, localConfig

**Running Mode**:
How the kernel decides routing: rule / global / direct. Changing it re-routes the
whole session, so a change closes existing connections.
_Avoid_: mode (bare), policy mode
