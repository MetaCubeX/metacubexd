import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, toNodeListener } from 'h3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// The catch-all reads UI_DIST at module load, so set it before importing.
let base: string
let server: ReturnType<typeof createServer>

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uidist-'))
  await writeFile(
    join(dir, 'index.html'),
    '<!doctype html><title>shell</title>',
  )
  await writeFile(join(dir, 'config.js'), 'window.CONFIG = 1')
  await writeFile(join(dir, 'manifest.webmanifest'), '{"name":"metacubexd"}')
  await mkdir(join(dir, '_nuxt'), { recursive: true })
  await writeFile(join(dir, '_nuxt', 'app.123.js'), 'export const x = 1')
  process.env.UI_DIST = dir

  const handler = (await import('../[...]')).default
  const app = createApp()
  app.use(handler)
  server = createServer(toNodeListener(app))
  await new Promise<void>((r) => server.listen(0, () => r()))
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})

afterAll(() => new Promise<void>((r) => server.close(() => r())))

describe('apps/server routes/[...] -> SPA catch-all (#2063)', () => {
  it('serves a real JS asset as JavaScript, not the HTML shell', async () => {
    const res = await fetch(`${base}/config.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
    expect(await res.text()).toContain('window.CONFIG')
  })

  it('serves the webmanifest as JSON', async () => {
    const res = await fetch(`${base}/manifest.webmanifest`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('json')
  })

  it('serves nested hashed assets', async () => {
    const res = await fetch(`${base}/_nuxt/app.123.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('javascript')
  })

  it('falls back to the SPA shell for client-side routes', async () => {
    const res = await fetch(`${base}/proxies`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('shell')
  })

  it('does not handle the control API namespace', async () => {
    const res = await fetch(`${base}/api/control/info`)
    expect(res.status).toBe(404)
  })
})
