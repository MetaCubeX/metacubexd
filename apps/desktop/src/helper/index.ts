/**
 * Privileged helper process entry (spec §12.1/§12.2). This file is bundled by
 * electron-vite to `out/helper/index.js` and run by the BUNDLED Electron binary
 * under `ELECTRON_RUN_AS_NODE=1` (Electron-as-Node), installed as a privileged
 * OS service in B-3 (`<electron-bin> <out/helper/index.js>` as root/admin).
 *
 * It reads the local socket path + per-install shared secret from the env the
 * parent passes in, constructs the REAL privileged kernel manager (which
 * privileged-spawns the bundled mihomo so it can build the TUN device / routes /
 * DNS hijack), and starts the IPC server (auth + version handshake + dispatch).
 *
 * The real `child_process.spawn` is kept behind a small injectable so it is
 * NEVER exercised in unit tests — the server/client tests inject an in-memory
 * kernel stub instead. Real privileged run / service install / real mihomo spawn
 * are verified only on real machines (B-3 + user smoke), NOT here.
 */

import type { ChildProcess } from 'node:child_process'
import type {
  HelperKernel,
  HelperKernelResult,
  HelperKernelStartOptions,
} from '../main/helper/server'
import { spawn as nodeSpawn } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { HELPER_PROTOCOL_VERSION } from '../main/helper/protocol'
import { createHelperServer } from '../main/helper/server'

/** Minimal spawn shape (matches the agent supervisor's injectable spawn). */
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts?: object,
) => ChildProcess

/** Minimal stat shape used to validate a path before spawning it as root. */
export type StatPathFn = (p: string) => { isFile: boolean; mode: number }

export interface PrivilegedKernelDeps {
  /** Injectable process spawn; defaults to node:child_process.spawn. Tests inject. */
  spawn?: SpawnFn
  /** Injectable logger; defaults to console.error. Never silently swallow. */
  logError?: (err: unknown) => void
  /** Injectable stat for spawn-path validation; defaults to node:fs.statSync. */
  statPath?: StatPathFn
  /** Platform (gates the POSIX writable-bit check); defaults to process.platform. */
  platform?: NodeJS.Platform
}

/**
 * Defense-in-depth before a privileged spawn. The IPC is already secret-gated,
 * but the helper runs AS ROOT, so refuse to spawn unless the inputs are sane:
 * all three paths absolute, the binary an existing regular file, and (POSIX) not
 * writable by group/other — an unprivileged user able to overwrite the binary
 * could otherwise run arbitrary code as root. Throws on violation; the server's
 * dispatch turns the throw into an ok:false response (no spawn, no leak).
 */
export function assertSafeKernelPaths(
  opts: HelperKernelStartOptions,
  statPath: StatPathFn,
  platform: NodeJS.Platform,
): void {
  const entries: [string, string][] = [
    ['binaryPath', opts.binaryPath],
    ['homeDir', opts.homeDir],
    ['configPath', opts.configPath],
  ]
  for (const [name, value] of entries) {
    if (typeof value !== 'string' || value.length === 0 || !isAbsolute(value)) {
      throw new Error(
        `helper: refusing to spawn — ${name} must be an absolute path`,
      )
    }
  }
  let info: { isFile: boolean; mode: number }
  try {
    info = statPath(opts.binaryPath)
  } catch {
    throw new Error(
      `helper: refusing to spawn — binaryPath does not exist: ${opts.binaryPath}`,
    )
  }
  if (!info.isFile) {
    throw new Error(
      `helper: refusing to spawn — binaryPath is not a regular file: ${opts.binaryPath}`,
    )
  }
  // POSIX only — on Windows statSync's mode bits are synthetic, so the named-pipe
  // ACL + service registration govern access there instead.
  if (platform !== 'win32' && (info.mode & 0o022) !== 0) {
    throw new Error(
      `helper: refusing to spawn — binaryPath is group/world-writable: ${opts.binaryPath}`,
    )
  }
}

/**
 * The REAL privileged kernel manager: since the helper itself runs as
 * root/admin, the spawned mihomo inherits the privilege needed to build the TUN
 * device, configure routes and hijack DNS. mihomo is launched with the bundled
 * binary against the resolved home dir + config (`-d` / `-f`). The spawn is
 * injectable so this module is testable without ever creating a real privileged
 * process (the actual spawn is exercised only on real machines in B-3).
 */
