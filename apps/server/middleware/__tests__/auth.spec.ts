import { describe, expect, it } from 'vitest'
import { isAuthorized } from '../auth'

const TOKEN = 'agent-tok'

describe('apps/server middleware/auth -> isAuthorized', () => {
  it('allows the public health endpoint with no token', () => {
    expect(
      isAuthorized({
        path: '/api/control/health',
        authHeader: undefined,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('allows static UI paths (non /api/control) with no token', () => {
    for (const path of [
      '/',
      '/index.html',
      '/assets/app.123.js',
      '/#/proxies',
    ]) {
      expect(
        isAuthorized({
          path,
          authHeader: undefined,
          queryToken: undefined,
          configuredToken: TOKEN,
        }),
      ).toEqual({ ok: true })
    }
  })

  it('rejects a guarded control path with no credentials', () => {
    const r = isAuthorized({
      path: '/api/control/info',
      authHeader: undefined,
      queryToken: undefined,
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(401)
  })

  it('rejects a guarded control path with the wrong Bearer token', () => {
    const r = isAuthorized({
      path: '/api/control/kernel/status',
      authHeader: 'Bearer nope',
      queryToken: undefined,
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(401)
  })

  it('accepts a guarded control path with the correct Bearer token', () => {
    expect(
      isAuthorized({
        path: '/api/control/profiles',
        authHeader: `Bearer ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('accepts the SSE log stream via ?token= query when Bearer is absent', () => {
    expect(
      isAuthorized({
        path: '/api/control/kernel/logs',
        authHeader: undefined,
        queryToken: TOKEN,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects the SSE log stream with a wrong ?token=', () => {
    const r = isAuthorized({
      path: '/api/control/kernel/logs',
      authHeader: undefined,
      queryToken: 'nope',
      configuredToken: TOKEN,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(401)
  })

  it('is case-insensitive on the Bearer scheme', () => {
    expect(
      isAuthorized({
        path: '/api/control/info',
        authHeader: `bearer ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('accepts whitespace between the scheme and token without accepting a prefix', () => {
    expect(
      isAuthorized({
        path: '/api/control/info',
        authHeader: `Bearer\t  ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
    expect(
      isAuthorized({
        path: '/api/control/info',
        authHeader: `BearerToken ${TOKEN}`,
        queryToken: undefined,
        configuredToken: TOKEN,
      }).ok,
    ).toBe(false)
  })

  it('keeps /api/control/health public even when a token IS configured', () => {
    expect(
      isAuthorized({
        path: '/api/control/health',
        authHeader: 'Bearer wrong',
        queryToken: undefined,
        configuredToken: TOKEN,
      }),
    ).toEqual({ ok: true })
  })

  it('locks down guarded paths when no token is configured (fail closed)', () => {
    const r = isAuthorized({
      path: '/api/control/info',
      authHeader: undefined,
      queryToken: undefined,
      configuredToken: '',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(503)
  })
})
