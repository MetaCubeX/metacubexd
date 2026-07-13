# metacubexd — Mihomo proxy dashboard

The control surface for observing and operating Mihomo across hosted, desktop,
and server forms. This glossary fixes the project's ubiquitous language so UI,
agent, and host modules describe the same concepts without conflating their
control surfaces.

## Language

### Runtime forms

**Runtime Form**:
A supported arrangement of dashboard, Control Agent, and Mihomo ownership.
_Avoid_: deployment mode, app mode, mode (bare)

**Hosted Panel**:
The browser-delivered dashboard connected to a user-managed Mihomo, without a
Control Agent or Bundled Kernel.
_Avoid_: web mode, remote mode, server mode

**Desktop App**:
The packaged desktop form in which the dashboard and Control Agent manage a
Bundled Kernel on the user's machine.
_Avoid_: desktop mode, Electron frontend, local panel

**All-in-One Server**:
The server form in which one deployment serves the dashboard, runs the Control
Agent, and manages a Bundled Kernel.
_Avoid_: hosted panel, panel container, server mode

### Control surfaces

**Clash API**:
Mihomo's external control surface for live proxy state, routing, connections,
configuration, and telemetry over HTTP and WebSocket.
_Avoid_: Control API, agent API, backend API

**Control API**:
metacubexd's control surface for host-owned capabilities such as kernel
lifecycle, profiles, subprocess logs, System Proxy, and TUN.
_Avoid_: Clash API, Mihomo API, backend API

**Control Agent**:
The metacubexd companion that owns the Control API and coordinates managed
profiles, host capabilities, and a Bundled Kernel.
_Avoid_: backend, Mihomo, server, daemon

**Kernel**:
A running Mihomo process that performs proxying and routing.
_Avoid_: backend, agent, server, core (bare)

**Bundled Kernel**:
The Mihomo executable distributed with and managed by the Desktop App or
All-in-One Server.
_Avoid_: embedded backend, built-in agent, remote kernel

### Proxy routing

**Proxy Node**:
A single outbound endpoint the Kernel can route traffic through: the leaf of a
routing decision.
_Avoid_: server, outbound, proxy (bare)

**Proxy Group**:
A named routing policy whose candidates may be Proxy Nodes or other Proxy
Groups. Selection-bearing groups expose a selected member; automatic groups may
route without one stable user selection.
_Avoid_: selector (for every group), policy group

**Selected Node**:
The currently reported member of a selection-bearing Proxy Group, resolved
recursively when that member is another group; not every Proxy Group has one.
_Avoid_: now, current node, active node

**Proxy Provider**:
An externally maintained set of Proxy Nodes that can be refreshed as one unit.
_Avoid_: subscription (when meaning the node set), source

### Latency

**Latency**:
The measured round-trip delay of a Proxy Node for a given Test URL. No successful
measurement means "not connected," not zero latency.
_Avoid_: delay, ping, speed

**Test URL**:
The target of a latency probe; latency always belongs to a Proxy Node and Test
URL pair.
_Avoid_: test endpoint, probe URL

**Latency Band**:
The shared quality bucket assigned to a latency reading: good, medium, slow, or
not connected.
_Avoid_: latency color, latency class, quality level

**Latency Trend**:
A Proxy Node's rolling latency history summarized by minimum, average, jitter,
and success rate.
_Avoid_: latency history chart, latency stats

### Profiles and configuration

**Profile**:
A named source used to produce the Active Config. A Profile is local, remote,
merge, or script according to how it contributes.
_Avoid_: config file, subscription (for every profile), preset

**Local Profile**:
An editable base Profile whose YAML is stored and maintained locally.
_Avoid_: manual config, local config

**Remote Profile**:
A base Profile whose YAML comes from a refreshable subscription URL.
_Avoid_: Proxy Provider, subscription (bare), online config

**Merge Profile**:
An optional YAML overlay composed onto the active base Profile; it is not itself
an activatable base.
_Avoid_: patch profile, mixin, override file

**Script Profile**:
An optional transformation applied after merge overlays; it is not itself an
activatable base.
_Avoid_: hook, plugin, script config

**Active Profile**:
The local or remote base Profile currently chosen as the root of composition.
_Avoid_: Active Config, running config, selected config

**Active Config**:
The materialized configuration produced from the Active Profile and enabled
merge and script contributions, ready for Kernel validation and use.
_Avoid_: Active Profile, source profile, editor content

**General Config**:
The Kernel's top-level scalar settings, distinct from DNS, TUN, profile, and
proxy-routing configuration.
_Avoid_: core config, basic settings, localConfig

**Running Mode**:
The Kernel's top-level routing strategy: rule, global, or direct.
_Avoid_: mode (bare), policy mode, Runtime Form

### Host networking

**Mixed Proxy Port**:
The Kernel listener that accepts both HTTP and SOCKS proxy traffic from
proxy-aware clients.
_Avoid_: system proxy, TUN port, Clash API port

**System Proxy**:
The operating-system proxy setting that points proxy-aware applications at the
Mixed Proxy Port.
_Avoid_: TUN, VPN, global routing

**TUN**:
System-level routing through a virtual network interface managed by the Kernel,
including traffic from applications that do not honor System Proxy settings.
_Avoid_: System Proxy, mixed proxy, VPN (unless describing the user experience)
