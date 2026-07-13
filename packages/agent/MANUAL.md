# @metacubexd/agent manual smoke test

These steps exercise a real mihomo binary, local sockets, and the network. They
are intentionally excluded from `vitest` and CI, which use injected `fetch` and
`spawn` seams instead.

## Prerequisites

- Run the commands from the repository root after `pnpm install`.
- Use the pnpm version declared by the root `packageManager` field.
- The commands use the `tsx` runner supplied by the desktop workspace to load
  the agent's TypeScript source exports.
- Allow outbound HTTPS access to GitHub Releases for the kernel download.
- Make sure loopback ports `19090` and `17890` are unused during the supervisor
  test.
- The examples use POSIX shell quoting. On Windows, run them in Git Bash/WSL or
  place the JavaScript between the quotes in a temporary `.mjs` file.

## Safety notes

- The download test executes the release selected by the agent's current
  `MIHOMO_VERSION`. Review the printed path before running it.
- The supervisor test binds only to `127.0.0.1`, uses a disposable secret, keeps
  TUN disabled, and does not require administrator/root privileges. Do not
  change those defaults on an untrusted machine.
- Stop any existing process that already owns the test ports. Do not use a broad
  command such as `pkill mihomo`; it may stop a real proxy service.
- The examples create data only under the operating system's temporary
  directory. Cleanup instructions are at the end.

## 1. Download the real kernel

This exercises both gzip and zip extraction paths, depending on the platform.

```bash
pnpm --filter @metacubexd/desktop exec tsx --input-type=module -e "
import { fetchKernel, MIHOMO_VERSION } from '@metacubexd/agent'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = join(tmpdir(), 'mcxd-kernel-smoke')
const { binPath } = await fetchKernel(process.platform, process.arch, dir)
console.log('requested version', MIHOMO_VERSION)
console.log('binPath', binPath)
"
```

Expected: the command prints the agent's current requested version and a
`binPath` ending in `mihomo` (or `mihomo.exe` on Windows). Run
`<binPath> -v` and confirm that it prints a Mihomo version banner.

On macOS, if Gatekeeper blocks the downloaded binary, remove quarantine from
that file only, then retry:

```bash
xattr -d com.apple.quarantine "/absolute/path/printed/by/step-1"
```

## 2. Validate and supervise the kernel

Set `MIHOMO_BIN` to the `binPath` printed in step 1. The script validates a
minimal config with `mihomo -t`, starts the kernel, observes its state, and then
stops and disposes the supervisor.

```bash
MIHOMO_BIN="/absolute/path/printed/by/step-1" pnpm --filter @metacubexd/desktop exec tsx --input-type=module -e "
import { createSupervisor } from '@metacubexd/agent'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const binaryPath = process.env.MIHOMO_BIN
if (!binaryPath) throw new Error('MIHOMO_BIN is required')
const home = mkdtempSync(join(tmpdir(), 'mcxd-sup-smoke-'))
const active = join(home, 'active.yaml')
writeFileSync(active, 'mode: direct\nallow-lan: false\ntun:\n  enable: false\nproxies: []\nproxy-groups: []\nrules: []\n')
const sup = createSupervisor({
  binaryPath,
  homeDir: home,
  activeConfigPath: active,
  externalController: '127.0.0.1:19090',
  secret: 'smoke-only',
  mixedPort: 17890,
  autoRestart: false,
})
sup.on('log', line => console.log('[' + line.stream + ']', line.line))
try {
  const validation = await sup.validate(active)
  console.log('validate ->', validation.valid, validation.message)
  if (!validation.valid) throw new Error('config validation failed')
  const started = await sup.start()
  console.log('start ->', started.status)
  console.log('state ->', JSON.stringify(sup.getState()))
  if (started.status !== 'running') throw new Error(started.lastError || 'kernel did not start')
  console.log('stop  ->', (await sup.stop()).status)
} finally {
  await sup.dispose()
  rmSync(home, { recursive: true, force: true })
}
"
```

Expected observations:

- `validate -> true` appears before the kernel starts.
- `start -> running` appears within the configured start timeout, and `state`
  includes the version returned by `GET /version`.
- Mihomo subprocess output appears as `[stdout]` or `[stderr]` log lines.
- `stop -> stopped` appears and the disposable home directory is removed.

## 3. Compose a profile into the active config

This exercises `ProfileStore.setActive`. It writes the selected base profile to
the active config; validation and restart are separate supervisor/control-router
operations.

```bash
pnpm --filter @metacubexd/desktop exec tsx --input-type=module -e "
import { createProfileStore } from '@metacubexd/agent'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = mkdtempSync(join(tmpdir(), 'mcxd-prof-smoke-'))
const active = join(dir, 'active.yaml')
try {
  const store = createProfileStore({ dir, activeConfigPath: active })
  const profile = await store.create({
    name: 'direct-only',
    type: 'local',
    content: 'mode: direct\nproxies: []\nproxy-groups: []\nrules: []\n',
  })
  await store.setActive(profile.id)
  console.log('active id', await store.getActiveId())
  console.log('active file', readFileSync(active, 'utf8'))
} finally {
  rmSync(dir, { recursive: true, force: true })
}
"
```

Expected: the active id and YAML are printed, with no metadata or front matter
leaked into the active config. The disposable profile directory is then
removed.

## Cleanup

Steps 2 and 3 clean up their own temporary directories. Step 1 intentionally
keeps the downloaded kernel for the supervisor test. Remove it when finished:

```bash
pnpm --filter @metacubexd/desktop exec tsx --input-type=module -e "
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
rmSync(join(tmpdir(), 'mcxd-kernel-smoke'), { recursive: true, force: true })
"
```

If step 2 was interrupted, inspect processes and ports first, then terminate
only the process whose executable path points into `mcxd-kernel-smoke`.
