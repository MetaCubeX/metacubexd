/**
 * Named loopback ports picked at boot. boot() calls pickFreePorts(3) and feeds
 * the result here to get role-tagged ports:
 *   - controlPort: the in-process control server (renderer + /api/control)
 *   - clashPort:   the mihomo Clash API (external-controller)
 *   - mixedPort:   the kernel's managed mixed (http+socks) proxy — prerequisite
 *                  for Wave 2 system-proxy wiring (exposed via MCXD_MIXED_PORT)
 */
export interface BootPorts {
  controlPort: number
  clashPort: number
  mixedPort: number
}

/**
 * Destructure the three free ports picked at boot into named roles. Pure so the
 * port-selection wiring is unit-testable without standing up Electron.
 */
export function resolveBootPorts(ports: readonly number[]): BootPorts {
  const [controlPort, clashPort, mixedPort] = ports
  if (controlPort == null || clashPort == null || mixedPort == null) {
    throw new Error(
      `expected three ports [control, clash, mixed], got ${ports.length}`,
    )
  }
  return { controlPort, clashPort, mixedPort }
}
