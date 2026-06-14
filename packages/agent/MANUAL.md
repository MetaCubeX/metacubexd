# @metacubexd/agent — manual smoke test

These steps exercise the REAL mihomo binary and network. They are intentionally
NOT part of `vitest` / CI (which use injected `fetch`/`spawn` seams).

## 1. Download the real kernel (exercises the .gz gunzip + zip paths)

```bash
pnpm --filter @metacubexd/agent exec node --input-type=module -e "
import { fetchKernel } from '@metacubexd/agent'
import { tmpdir } from 'node:os'
const dir = tmpdir() + '/mcxd-kernel-smoke'
const { binPath } = await fetchKernel(process.platform, process.arch, dir)
console.log('binPath', binPath)
"
```

Expected: prints a `binPath` ending in `mihomo` (or `mihomo.exe` on Windows).
Verify it runs: `<binPath> -v` prints `Mihomo Meta v1.19.27 ...`.
On macOS, if the binary is killed by Gatekeeper, run
`xattr -dr com.apple.quarantine <binPath>` then retry.

## 2. Supervise it (exercises spawn + ready-poll + clean stop)

Create a minimal config and start the supervisor:

```bash
pnpm --filter @metacubexd/agent exec node --input-type=module -e "
import { createSupervisor } from '@metacubexd/agent'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const home = mkdtempSync(join(tmpdir(), 'mcxd-sup-smoke-'))
const active = join(home, 'active.yaml')
// The profile's clash-api/mixed-port lines below are intentionally overwritten by
// the supervisor's pre-spawn config injection; pass them via options instead.
writeFileSync(active, 'proxies: []\n')
const sup = createSupervisor({ binaryPath: process.env.MIHOMO_BIN, homeDir: home, activeConfigPath: active, secret: 'smoke', mixedPort: 7890 })
sup.on('log', l => console.log('[' + l.stream + ']', l.line))
console.log('start ->', (await sup.start()).status)
console.log('state ->', JSON.stringify(sup.getState()))
console.log('stop  ->', (await sup.stop()).status)
process.exit(0)
"
```

Run with `MIHOMO_BIN=<binPath from step 1>`.

Expected observations:

- `start -> running` within ~1s, and `state` shows `version` populated from `GET /version`.
- streamed `[stdout]` log lines from mihomo appear.
- `stop -> stopped` and the process is gone (`pgrep mihomo` returns nothing on
  posix; `tasklist | findstr mihomo` is empty on Windows — confirms tree-kill).

## 3. Profiles + active config (exercises ProfileStore.setActive)

```bash
pnpm --filter @metacubexd/agent exec node --input-type=module -e "
import { createProfileStore } from '@metacubexd/agent'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const dir = mkdtempSync(join(tmpdir(), 'mcxd-prof-smoke-'))
const active = join(dir, 'active.yaml')
const store = createProfileStore({ dir, activeConfigPath: active })
const m = await store.create({ name: 'home', content: 'mixed-port: 7890\n' })
await store.setActive(m.id)
console.log('active id', await store.getActiveId())
console.log('active file', readFileSync(active, 'utf8'))
"
```

Expected: prints the active id and the YAML content (no `---` front-matter,
no `id:` key leaked into the YAML).