export function createPrivilegedKernel(
  deps: PrivilegedKernelDeps = {},
): HelperKernel {
  const spawn = deps.spawn ?? nodeSpawn
  const logError = deps.logError ?? ((err: unknown) => console.error(err))
  const statPath: StatPathFn =
    deps.statPath ??
    ((p) => {
      const s = statSync(p)
      return { isFile: s.isFile(), mode: s.mode }
    })
  const platform = deps.platform ?? process.platform

  let child: ChildProcess | undefined

  function isRunning(): boolean {
    return child !== undefined && child.exitCode === null && !child.killed
  }

  return {
    async start({
      binaryPath,
      homeDir,
      configPath,
    }): Promise<HelperKernelResult> {
      // Validate BEFORE touching any running kernel so a bad request can't tear
      // down a healthy one. Throws -> server returns ok:false (no spawn).
      assertSafeKernelPaths(
        { binaryPath, homeDir, configPath },
        statPath,
        platform,
      )
      // Replace any prior process first so we never leak a privileged kernel.
      if (isRunning()) await this.stop()

      const proc = spawn(binaryPath, ['-d', homeDir, '-f', configPath], {
        stdio: 'ignore',
      })
      child = proc
      proc.on('exit', () => {
        if (child === proc) child = undefined
      })
      proc.on('error', (err) => logError(err))

      return { ok: true, running: isRunning() }
    },
    async stop(): Promise<void> {
      const proc = child
      child = undefined
      if (!proc || proc.exitCode !== null || proc.killed) return
      proc.kill()
    },
    status(): HelperKernelResult {
      return { ok: true, running: isRunning() }
    },
    version(): string {
      return HELPER_PROTOCOL_VERSION
    },
  }
}

/**
 * Resolve the shared secret. Prefer the secret FILE (0600, root-owned — written
 * by the installer) so the secret never lives in the world-readable daemon plist
 * / systemd unit / service registry env. Fall back to the inline
 * MCXD_HELPER_SECRET env for backward compatibility with a service installed by
 * an older build (until it is reinstalled). Throws (never returns empty) so we
 * fail loud rather than authenticate against a blank secret.
 */
export function resolveHelperSecret(
  env: NodeJS.ProcessEnv,
  readSecretFile: (p: string) => string,
): string {
  const secretFile = env.MCXD_HELPER_SECRET_FILE
  if (secretFile) {
    let value: string
    try {
      value = readSecretFile(secretFile)
    } catch {
      throw new Error(
        `helper: cannot read MCXD_HELPER_SECRET_FILE: ${secretFile}`,
      )
    }
    if (!value) {
      throw new Error(`helper: MCXD_HELPER_SECRET_FILE is empty: ${secretFile}`)
    }
    return value
  }
  const secret = env.MCXD_HELPER_SECRET
  if (!secret) {
    throw new Error(
      'helper: no shared secret (set MCXD_HELPER_SECRET_FILE or MCXD_HELPER_SECRET)',
    )
  }
  return secret
}

/**
 * Read the parent-provided socket path from the env, resolve the shared secret
 * (file-preferred, see resolveHelperSecret), build the real privileged kernel,
 * and start the IPC server. The parent (B-3 installer) sets these on the service
 * definition; we fail loudly if they are missing rather than listen on an
 * unauthenticated socket.
 */
export async function main(
  env: NodeJS.ProcessEnv = process.env,
  readSecretFile: (p: string) => string = (p) => readFileSync(p, 'utf8').trim(),
): Promise<void> {
  const socketPath = env.MCXD_HELPER_SOCKET
  if (!socketPath) {
    throw new Error('helper: MCXD_HELPER_SOCKET is not set')
  }
  const secret = resolveHelperSecret(env, readSecretFile)

  const kernel = createPrivilegedKernel()
  await createHelperServer({ socketPath, secret, kernel })
}

// Run only when executed as the helper entry (not when imported by a test).
// Under ELECTRON_RUN_AS_NODE the bundled output is the process entry, so this
// guard mirrors `require.main === module` for the ESM build.
if (process.env.MCXD_HELPER_SOCKET) {
  void main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
