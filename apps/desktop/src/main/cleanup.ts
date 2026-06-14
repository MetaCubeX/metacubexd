import type { SystemProxyController } from '@metacubexd/agent/types'

export interface ShutdownCleanupDeps {
  /**
   * The OS system-proxy controller, if one was constructed. Disabled
   * best-effort so quitting never leaves the machine pointing at a dead
   * loopback proxy (anti-lockout).
   */
  systemProxy?: SystemProxyController
  /** Stop the mihomo kernel (supervisor.stop). */
  stopKernel: () => Promise<unknown>
  /** Tear down the in-process control/renderer HTTP server. */
  stopControlServer: () => Promise<unknown>
}

/**
 * Run the quit/cleanup sequence. Each step is best-effort and isolated in its
 * own try/catch so a failure in one never prevents the others — releasing the
 * system proxy is the safety-critical one (a proxy left pointing at a stopped
 * loopback port = no internet for the whole machine). Always resolves.
 */
export async function runShutdownCleanup(
  deps: ShutdownCleanupDeps,
): Promise<void> {
  try {
    await deps.systemProxy?.disable()
  } catch {
    /* anti-lockout best-effort; never block the rest of shutdown */
  }
  try {
    await deps.stopKernel()
  } catch {
    /* ignore */
  }
  try {
    await deps.stopControlServer()
  } catch {
    /* ignore */
  }
}
