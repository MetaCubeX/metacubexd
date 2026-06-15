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
import type { HelperKernel, HelperKernelResult } from '../main/helper/server'
import { spawn as nodeSpawn } from 'node:child_process'
import { HELPER_PROTOCOL_VERSION } from '../main/helper/protocol'
import { createHelperServer } from '../main/helper/server'

/** Minimal spawn shape (matches the agent supervisor's injectable spawn). */
export type SpawnFn = (
  cmd: string,
  args: string[],
  opts?: object,
) => ChildProcess

export interface PrivilegedKernelDeps {
  /** Injectable process spawn; defaults to node:child_process.spawn. Tests inject. */
  spawn?: SpawnFn
  /** Injectable logger; defaults to console.error. Never silently swallow. */
  logError?: (err: unknown) => void
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
 * Read the parent-provided socket path + shared secret from the env, build the
 * real privileged kernel, and start the IPC server. The parent (B-3 installer)
 * sets these on the service definition; we fail loudly if they are missing
 * rather than listen on an unauthenticated socket.
 */
export async function main(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const socketPath = env.MCXD_HELPER_SOCKET
  const secret = env.MCXD_HELPER_SECRET

  if (!socketPath) {
    throw new Error('helper: MCXD_HELPER_SOCKET is not set')
  }
  if (!secret) {
    throw new Error('helper: MCXD_HELPER_SECRET is not set')
  }

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
