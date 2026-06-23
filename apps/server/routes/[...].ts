import { readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createError, defineEventHandler, serveStatic, setHeader } from 'h3'

const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))

// Extension → MIME map for the dashboard's static asset types. h3's serveStatic
// does not sniff content-type, so we supply it. ponytail: small map; add an
// entry only if the UI ships a new asset extension.
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

export default defineEventHandler(async (event) => {
  // Never swallow control API requests — those are handled by routes/control.
  if (event.path.startsWith('/api/control')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  // Serve the real static file when one exists at the requested path. Nitro's
  // build-time `publicAssets` is EMPTY in the Docker image (the UI is built in
  // a separate stage and injected at runtime via UI_DIST), so without this the
  // physical assets — config.js, hashed _nuxt/*.js, manifest.webmanifest — are
  // never matched and every request falls through to the SPA shell below,
  // which returns text/html and breaks module/script/manifest loading (#2063).
  // serveStatic also handles path-traversal rejection, etag/304 and HEAD.
  const served = await serveStatic(event, {
    fallthrough: true,
    getContents: (id) => readFile(join(uiDist, id)),
    getMeta: async (id) => {
      const stats = await stat(join(uiDist, id)).catch(() => null)
      if (!stats?.isFile()) return undefined
      return {
        type: MIME[extname(id).toLowerCase()],
        size: stats.size,
        mtime: stats.mtimeMs,
        etag: `W/"${stats.size}-${Math.round(stats.mtimeMs)}"`,
      }
    },
  })
  if (served !== false) return served

  // No physical file → SPA navigation (e.g. /proxies). Serve the client shell.
  const html = await readFile(join(uiDist, 'index.html'), 'utf8')
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return html
})
