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

/**
 * Restrictive-but-functional CSP for the dashboard document. The renderer is a
 * Nuxt SPA that (a) drives Monaco through blob: web-workers, (b) talks to the
 * Clash kernel on a DIFFERENT loopback port over http + ws, and (c) may pull
 * provider/proxy icons over https. So scripts/styles stay 'self' (plus the
 * inline/eval the bundler + Monaco emit), workers come from blob:, and connect/
 * img are deliberately broad for the kernel endpoint + remote icons. object-src,
 * base-uri and frame-ancestors are locked down. The chief win is script-src
 * 'self': even if markup were injected, a remote `<script src>` can't load.
 */
export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    // http: included (mirroring connect-src): proxy-group/provider icons in real
    // mihomo configs are commonly plain-http URLs — omitting it silently breaks
    // icons that rendered before any CSP existed.
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self' http: https: ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

async function sendFile(path: string, res: ServerResponse): Promise<boolean> {
  try {
    const s = await stat(path)
    if (!s.isFile()) return false
    const ext = extname(path).toLowerCase()
    res.statusCode = 200
    res.setHeader(
      'content-type',
      CONTENT_TYPES[ext] ?? 'application/octet-stream',
    )
    // The CSP governs the document and every subresource it pulls, so it only
    // needs to ride the HTML response (incl. the SPA fallback, which is also
    // index.html). nosniff blocks content-type confusion on the served assets.
    if (ext === '.html') {
      res.setHeader('content-security-policy', buildContentSecurityPolicy())
    }
    res.setHeader('x-content-type-options', 'nosniff')
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
      // Resolve with the ACTUAL bound port. Normally this equals `port`, but a
      // caller may pass 0 to let the OS assign one (used by tests); reading it
      // back from address() makes that work and is correct either way.
      const addr = server.address()
      const boundPort = typeof addr === 'object' && addr ? addr.port : port
      resolve({ server, port: boundPort })
    })
  })
}

export function stopControlServer(cs: ControlServer): Promise<void> {
  return new Promise((resolve) => {
    cs.server.close(() => resolve())
    // server.close() only resolves once every connection drains, but the
    // /kernel/logs SSE stream stays open as long as a renderer holds it — so on
    // quit close() would hang forever. Force the sockets down.
    // closeIdleConnections() is insufficient (the SSE socket is active, not
    // idle); closeAllConnections() is required.
    cs.server.closeAllConnections()
  })
}
