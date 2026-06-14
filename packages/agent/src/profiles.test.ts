import type { ProfileStore } from './types'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfileStore } from './profiles'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'mcxd-profiles-'))
}

describe('createProfileStore — disk CRUD', () => {
  let dir: string
  let activeConfigPath: string
  let store: ProfileStore
  let n: number

  beforeEach(() => {
    dir = tmpDir()
    activeConfigPath = join(dir, '..', 'active.yaml')
    n = 0
    store = createProfileStore({
      dir,
      activeConfigPath,
      idGen: () => `id${++n}`,
    })
  })

  it('starts with an empty list', async () => {
    expect(await store.list()).toEqual([])
  })

  it('create writes <id>.yaml + index.json (no YAML front-matter)', async () => {
    const meta = await store.create({
      name: 'home',
      content: 'mixed-port: 7890\n',
    })
    expect(meta.id).toBe('id1')
    expect(meta.name).toBe('home')
    expect(meta.type).toBe('local')
    expect(typeof meta.updatedAt).toBe('number')

    const onDisk = readFileSync(join(dir, 'id1.yaml'), 'utf8')
    expect(onDisk).toBe('mixed-port: 7890\n')
    // No metadata leaked into the YAML as front-matter:
    expect(onDisk).not.toContain('---')
    expect(onDisk).not.toContain('"id"')

    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
    expect(index).toEqual([
      expect.objectContaining({ id: 'id1', name: 'home', type: 'local' }),
    ])
  })

  it('create with no content writes an empty file', async () => {
    await store.create({ name: 'blank' })
    expect(readFileSync(join(dir, 'id1.yaml'), 'utf8')).toBe('')
  })

  it('read returns the raw YAML', async () => {
    await store.create({ name: 'home', content: 'a: 1\n' })
    expect(await store.read('id1')).toBe('a: 1\n')
  })

  it('read throws for a missing id', async () => {
    await expect(store.read('nope')).rejects.toThrow(/not found/i)
  })

  it('update changes name and/or content and bumps updatedAt', async () => {
    const created = await store.create({ name: 'home', content: 'a: 1\n' })
    await new Promise((r) => setTimeout(r, 2))
    const updated = await store.update('id1', {
      name: 'work',
      content: 'b: 2\n',
    })
    expect(updated.name).toBe('work')
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
    expect(await store.read('id1')).toBe('b: 2\n')
    expect((await store.list())[0]!.name).toBe('work')
  })

  it('delete removes the file and the index entry', async () => {
    await store.create({ name: 'home', content: 'a: 1\n' })
    await store.delete('id1')
    expect(await store.list()).toEqual([])
    await expect(store.read('id1')).rejects.toThrow(/not found/i)
  })

  it('duplicate copies content under a new id and a derived name', async () => {
    await store.create({ name: 'home', content: 'a: 1\n' })
    const dup = await store.duplicate('id1')
    expect(dup.id).toBe('id2')
    expect(dup.name).toBe('home copy')
    expect(await store.read('id2')).toBe('a: 1\n')

    const named = await store.duplicate('id1', 'backup')
    expect(named.id).toBe('id3')
    expect(named.name).toBe('backup')
    expect((await store.list()).map((m) => m.id)).toEqual(['id1', 'id2', 'id3'])
  })

  it('persists across store instances (re-reads index.json)', async () => {
    await store.create({ name: 'home', content: 'a: 1\n' })
    const store2 = createProfileStore({ dir, activeConfigPath })
    const list = await store2.list()
    expect(list).toHaveLength(1)
    expect(list[0]!.name).toBe('home')
  })
})

describe('createProfileStore — import + active', () => {
  it('importFromUrl uses UA clash.meta, parses Subscription-Userinfo, stores raw content', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-imp-'))
    const activeConfigPath = join(dir, '..', 'active.yaml')
    let seenUA: string | null = null
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seenUA = new Headers(init?.headers).get('user-agent')
      return new Response('proxies: []\n', {
        status: 200,
        headers: {
          'subscription-userinfo':
            'upload=100; download=200; total=1000; expire=1700000000',
        },
      })
    }) as unknown as typeof fetch
    let n = 0
    const store = createProfileStore({
      dir,
      activeConfigPath,
      fetch: fakeFetch,
      idGen: () => `id${++n}`,
    })

    const meta = await store.importFromUrl('https://sub.example/clash', 'sub')
    expect(seenUA).toBe('clash.meta')
    expect(meta.type).toBe('remote')
    expect(meta.url).toBe('https://sub.example/clash')
    expect(meta.userAgent).toBe('clash.meta')
    expect(meta.subscriptionInfo).toEqual({
      upload: 100,
      download: 200,
      total: 1000,
      expire: 1700000000,
    })
    expect(await store.read('id1')).toBe('proxies: []\n')
  })

  it('importFromUrl tolerates a missing Subscription-Userinfo header', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-imp2-'))
    const fakeFetch = (async () =>
      new Response('proxies: []\n', { status: 200 })) as unknown as typeof fetch
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
      fetch: fakeFetch,
      idGen: () => 'id1',
    })
    const meta = await store.importFromUrl('https://sub.example/clash')
    expect(meta.subscriptionInfo).toBeUndefined()
    expect(meta.name).toBe('https://sub.example/clash')
  })

  it('importFromUrl throws on non-200', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-imp3-'))
    const fakeFetch = (async () =>
      new Response('nope', { status: 403 })) as unknown as typeof fetch
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
      fetch: fakeFetch,
    })
    await expect(store.importFromUrl('https://x')).rejects.toThrow(/403/)
  })

  it('getActiveId is undefined until setActive; setActive writes activeConfigPath', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-act-'))
    const activeConfigPath = join(dir, 'active', 'config.yaml')
    let n = 0
    const store = createProfileStore({
      dir,
      activeConfigPath,
      idGen: () => `id${++n}`,
    })
    expect(await store.getActiveId()).toBeUndefined()
    await store.create({ name: 'home', content: 'mixed-port: 7890\n' })
    await store.setActive('id1')
    expect(await store.getActiveId()).toBe('id1')
    expect(readFileSync(activeConfigPath, 'utf8')).toBe('mixed-port: 7890\n')
  })

  it('deleting the active profile clears activeId', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-act2-'))
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, 'active.yaml'),
      idGen: () => 'id1',
    })
    await store.create({ name: 'home', content: 'a: 1\n' })
    await store.setActive('id1')
    await store.delete('id1')
    expect(await store.getActiveId()).toBeUndefined()
  })
})
