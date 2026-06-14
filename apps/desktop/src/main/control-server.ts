import type {App} from 'h3';
import type {Server} from 'node:http';
import { createServer  } from 'node:http'
import {  toNodeListener } from 'h3'

export interface ControlServer {
  server: Server
  port: number
}

/**
 * Bind an h3 app/router (from @metacubexd/agent createAgent().router) onto a
 * Node http server listening on 127.0.0.1:<port>. Loopback-only by design
 * (spec §4: only environ binding + per-launch token guard the surface).
 */
export function startControlServer(
  router: App,
  port: number,
): Promise<ControlServer> {
  const server = createServer(toNodeListener(router))
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve({ server, port })
    })
  })
}

export function stopControlServer(cs: ControlServer): Promise<void> {
  return new Promise((resolve) => cs.server.close(() => resolve()))
}
