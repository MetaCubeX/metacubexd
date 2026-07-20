import { describe, expect, it, vi } from 'vitest'
import { listProxyGroups, selectProxyNode } from '../clash-config'

const EP = { url: 'http://127.0.0.1:9090', secret: 's3cr3t' }

function jsonRes(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function fakeFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
  return vi.fn(impl)
}

describe('listProxyGroups', () => {
  it('returns selection-bearing groups ordered by the GLOBAL member list', () => {
    const proxies = {
      GLOBAL: { type: 'Selector', now: 'Auto', all: ['Manual', 'Auto'] },
      Auto: { type: 'URLTest', now: 'HK', all: ['HK', 'JP'] },
      Manual: { type: 'Selector', now: 'JP', all: ['HK', 'JP'] },
      // Non-selectable + hidden entries are skipped.
      Direct: { type: 'Direct' },
      Hidden: { type: 'Selector', now: 'HK', all: ['HK'], hidden: true },
    }
    return listProxyGroups(
      fakeFetch(() =>
        Promise.resolve(jsonRes({ proxies })),
      ) as unknown as typeof fetch,
      EP,
    ).then((groups) => {
      expect(groups?.map((g) => g.name)).toEqual(['Manual', 'Auto'])
      expect(groups?.[0]).toMatchObject({ now: 'JP', all: ['HK', 'JP'] })
    })
  })

  it('excludes groups with an empty member list', async () => {
    const proxies = {
      Empty: { type: 'Selector', now: 'x', all: [] },
    }
    const groups = await listProxyGroups(
      fakeFetch(() =>
        Promise.resolve(jsonRes({ proxies })),
      ) as unknown as typeof fetch,
      EP,
    )
    expect(groups).toEqual([])
  })

  it('returns null on a non-ok response', async () => {
    const groups = await listProxyGroups(
      fakeFetch(() =>
        Promise.resolve(jsonRes({}, false)),
      ) as unknown as typeof fetch,
      EP,
    )
    expect(groups).toBeNull()
  })

  it('returns null on a network error', async () => {
    const groups = await listProxyGroups(
      fakeFetch(() =>
        Promise.reject(new Error('down')),
      ) as unknown as typeof fetch,
      EP,
    )
    expect(groups).toBeNull()
  })
})

describe('selectProxyNode', () => {
  it('sends a PUT with the selected member, bearer header and encoded group name', async () => {
    const fetchImpl = fakeFetch(() => Promise.resolve(jsonRes({}, true)))
    const ok = await selectProxyNode(
      fetchImpl as unknown as typeof fetch,
      EP,
      'My Group',
      'HK',
    )
    expect(ok).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('http://127.0.0.1:9090/proxies/My%20Group')
    expect(init!.method).toBe('PUT')
    expect(JSON.parse(init!.body as string)).toEqual({ name: 'HK' })
    expect(init!.headers).toMatchObject({ Authorization: 'Bearer s3cr3t' })
  })

  it('resolves false on a rejected switch', async () => {
    const ok = await selectProxyNode(
      fakeFetch(() =>
        Promise.resolve(jsonRes({}, false)),
      ) as unknown as typeof fetch,
      EP,
      'g',
      'n',
    )
    expect(ok).toBe(false)
  })

  it('resolves false (never throws) on a network error', async () => {
    const ok = await selectProxyNode(
      fakeFetch(() =>
        Promise.reject(new Error('down')),
      ) as unknown as typeof fetch,
      EP,
      'g',
      'n',
    )
    expect(ok).toBe(false)
  })
})
