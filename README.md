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

> **System proxy / TUN are advanced features.** TUN needs elevated privileges,
> and unsigned builds can't ship a privileged helper — the app defaults to a
> **mixed proxy port** (no elevation). Enable TUN only if your OS lets the
> unsigned binary acquire the required privileges.

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

## 🛠️ Development

```shell
# Start dev server
pnpm dev

# Start dev server with mock data
pnpm dev:mock

# Lint & Format
pnpm lint
pnpm format
```

## 📄 License

[MIT](./LICENSE)

## 🙏 Credits

- [Nuxt](https://github.com/nuxt/nuxt) - The Intuitive Vue Framework
- [Vue.js](https://github.com/vuejs/core) - The Progressive JavaScript Framework
- [daisyUI](https://github.com/saadeghi/daisyui) - Tailwind CSS components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
