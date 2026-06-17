// Pure builder for the mihomo `tun:` config block. The stack (mixed / gvisor /
// system / lwip) comes from the UI; the rest are the safe defaults that make a
// privileged TUN device actually route everything without leaking:
//   - auto-route + auto-detect-interface: mihomo wires the routes/interface
//   - dns-hijack ['any:53']: capture all plaintext DNS through the tunnel
//   - strict-route: prevent self-traffic from looping back out of the tunnel
// `device` is the OS device name (e.g. utun123); omitted entirely when unset so
// mihomo picks one. No OS/privilege side effects here — injection is the caller's
// concern (see TunController).
export function buildTunConfig({
  stack,
  device,
}: {
  stack: string
  device?: string
}): Record<string, unknown> {
  return {
    enable: true,
    stack,
    'auto-route': true,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53'],
    'strict-route': true,
    ...(device !== undefined ? { device } : {}),
  }
}

/**
 * A user-actionable precondition for a TUN transition was not met — e.g. enabling
 * TUN with no active profile to write the `tun:` block into. This is NOT a server
 * fault: the control router maps it to a clean, HANDLED HTTP status (default 409)
 * carrying the reason, instead of letting H3 log an `[unhandled]` 500. The
 * desktop TunController's `precheck` throws it so the failure surfaces BEFORE any
 * destructive kernel teardown.
 */
export class TunPreconditionError extends Error {
  readonly statusCode: number
  constructor(message: string, statusCode = 409) {
    super(message)
    this.name = 'TunPreconditionError'
    this.statusCode = statusCode
  }
}
