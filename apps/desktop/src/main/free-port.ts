import { createServer } from 'node:net'

export type PortProbe = (port: number) => Promise<boolean>

export interface PickPortsOptions {
  /** First port to try (default 21000). */
  start?: number
  /** Max ports to scan before giving up (default 2000). */
  maxScan?: number
  /** Injectable "is this port free?" probe (default: real OS bind). */
  probe?: PortProbe
}

/** Real probe: try to bind a server to 127.0.0.1:<port>; free => true. */
export const probePort: PortProbe = (port) =>
  new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })

/**
 * Pick `count` distinct free ports starting at `start`. Pure given a probe.
 * Already-chosen ports are never re-offered (guards against the same port
 * passing the probe twice between bind+release).
 */
export async function pickFreePorts(
  count: number,
  options: PickPortsOptions = {},
): Promise<number[]> {
  const start = options.start ?? 21000
  const maxScan = options.maxScan ?? 2000
  const probe = options.probe ?? probePort
  const chosen: number[] = []
  for (let i = 0; i < maxScan && chosen.length < count; i++) {
    const port = start + i
    if (chosen.includes(port)) continue
    if (await probe(port)) chosen.push(port)
  }
  if (chosen.length < count) {
    throw new Error(
      `no free port: found ${chosen.length}/${count} within ${maxScan} from ${start}`,
    )
  }
  return chosen
}
