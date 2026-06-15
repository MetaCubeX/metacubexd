import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createWebdavClient } from './webdav'

interface Recorded {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
}

function recorder(respond: (rec: Recorded) => Response): {
  fetch: typeof fetch
  calls: Recorded[]
} {
  const calls: Recorded[] = []
  const fakeFetch = vi.fn(async (url: string, init?: RequestInit) => {
    const headers: Record<string, string> = {}
    const h = init?.headers as Record<string, string> | undefined
    if (h) for (const [k, v] of Object.entries(h)) headers[k.toLowerCase()] = v
    const rec: Recorded = {
      method: init?.method ?? 'GET',
      url,
      headers,
      body: init?.body == null ? undefined : String(init.body),
    }
    calls.push(rec)
    return respond(rec)
  })
  return { fetch: fakeFetch as unknown as typeof fetch, calls }
}

const AUTH = `Basic ${Buffer.from('user:pass').toString('base64')}`

describe('createWebdavClient', () => {
  it('put() issues PUT with Basic auth, joined URL and body', async () => {
    const { fetch, calls } = recorder(() => new Response(null, { status: 201 }))
    const client = createWebdavClient({
      url: 'https://dav.example.com/remote.php/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })

    await client.put('backup/metacubexd-backup.json', '{"v":1}')

    expect(calls).toHaveLength(1)
    const [call] = calls
    expect(call!.method).toBe('PUT')
    expect(call!.url).toBe(
      'https://dav.example.com/remote.php/dav/backup/metacubexd-backup.json',
    )
    expect(call!.headers.authorization).toBe(AUTH)
    expect(call!.body).toBe('{"v":1}')
  })

  it('get() issues GET with Basic auth and returns the response text', async () => {
    const { fetch, calls } = recorder(
      () => new Response('{"version":1}', { status: 200 }),
    )
    const client = createWebdavClient({
      url: 'https://dav.example.com/remote.php/dav',
      username: 'user',
      password: 'pass',
      fetch,
    })

    const text = await client.get('backup/metacubexd-backup.json')

    expect(text).toBe('{"version":1}')
    const [call] = calls
    expect(call!.method).toBe('GET')
    expect(call!.url).toBe(
      'https://dav.example.com/remote.php/dav/backup/metacubexd-backup.json',
    )
    expect(call!.headers.authorization).toBe(AUTH)
  })

  it('mkcol() issues MKCOL with Basic auth on the joined dir URL', async () => {
    const { fetch, calls } = recorder(() => new Response(null, { status: 201 }))
    const client = createWebdavClient({
      url: 'https://dav.example.com/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })

    await client.mkcol('backup')

    const [call] = calls
    expect(call!.method).toBe('MKCOL')
    expect(call!.url).toBe('https://dav.example.com/dav/backup')
    expect(call!.headers.authorization).toBe(AUTH)
  })

  it('joins url + path safely regardless of trailing/leading slashes', async () => {
    const { fetch, calls } = recorder(() => new Response(null, { status: 200 }))
    const client = createWebdavClient({
      url: 'https://dav.example.com/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })

    await client.get('/sub/file.json')

    expect(calls[0]!.url).toBe('https://dav.example.com/dav/sub/file.json')
  })

  it('put() throws a clear error on a non-2xx response', async () => {
    const { fetch } = recorder(
      () => new Response('denied', { status: 403, statusText: 'Forbidden' }),
    )
    const client = createWebdavClient({
      url: 'https://dav.example.com/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })

    await expect(client.put('f.json', 'x')).rejects.toThrow(/403/)
  })

  it('get() throws a clear error on a non-2xx response', async () => {
    const { fetch } = recorder(() => new Response('nope', { status: 404 }))
    const client = createWebdavClient({
      url: 'https://dav.example.com/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })

    await expect(client.get('missing.json')).rejects.toThrow(/404/)
  })

  it('mkcol() tolerates 405 / 301 (collection already exists)', async () => {
    for (const status of [405, 301]) {
      const { fetch } = recorder(() => new Response(null, { status }))
      const client = createWebdavClient({
        url: 'https://dav.example.com/dav/',
        username: 'user',
        password: 'pass',
        fetch,
      })
      await expect(client.mkcol('existing')).resolves.toBeUndefined()
    }
  })

  it('mkcol() still throws on a real error status', async () => {
    const { fetch } = recorder(() => new Response('boom', { status: 500 }))
    const client = createWebdavClient({
      url: 'https://dav.example.com/dav/',
      username: 'user',
      password: 'pass',
      fetch,
    })
    await expect(client.mkcol('dir')).rejects.toThrow(/500/)
  })
})
