import type { App } from 'h3'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, eventHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  startControlServer,
  stopControlServer,
} from '../control-server'

// Raw http request so we can set the Origin header (undici's fetch treats it as
// a forbidden header and drops it).
function rawRequest(
  port: number,
  path: string,
  opts: { method?: string; origin?: string } = {},
): Promise<{
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: opts.method ?? 'GET',
        headers: opts.origin ? { origin: opts.origin } : {},
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body }),
        )
      },
    )
    req.on('error', reject)
    req.end()
  })
}

describe('buildContentSecurityPolicy', () => {
  const csp = buildContentSecurityPolicy()

  it('locks scripts to self while allowing the inline/eval the bundler needs', () => {
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  })

  it('allows Monaco blob: web-workers', () => {
    expect(csp).toContain("worker-src 'self' blob:")
  })

  it('keeps connect-src open for the kernel on another loopback port (ws/http)', () => {
    expect(csp).toContain('connect-src')
    expect(csp).toMatch(/connect-src[^;]*ws:/)
    expect(csp).toMatch(/connect-src[^;]*http:/)
  })

  it('allows http: + https: images so plain-http proxy-group icons still render', () => {
    // `http:` can't match inside `https:` (the char after `http` there is `s`),
    // so these two assertions are independent.
    expect(csp).toMatch(/img-src[^;]* http:/)
    expect(csp).toMatch(/img-src[^;]* https:/)
  })

  it('locks down object-src, base-uri and framing', () => {
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })
})

describe('startControlServer security headers', () => {
  let dir: string
  let router: App
  let server: Awaited<ReturnType<typeof startControlServer>> | null = null

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mcxd-cs-'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title>')
    writeFileSync(join(dir, 'app.js'), 'console.log(1)')
    router = createApp()
    router.use(
      '/api/control/ping',
      eventHandler(() => ({ ok: true })),
    )
  })

  afterEach(async () => {
    if (server) await stopControlServer(server)
    server = null
    rmSync(dir, { recursive: true, force: true })
  })

  it('serves the document with a CSP + nosniff header', async () => {
    server = await startControlServer(router, 0, dir)
    const res = await fetch(`http://127.0.0.1:${server.port}/`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toContain(
      "script-src 'self'",
    )
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('does not attach a CSP to non-document assets but keeps nosniff', async () => {
    server = await startControlServer(router, 0, dir)
    const res = await fetch(`http://127.0.0.1:${server.port}/app.js`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('still routes /api/control to the agent router', async () => {
    server = await startControlServer(router, 0, dir)
    const res = await fetch(`http://127.0.0.1:${server.port}/api/control/ping`)
    expect(await res.json()).toEqual({ ok: true })
  })

  describe('dev CORS shim (allowDevCors)', () => {
    it('is OFF by default: no CORS header even for a loopback Origin', async () => {
      server = await startControlServer(router, 0, dir)
      const res = await rawRequest(server.port, '/api/control/ping', {
        origin: 'http://localhost:3000',
      })
      expect(res.status).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('reflects a loopback Origin when enabled and still routes the request', async () => {
      server = await startControlServer(router, 0, dir, true)
      const res = await rawRequest(server.port, '/api/control/ping', {
        origin: 'http://localhost:3000',
      })
      expect(res.status).toBe(200)
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      )
      expect(JSON.parse(res.body)).toEqual({ ok: true })
    })

    it('answers the preflight OPTIONS with 204 + allowed headers', async () => {
      server = await startControlServer(router, 0, dir, true)
      const res = await rawRequest(server.port, '/api/control/ping', {
        method: 'OPTIONS',
        origin: 'http://127.0.0.1:5173',
      })
      expect(res.status).toBe(204)
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://127.0.0.1:5173',
      )
      expect(res.headers['access-control-allow-headers']).toContain(
        'authorization',
      )
    })

    it('does NOT reflect a non-loopback Origin even when enabled', async () => {
      server = await startControlServer(router, 0, dir, true)
      const res = await rawRequest(server.port, '/api/control/ping', {
        origin: 'https://evil.example.com',
      })
      expect(res.headers['access-control-allow-origin']).toBeUndefined()
    })
  })
})
