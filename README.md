# metacubexd

**Mihomo Dashboard, The Official One, XD**

[![pr-closed](https://img.shields.io/github/issues-pr-closed/metacubex/metacubexd?style=for-the-badge)](https://github.com/metacubex/metacubexd/pulls)
[![last-commit](https://img.shields.io/github/last-commit/metacubex/metacubexd?style=for-the-badge)](https://github.com/metacubex/metacubexd/commits)
[![build](https://img.shields.io/github/actions/workflow/status/metacubex/metacubexd/release.yml?style=for-the-badge)](https://github.com/metacubex/metacubexd/actions)
[![downloads](https://img.shields.io/github/downloads/metacubex/metacubexd/total?style=for-the-badge)](https://github.com/metacubex/metacubexd/releases)
[![license](https://img.shields.io/github/license/metacubex/metacubexd?style=for-the-badge)](./LICENSE)

## ✨ Features

- 📊 Real-time traffic monitoring and statistics
- 🔄 Proxy group management with latency testing
- 📡 Connection tracking and management
- 📋 Rule viewer with search functionality
- 📝 Live log streaming
- 🎨 Beautiful UI with light/dark theme support
- 📱 Fully responsive design for mobile devices
- 🌐 Multi-language support (English, 中文, Русский)

## 🖼️ Preview

<details>
<summary><b>Desktop Screenshots</b></summary>

|                           Overview                            |                           Proxies                           |
| :-----------------------------------------------------------: | :---------------------------------------------------------: |
| <img src="docs/pc/overview.png" alt="overview" width="400" /> | <img src="docs/pc/proxies.png" alt="proxies" width="400" /> |

|                             Connections                             |                          Rules                          |
| :-----------------------------------------------------------------: | :-----------------------------------------------------: |
| <img src="docs/pc/connections.png" alt="connections" width="400" /> | <img src="docs/pc/rules.png" alt="rules" width="400" /> |

|                         Logs                          |                          Config                           |
| :---------------------------------------------------: | :-------------------------------------------------------: |
| <img src="docs/pc/logs.png" alt="logs" width="400" /> | <img src="docs/pc/config.png" alt="config" width="400" /> |

</details>

<details>
<summary><b>Mobile Screenshots</b></summary>

|                             Overview                              |                             Proxies                             |                               Connections                               |
| :---------------------------------------------------------------: | :-------------------------------------------------------------: | :---------------------------------------------------------------------: |
| <img src="docs/mobile/overview.png" alt="overview" width="200" /> | <img src="docs/mobile/proxies.png" alt="proxies" width="200" /> | <img src="docs/mobile/connections.png" alt="connections" width="200" /> |

|                            Rules                            |                           Logs                            |                            Config                             |
| :---------------------------------------------------------: | :-------------------------------------------------------: | :-----------------------------------------------------------: |
| <img src="docs/mobile/rules.png" alt="rules" width="200" /> | <img src="docs/mobile/logs.png" alt="logs" width="200" /> | <img src="docs/mobile/config.png" alt="config" width="200" /> |

</details>

## 🔗 Official Links

| Platform         | URL                                    |
| :--------------- | :------------------------------------- |
| GitHub Pages     | https://metacubex.github.io/metacubexd |
| Cloudflare Pages | https://metacubexd.pages.dev           |

## 🚀 Deployment

metacubexd ships in **three forms from one codebase**:

| Form                       | Who hosts the UI            | Who runs the kernel                 | Best for                                 |
| :------------------------- | :-------------------------- | :---------------------------------- | :--------------------------------------- |
| **Hosted panel** (classic) | gh-pages / your static host | your own remote mihomo              | pointing a browser at an existing mihomo |
| **Desktop app**            | the app (bundled)           | the app supervises a bundled mihomo | a single machine, zero setup             |
| **All-in-one server**      | the Docker image            | the container's bundled mihomo      | a router / NAS / VPS                     |

> The classic **pure-panel mode still works against any remote mihomo** — the
> kernel-control and profile features simply stay hidden when the dashboard
> isn't talking to a bundled agent.

### 1. Hosted Panel (point at your own mihomo)

Enable the external-controller in your mihomo `config.yaml`:

```yaml
external-controller: 0.0.0.0:9090
```

Then either open the hosted dashboard and enter your mihomo `{url, secret}`:

| Platform      | URL                                    |
| :------------ | :------------------------------------- |
| GitHub Pages  | https://metacubex.github.io/metacubexd |
| Custom domain | https://d.metacubex.one                |

…or self-host the static assets via `external-ui`:

```shell
# Clone the prebuilt gh-pages branch
git clone https://github.com/metacubex/metacubexd.git -b gh-pages /etc/mihomo/ui

# Set external-ui in your config:
#   external-ui: /etc/mihomo/ui

# Update to the latest build later:
git -C /etc/mihomo/ui pull -r
```

### 2. Desktop App

Download the installer for your platform from the
[latest release](https://github.com/metacubex/metacubexd/releases/latest):

| OS                    | Arch        | File                                                   |
| :-------------------- | :---------- | :----------------------------------------------------- |
| macOS (Apple Silicon) | arm64       | `MetaCubeXD-<version>-mac-arm64.dmg`                   |
| macOS (Intel)         | x64         | `MetaCubeXD-<version>-mac-x64.dmg`                     |
| Windows               | x64 / arm64 | `MetaCubeXD-<version>-win-<arch>.exe`                  |
| Linux                 | x64 / arm64 | `MetaCubeXD-<version>-linux-<arch>.AppImage` or `.deb` |

The desktop app **bundles its own mihomo kernel and auto-configures the local
endpoint** — you don't enter any address. Manage profiles, edit configs, and
start/stop the kernel directly inside the app.

> **These builds are unsigned.** Each OS warns about unidentified developers;
> the steps below are expected and safe.

**macOS** — Gatekeeper blocks unsigned apps ("MetaCubeXD is damaged and can't
be opened"). After dragging the app to `/Applications`, strip the quarantine
attribute:

```shell
xattr -dr com.apple.quarantine /Applications/MetaCubeXD.app
```

…or right-click the app → **Open** → **Open** in the confirmation dialog.

**Windows** — SmartScreen shows "Windows protected your PC". Click
**More info** → **Run anyway**.

**Linux** — make the AppImage executable, then run it:

```shell
chmod +x MetaCubeXD-*-linux-*.AppImage
./MetaCubeXD-*-linux-*.AppImage
# or install the .deb:
sudo dpkg -i MetaCubeXD-*-linux-*.deb
```

> **System proxy / TUN are advanced features.** The app defaults to a **mixed
> proxy port** (no elevation). System proxy and TUN both require privileges; see
> [TUN mode (desktop)](#tun-mode-desktop) for the one-time privileged-helper
> install and what the unsigned build means for it.

#### TUN mode (desktop)

**TUN takes over all machine traffic at the network layer**, so every app is
routed through mihomo without per-app proxy settings (unlike the mixed proxy
port, which only catches apps you point at it). Because routing the whole system
needs root/admin, the desktop app installs a small **privileged helper** the
first time you enable TUN — a background service that performs the privileged
network setup on the app's behalf. Enabling TUN therefore prompts for an
**administrator authorization** the first time (the OS elevation dialog). The
helper persists across sessions, so later enables don't re-prompt for install.

> **These builds are unsigned**, so you hit the unidentified-developer warnings
> twice: once launching the app (see above — macOS Gatekeeper / Windows
> SmartScreen / Linux "unknown publisher"), and again when the helper install
> asks for administrator authorization. Both are expected. Allow them the same
> way you allowed the app itself.

**Per-OS notes**

- **macOS** — the helper is registered as a root **LaunchDaemon**; you approve
  it through the standard `osascript` "wants to make changes" administrator
  prompt. The kernel binds the system's `utun` interface.
- **Windows** — the helper is registered as an auto-start **Windows service**
  (UAC prompt). The build ships **`wintun.dll`** alongside the kernel, which
  mihomo's wintun backend needs — no separate download.
- **Linux** — the helper is registered as a root **systemd** unit; the elevation
  prompt is **`pkexec`** (the GNOME/PolicyKit authorization dialog). On a headless
  box without a Polkit agent you may need to install/enable one.

**If TUN takes down your network**

TUN reroutes default traffic, so a bad config or a stuck tunnel can drop
connectivity. Two recoveries:

- Click **"Recover network"** in the app — it tears down the TUN routing and
  restores normal networking without quitting.
- **Quit the app** — exiting automatically tears down TUN (the helper restores
  routing), so a force-quit is a safe last resort.

> **Status: TUN is new.** It's verified at the unit-test / command-generation /
> packaging level, but the real install, elevation, and per-OS tunnel behavior
> still need smoke testing on actual macOS / Windows / Linux machines. If you hit
> a problem, please open an issue with your OS, the exact prompt you saw, and
> whether "Recover network" restored connectivity.

### 3. All-in-One Server (Docker)

The `metacubexd-server` image bundles the dashboard UI, the control agent, and
a per-arch mihomo kernel. One container serves the panel, supervises the
kernel, and exposes the proxy.

```yaml
# compose.yaml — proxy-only by default; TUN is an advanced override
services:
  metacubexd:
    image: ghcr.io/metacubex/metacubexd-server:latest
    restart: unless-stopped
    environment:
      CONTROL_TOKEN: 'change-me-control'
      CLASH_SECRET: 'change-me-clash'
      CONTROL_PORT: '8080'
      CLASH_API_PORT: '9090'
      MIXED_PORT: '7890'
      TZ: 'Asia/Shanghai'
    ports:
      - '8080:8080' # dashboard UI + /api/control agent API
      - '9090:9090' # mihomo Clash API + WebSocket (UI endpoint target)
      - '7890:7890' # mixed proxy port
    volumes:
      - 'metacubexd-data:/data'

volumes:
  metacubexd-data: {}
```

```shell
docker compose up -d

# Update
docker compose pull && docker compose up -d
```

Open `http://<host>:8080` for the dashboard. The control agent unlocks the
kernel/profile UI automatically: the server injects `CONTROL_TOKEN` into the
same-origin page, so the dashboard authenticates its `/api/control` probe
without you entering the token anywhere.

**Point the UI endpoint at the kernel.** The dashboard talks to mihomo's Clash
API directly (never proxied), so set the endpoint to:

| Field  | Value                            |
| :----- | :------------------------------- |
| URL    | `http://<host>:9090`             |
| Secret | the `CLASH_SECRET` you set above |

#### Environment variables

| Variable         | Default               | Purpose                                                                                                                             |
| :--------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `CONTROL_TOKEN`  | _(none)_              | Bearer token guarding the control agent (`/api/control/**`); also accepted as `?token=` for the SSE log stream. Set a strong value. |
| `CLASH_SECRET`   | _(none)_              | Secret for mihomo's Clash API (`external-controller`). Use this as the UI endpoint's **Secret**.                                    |
| `CONTROL_PORT`   | `8080`                | Port serving the dashboard UI + control agent API.                                                                                  |
| `CLASH_API_PORT` | `9090`                | Port for mihomo's Clash API + WebSocket. The UI endpoint targets this port.                                                         |
| `MIXED_PORT`     | `7890`                | mihomo mixed (HTTP + SOCKS) proxy port.                                                                                             |
| `TZ`             | _(container default)_ | Timezone for logs/scheduling, e.g. `Asia/Shanghai`.                                                                                 |

The named volume mounts `/data`, which holds your profiles, the active config,
and the kernel's geo / fake-ip caches. It **must be writable** — a read-only
data dir makes the kernel exit non-zero.

#### TUN mode (advanced)

TUN needs `NET_ADMIN`, the `/dev/net/tun` device, and host networking. Override
the service:

```yaml
services:
  metacubexd:
    image: ghcr.io/metacubex/metacubexd-server:latest
    restart: unless-stopped
    network_mode: host
    cap_add:
      - NET_ADMIN
    devices:
      - '/dev/net/tun:/dev/net/tun'
    environment:
      CONTROL_TOKEN: 'change-me-control'
      CLASH_SECRET: 'change-me-clash'
    volumes:
      - 'metacubexd-data:/data'

volumes:
  metacubexd-data: {}
```

With `network_mode: host` the `ports:` mapping is ignored — the container
binds `8080`/`9090`/`7890` directly on the host. Enable a `tun:` block in your
profile's mihomo config for the tunnel to come up.

### Migrating from the legacy `metacubexd` image

The old **`ghcr.io/metacubex/metacubexd`** image was a **static dashboard only**
— it served the UI and you pointed it at a mihomo you ran yourself (often a
separate `mihomo` container). The monorepo migration **froze that image** (its
repo-root `Dockerfile` is gone), which is why pulls stopped updating. Nothing is
broken — the dashboard moved to two supported forms, so pick the one that
matches your old setup:

- **You want to keep running your own mihomo** (you had a separate `mihomo`
  container or a host mihomo). You don't need a dashboard container at all — open
  the [hosted panel](#1-hosted-panel-point-at-your-own-mihomo) and enter your
  mihomo's `{url, secret}`, or self-host the static assets via `external-ui`.
  Add your dashboard origin to `external-controller-cors` (see
  [CORS](#unable-to-connect-to-backend-when-self-hosting-cors)).

- **You want one container that runs everything.** Switch to
  [`metacubexd-server`](#3-all-in-one-server-docker). It **bundles its own
  mihomo**, so the old `# Optional: mihomo instance` service is no longer needed
  — **delete it**. Move your `config.yaml` in as a profile (paste it into the
  in-app config editor, or drop it under the `/data` volume) instead of mounting
  it at mihomo's old path.

Two gotchas when porting an old `compose.yaml`:

- **Port.** The legacy image listened on `80`; the server's dashboard is `8080`.
  Map `'80:8080'` if you want to keep hitting it on port 80.
- **Image name.** `ghcr.io/metacubex/metacubexd` →
  `ghcr.io/metacubex/metacubexd-server:latest`.

### Profiles & Config Editor (desktop / server)

When connected to a bundled agent (desktop app or the server image), the
dashboard gains a **profile manager**:

- Create, duplicate, rename, and delete multiple profiles.
- Import a subscription by URL (fetched with `User-Agent: clash.meta`); the
  `upload / download / total / expire` usage from `Subscription-Userinfo` is
  shown on a usage card.
- Edit any profile in an in-browser **Monaco editor with mihomo YAML schema**
  completion and validation.
- **Activate** a profile to validate it and hot-reload the kernel.

Schema diagnostics are advisory and never block saving — the kernel's reload
is the final validation. A **"disable validation"** toggle is available for
bleeding-edge mihomo keys the bundled schema doesn't know yet.

### Custom Kernel Path

Both the desktop app and the server bundle a pinned mihomo
(`v1.19.27`). To use your own kernel build, set a custom path in
**Settings** (desktop) or the `MIHOMO_BIN` environment variable (server) — a
user-supplied path always takes precedence over the bundled binary.

## 🩺 Troubleshooting

### "Unable to connect to backend" when self-hosting (CORS)

If the dashboard loads but cannot connect to the Mihomo backend — even though
the External Controller is reachable directly in your browser — the cause is
usually **CORS**.

When you host the dashboard on your own address (e.g. `http://192.168.1.2:8080`),
the browser treats requests to the External Controller (e.g.
`http://192.168.1.2:9090`) as cross-origin. Mihomo only answers cross-origin
requests from origins listed in its `external-controller-cors` allow-list, so
requests from your dashboard are rejected and the connection fails.

Add your dashboard's origin to the allow-list in your Mihomo `config.yaml`:

```yaml
external-controller-cors:
  allow-private-network: true
  allow-origins:
    - 'http://192.168.1.2:8080' # your dashboard's address
    # or, for trusted local networks only:
    # - '*'
```

> Tip: if you still cannot connect, open your browser's DevTools (F12) →
> Console and look for CORS-related errors to confirm the cause.

### Kernel won't start (desktop / server)

When the bundled kernel fails to reach `running`:

- **Port `9090` already in use.** Another mihomo (or a previous orphaned
  instance) is holding the Clash API port. Stop it, or change `CLASH_API_PORT`
  (server) — the app picks a free port and writes the real URL back to the UI.
- **macOS quarantine kills the bundled binary.** An unsigned `.app` downloaded
  from the internet has its bundled mihomo quarantined. Run
  `xattr -dr com.apple.quarantine /Applications/MetaCubeXD.app` (the app also
  strips quarantine + sets the executable bit on first run).
- **`SIGILL` / "illegal instruction" on amd64.** Old or virtualized CPUs choke
  on the generic amd64 build. metacubexd ships the **`-compatible`**
  (`GOAMD64=v1`) asset specifically to avoid this; if you supplied a custom
  kernel path, use the `-compatible` mihomo build.

### Two log streams — which is which

- **Clash logs** (the existing **Logs** page): mihomo's own log feed over the
  Clash API WebSocket — proxy decisions, rule matches, DNS, etc.
- **Kernel logs** (control agent, SSE): the mihomo **subprocess** stdout/stderr
  captured by the supervisor — startup banners, crashes, config-parse errors.
  Use these when the kernel won't start or exits unexpectedly.

### Read-only data directory

The kernel needs a **writable** home for `profiles/`, the active config, and
geo / fake-ip caches. A read-only mount (server) or a read-only
`resources/` path (desktop) makes the kernel exit non-zero. On the server,
ensure the `/data` volume is writable; the desktop app uses the per-user
`userData` directory automatically.

### Health check (server)

The container's health endpoint is `GET /api/control/health` on
`CONTROL_PORT` (default `8080`). A `200` means the dashboard + control agent
are up; it does **not** assert the kernel is running (check the kernel panel
for that).

## 🛠️ Development

This repo is a **pnpm 10 workspace** (`packages/ui`, `packages/agent`,
`apps/server`, `apps/desktop`).

```shell
# Install all workspace dependencies
pnpm install

# Run the dashboard UI dev server (pure-panel mode against a remote mihomo)
pnpm dev

# Build the static UI for hosting (gh-pages, external-ui, etc.)
pnpm build:ui

# Build the all-in-one Nitro server (UI + agent), output in apps/server/.output
pnpm build:server

# Build the Electron desktop app (electron-vite + electron-builder)
pnpm build:desktop

# Typecheck / lint every package
pnpm typecheck
pnpm lint
```

To work on the desktop app with hot reload, run electron-vite from its package:

```shell
pnpm --filter @metacubexd/desktop dev
```

## 📄 License

[MIT](./LICENSE)

## 🙏 Credits

- [Nuxt](https://github.com/nuxt/nuxt) - The Intuitive Vue Framework
- [Vue.js](https://github.com/vuejs/core) - The Progressive JavaScript Framework
- [daisyUI](https://github.com/saadeghi/daisyui) - Tailwind CSS components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
