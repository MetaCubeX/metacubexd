import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createError, defineEventHandler, setHeader } from 'h3'

const uiDist =
  process.env.UI_DIST ||
  fileURLToPath(new URL('../../packages/ui/.output/public', import.meta.url))

export default defineEventHandler(async (event) => {
  // Never swallow control API requests — those are handled by routes/control.
  if (event.path.startsWith('/api/control')) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  // Only HTML navigations fall back to the SPA shell.
  if (event.method !== 'GET') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }
  const html = await readFile(join(uiDist, 'index.html'), 'utf8')
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  return html
})
