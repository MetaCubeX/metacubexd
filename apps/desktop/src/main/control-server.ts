import type { App } from 'h3'
import type { Server, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { toNodeListener } from 'h3'

export interface ControlServer {
  server: Server
  port: number
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
}

async function sendFile(path: string, res: ServerResponse): Promise<boolean> {
  try {
    const s = await stat(path)
    if (!s.isFile()) return false
    res.statusCode = 200
    res.setHeader(
      'content-type',
      CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    )
    createReadStream(path).pipe(res)
    return true
  } catch {
    return false
  }
}

/**
 * Serve the prebuilt dashboard (renderer dir) over http with a SPA fallback to
 * index.html. Loopback-only; the renderer + control API live on the SAME origin
 * so the UI's fetch()/EventSource and Monaco web-workers all work without CORS
 * or file:// restrictions (the reason we loadURL instead of loadFile).
 */
async function serveStatic(
  rendererDir: string,
  url: string,
  res: ServerResponse,
): Promise<void> {
  const pathname = decodeURIComponent((url.split('?')[0] ?? '/').split('#')[0]!)
  // Strip leading "../" segments before joining to block path traversal.
  const rel = normalize(pathname).replace(/^(?:\.\.[/\\])+/, '')
  const indexHtml = join(rendererDir, 'index.html')

  if (pathname === '/' || pathname.endsWith('/')) {
    if (await sendFile(indexHtml, res)) return
  }
  const candidate = join(rendererDir, rel)
  if (candidate.startsWith(rendererDir) && (await sendFile(candidate, res))) {
    return
  }
  // SPA fallback: unknown non-asset path -> app shell (hash routing).
  if (await sendFile(indexHtml, res)) return
  res.statusCode = 404
  res.end('Not Found')
}

/**
 * Bind the agent's h3 control router AND the static dashboard onto one Node http
 * server on 127.0.0.1:<port>. Requests under /api/control go to the agent; all
 * other GETs serve the renderer. Loopback-only by design (spec §4: environ
 * binding + per-launch token guard the surface).
 */
export function startControlServer(
  router: App,
  port: number,
  rendererDir: string,
): Promise<ControlServer> {
  const agentListener = toNodeListener(router)
  const server = createServer((req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/api/control')) {
      agentListener(req, res)
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      void serveStatic(rendererDir, url, res)
    } else {
      res.statusCode = 405
      res.end('Method Not Allowed')
    }
  })
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
