# Contributing to metacubexd

Thanks for helping improve metacubexd. Keep changes focused, explain the user
impact, and include the checks you ran.

Security vulnerabilities must not be reported in a public issue, discussion,
or pull request. Follow the [security policy](.github/SECURITY.md) instead.

## Prerequisites and setup

- Node.js 24 (see [`.node-version`](.node-version))
- Corepack with pnpm 10.34.1 (see the `packageManager` field in
  [`package.json`](package.json))
- Platform tooling required by the package you are changing

```shell
corepack enable
pnpm install
```

This repository is a pnpm workspace with four main packages:

| Package          | Responsibility                                                |
| ---------------- | ------------------------------------------------------------- |
| `packages/ui`    | Nuxt dashboard, static panel, and desktop renderer            |
| `packages/agent` | Shared mihomo lifecycle and profile-management logic          |
| `apps/server`    | Nitro server and container runtime                            |
| `apps/desktop`   | Electron main process, preload, native helpers, and packaging |

Read [CONTEXT.md](CONTEXT.md) for the system boundaries. UI work should also
follow [PRODUCT.md](packages/ui/PRODUCT.md) and
[DESIGN.md](packages/ui/DESIGN.md). Agent behavior and its HTTP contract are
documented in [MANUAL.md](packages/agent/MANUAL.md).

## Develop and build

Run commands from the repository root unless noted otherwise.

| Scope   | Develop            | Build                |
| ------- | ------------------ | -------------------- |
| UI      | `pnpm dev`         | `pnpm build:ui`      |
| Server  | `pnpm dev:server`  | `pnpm build:server`  |
| Desktop | `pnpm dev:desktop` | `pnpm build:desktop` |

`pnpm build:server` builds the Nitro server and its agent dependency; it does
not build the UI. `pnpm build` builds the UI and server. `pnpm build:desktop`
builds the Electron TypeScript bundles only; it does not create an installer.
Official installers additionally require a generated desktop renderer, the
correct mihomo binary and platform packaging tools. Use
[the release workflow](.github/workflows/release.yml) as the source of truth for
desktop packaging.

## Tests and checks

Run the checks relevant to every package you changed. Before opening a pull
request, also run the workspace-wide static checks when practical:

```shell
pnpm typecheck
pnpm lint
```

`pnpm lint` currently runs the UI linter with `--fix`; inspect its changes
before staging them.

Package tests are intentionally explicit:

```shell
pnpm --filter @metacubexd/ui test:unit
pnpm --filter @metacubexd/ui test:e2e
pnpm --filter @metacubexd/agent test
pnpm --filter @metacubexd/server test
pnpm --filter @metacubexd/desktop test
```

UI end-to-end tests require Playwright's Chromium binary:

```shell
pnpm --filter @metacubexd/ui exec playwright install chromium
```

If a check is not applicable or cannot run on your platform, state that clearly
in the pull request. Do not imply that unrun checks passed.

## Documentation and translations

- Update the README and package documentation when behavior, configuration,
  architecture, or deployment changes.
- Keep the seven locale files in `packages/ui/i18n/locales` aligned when adding
  or changing user-facing text.
- Update screenshots when the visible UI materially changes.
- Never put tokens, subscription URLs, profile contents, private keys, or other
  credentials in fixtures, logs, screenshots, issues, or pull requests.

Markdown files can be checked with the repository's Prettier installation:

```shell
pnpm exec prettier --check README.md CONTRIBUTING.md .github/SECURITY.md
```

## Commits and pull requests

Use focused [Conventional Commits](https://www.conventionalcommits.org/) such
as `fix(desktop): quote Windows proxy paths` or
`docs: clarify server authentication`. Avoid committing generated build output.
Only change `pnpm-lock.yaml` when dependencies or their resolution changed.

Every pull request should include:

- A concise description of the problem and solution.
- A linked issue when one exists.
- Tests and manual checks performed, including OS and architecture.
- Before-and-after screenshots or recordings for visible UI changes.
- Compatibility, migration, permission, and security implications.

## Desktop smoke testing

Changes to Electron lifecycle, system proxy, TUN, native helpers, kernel
management, or packaging need real-platform smoke testing. Test macOS, Windows,
and Linux when the change can affect all three; otherwise list untested
platforms in the pull request.

On each applicable platform, verify:

- The app installs or launches, starts its bundled kernel, and opens a working
  managed dashboard endpoint.
- A profile can be imported, edited, validated, activated, and used after the
  kernel restart.
- System proxy can be enabled and disabled, and quitting does not leave an
  unintended proxy configuration behind.
- TUN setup requests the expected privilege, can be disabled again, and reports
  helper or service failures clearly.
- Tray, window close, reopen, and quit behavior remain correct.
- Logs and diagnostics do not expose secrets.

Also cover platform-specific integration points:

| Platform | Checks                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | Gatekeeper/quarantine behavior, helper installation, and Apple Silicon/Intel when applicable                                                      |
| Windows  | SmartScreen/UAC, system-proxy registry writes, the TUN service, and x64/arm64 when applicable                                                     |
| Linux    | AppImage, deb, rpm, or pacman package launch; `pkexec`/systemd integration; desktop proxy settings; `/dev/net/tun`; and x64/arm64 when applicable |

Unsigned local packages are development artifacts. Do not present them as an
official release or ask users to bypass platform security controls without a
clear, scoped reason.
