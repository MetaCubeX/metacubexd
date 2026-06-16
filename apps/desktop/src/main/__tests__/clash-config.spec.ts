import { describe, expect, it, vi } from 'vitest'
import { getProxyMode, nextProxyMode, setProxyMode } from '../clash-config'

const EP = { url: 'http://127.0.0.1:9090', secret: 's3cr3t' }

function jsonRes(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

// A fetch double whose call args are typed so mock.calls carries the tuple.
function fakeFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn(impl)
}

describe('getProxyMode', () => {
  it('reads /configs with the bearer header and returns the lowercased mode', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(jsonRes({ mode: 'Global' })),
    )
    const mode = await getProxyMode(fetchImpl as unknown as typeof fetch, EP)
    expect(mode).toBe('global')
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://127.0.0.1:9090/configs')
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer s3cr3t',
    })
    expect(init!.signal).toBeInstanceOf(AbortSignal)
  })

  it('omits the Authorization header when the secret is empty', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(jsonRes({ mode: 'rule' })),
    )
    await getProxyMode(fetchImpl as unknown as typeof fetch, {
      url: 'http://127.0.0.1:9090',
      secret: '',
    })
    const init = fetchImpl.mock.calls[0]![1]!
    expect(init.headers).not.toHaveProperty('Authorization')
  })

  it('returns null on a non-ok response', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(jsonRes({ mode: 'rule' }, false)),
    )
    expect(
      await getProxyMode(fetchImpl as unknown as typeof fetch, EP),
    ).toBeNull()
  })

  it('returns null for an unrecognized mode', async () => {
    const fetchImpl = fakeFetch(() =>
      Promise.resolve(jsonRes({ mode: 'script' })),
    )
    expect(
      await getProxyMode(fetchImpl as unknown as typeof fetch, EP),
    ).toBeNull()
  })

  it('returns null when fetch rejects (wedged kernel)', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new Error('ECONNREFUSED')))
    expect(
      await getProxyMode(fetchImpl as unknown as typeof fetch, EP),
    ).toBeNull()
  })
})

describe('setProxyMode', () => {
  it('switches the mode via a PATCH body and resolves res.ok', async () => {
    const fetchImpl = fakeFetch(() => Promise.resolve(jsonRes({}, true)))
    const ok = await setProxyMode(
      fetchImpl as unknown as typeof fetch,
      EP,
      'direct',
    )
    expect(ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://127.0.0.1:9090/configs')
    expect(init!.method).toBe('PATCH')
    expect(init!.body).toBe(JSON.stringify({ mode: 'direct' }))
    expect(init!.headers).toMatchObject({
      Authorization: 'Bearer s3cr3t',
      'Content-Type': 'application/json',
    })
  })

  it('resolves false when the kernel rejects the change', async () => {
    const fetchImpl = fakeFetch(() => Promise.resolve(jsonRes({}, false)))
    expect(
      await setProxyMode(fetchImpl as unknown as typeof fetch, EP, 'rule'),
    ).toBe(false)
  })

  it('resolves false (never throws) when fetch rejects', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new Error('timeout')))
    expect(
      await setProxyMode(fetchImpl as unknown as typeof fetch, EP, 'rule'),
    ).toBe(false)
  })
})

describe('nextProxyMode', () => {
  it('cycles rule → global → direct → rule', () => {
    expect(nextProxyMode('rule')).toBe('global')
    expect(nextProxyMode('global')).toBe('direct')
    expect(nextProxyMode('direct')).toBe('rule')
  })

  it('starts at rule for an unknown/null current', () => {
    expect(nextProxyMode(null)).toBe('rule')
  })
})
