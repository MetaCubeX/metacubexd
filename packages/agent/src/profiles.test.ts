import type { ProfileStore } from './types'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
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

describe('createProfileStore — merge profiles', () => {
  let dir: string
  let activeConfigPath: string
  let store: ProfileStore
  let n: number

  beforeEach(() => {
    dir = tmpDir()
    activeConfigPath = join(dir, 'active', 'config.yaml')
    n = 0
    store = createProfileStore({
      dir,
      activeConfigPath,
      idGen: () => `id${++n}`,
    })
  })

  it('create with type "merge" persists the type in meta', async () => {
    const meta = await store.create({
      name: 'overlay',
      content: 'mode: rule\n',
      type: 'merge',
    })
    expect(meta.type).toBe('merge')
    const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'))
    expect(index[0]).toMatchObject({ id: 'id1', type: 'merge' })
  })

  it('create defaults type to "local" when omitted', async () => {
    const meta = await store.create({ name: 'home', content: 'a: 1\n' })
    expect(meta.type).toBe('local')
  })

  it('update can toggle the enabled flag', async () => {
    await store.create({ name: 'overlay', content: 'a: 1\n', type: 'merge' })
    const updated = await store.update('id1', { enabled: false })
    expect(updated.enabled).toBe(false)
    expect((await store.list())[0]!.enabled).toBe(false)
    const reEnabled = await store.update('id1', { enabled: true })
    expect(reEnabled.enabled).toBe(true)
  })

  it('setActive composes enabled merge overlays onto the base', async () => {
    await store.create({
      name: 'base',
      content: 'mode: rule\nmixed-port: 7890\n',
    })
    await store.create({
      name: 'overlay',
      content: 'mode: global\n',
      type: 'merge',
    })
    await store.setActive('id1')
    const active = readFileSync(activeConfigPath, 'utf8')
    expect(active).toContain('mode: global')
    expect(active).toContain('mixed-port: 7890')
  })

  it('setActive excludes a disabled merge overlay', async () => {
    await store.create({ name: 'base', content: 'mode: rule\n' })
    await store.create({
      name: 'overlay',
      content: 'mode: global\n',
      type: 'merge',
    })
    await store.update('id2', { enabled: false })
    await store.setActive('id1')
    const active = readFileSync(activeConfigPath, 'utf8')
    expect(active).toContain('mode: rule')
    expect(active).not.toContain('mode: global')
  })

  it('setActive composes multiple enabled merges in index order', async () => {
    await store.create({ name: 'base', content: 'mode: rule\n' })
    await store.create({
      name: 'first',
      content: 'mode: global\n',
      type: 'merge',
    })
    await store.create({
      name: 'second',
      content: 'mode: direct\n',
      type: 'merge',
    })
    await store.setActive('id1')
    const active = readFileSync(activeConfigPath, 'utf8')
    // Later overlay wins for the same key.
    expect(active).toContain('mode: direct')
    expect(active).not.toContain('mode: global')
  })

  it('setActive writes the base verbatim when there are NO merge overlays', async () => {
    const content = 'mixed-port: 7890\n# a comment\nmode:   rule\n'
    await store.create({ name: 'base', content })
    await store.setActive('id1')
    // Byte-identical: no reformatting / re-serialization.
    expect(readFileSync(activeConfigPath, 'utf8')).toBe(content)
  })

  it('setActive throws when the target profile is a merge type', async () => {
    await store.create({
      name: 'overlay',
      content: 'mode: global\n',
      type: 'merge',
    })
    await expect(store.setActive('id1')).rejects.toThrow(/merge/i)
  })
})

describe('createProfileStore — refresh', () => {
  it('refresh re-fetches in place: same id, overwritten content, new subscriptionInfo + updatedAt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-ref-'))
    const activeConfigPath = join(dir, '..', 'active.yaml')
    let body = 'proxies: [first]\n'
    let userinfo = 'upload=100; download=200; total=1000; expire=1700000000'
    const seenUAs: (string | null)[] = []
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seenUAs.push(new Headers(init?.headers).get('user-agent'))
      return new Response(body, {
        status: 200,
        headers: { 'subscription-userinfo': userinfo },
      })
    }) as unknown as typeof fetch
    let n = 0
    const store = createProfileStore({
      dir,
      activeConfigPath,
      fetch: fakeFetch,
      idGen: () => `id${++n}`,
    })

    const imported = await store.importFromUrl(
      'https://sub.example/clash',
      'sub',
    )
    expect(imported.id).toBe('id1')

    // Server now returns new content + updated usage.
    body = 'proxies: [second]\n'
    userinfo = 'upload=500; download=600; total=2000; expire=1800000000'
    await new Promise((r) => setTimeout(r, 2))

    const refreshed = await store.refresh('id1')
    // Same id — NO orphan/new profile.
    expect(refreshed.id).toBe('id1')
    expect((await store.list()).map((m) => m.id)).toEqual(['id1'])
    // Re-fetched with the stored userAgent (clash.meta).
    expect(seenUAs).toEqual(['clash.meta', 'clash.meta'])
    // Content overwritten in the SAME file.
    expect(await store.read('id1')).toBe('proxies: [second]\n')
    expect(readFileSync(join(dir, 'id1.yaml'), 'utf8')).toBe(
      'proxies: [second]\n',
    )
    // subscriptionInfo + updatedAt refreshed.
    expect(refreshed.subscriptionInfo).toEqual({
      upload: 500,
      download: 600,
      total: 2000,
      expire: 1800000000,
    })
    expect(refreshed.updatedAt).toBeGreaterThan(imported.updatedAt)
    expect(refreshed.type).toBe('remote')
    expect(refreshed.url).toBe('https://sub.example/clash')
  })

  it('refresh uses a custom stored userAgent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-ref-ua-'))
    let seenUA: string | null = null
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      seenUA = new Headers(init?.headers).get('user-agent')
      return new Response('proxies: []\n', { status: 200 })
    }) as unknown as typeof fetch
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
      fetch: fakeFetch,
      idGen: () => 'id1',
    })
    await store.importFromUrl('https://sub.example/clash')
    // Simulate a stored custom UA by writing the index with userAgent set.
    const indexPath = join(dir, 'index.json')
    const list = JSON.parse(readFileSync(indexPath, 'utf8')) as Array<{
      userAgent?: string
    }>
    list[0]!.userAgent = 'custom-agent/1.0'
    writeFileSync(indexPath, `${JSON.stringify(list, null, 2)}\n`)

    await store.refresh('id1')
    expect(seenUA).toBe('custom-agent/1.0')
  })

  it('refresh throws for a local profile (no url)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-ref-local-'))
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
      idGen: () => 'id1',
    })
    await store.create({ name: 'home', content: 'a: 1\n' })
    await expect(store.refresh('id1')).rejects.toThrow(/remote|url/i)
  })

  it('refresh throws on non-200', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-ref-err-'))
    let first = true
    const fakeFetch = (async () => {
      if (first) {
        first = false
        return new Response('proxies: []\n', { status: 200 })
      }
      return new Response('nope', { status: 403 })
    }) as unknown as typeof fetch
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
      fetch: fakeFetch,
      idGen: () => 'id1',
    })
    await store.importFromUrl('https://sub.example/clash')
    await expect(store.refresh('id1')).rejects.toThrow(/403/)
  })

  it('refresh throws for a missing id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mcxd-profiles-ref-missing-'))
    const store = createProfileStore({
      dir,
      activeConfigPath: join(dir, '..', 'active.yaml'),
    })
    await expect(store.refresh('nope')).rejects.toThrow(/not found/i)
  })
})

describe('createProfileStore — config sections', () => {
  let dir: string
  let activeConfigPath: string
  let store: ProfileStore
  let n: number

  beforeEach(() => {
    dir = tmpDir()
    activeConfigPath = join(dir, 'active', 'config.yaml')
    n = 0
    store = createProfileStore({
      dir,
      activeConfigPath,
      idGen: () => `id${++n}`,
    })
  })

  const sample =
    'mixed-port: 7890\nmode: rule\nrules:\n  - MATCH,DIRECT\ndns:\n  enable: true\n  nameserver:\n    - 1.1.1.1\n'

  it('getSection returns the parsed value for a present top-level key', async () => {
    await store.create({ name: 'home', content: sample })
    expect(await store.getSection('id1', 'rules')).toEqual(['MATCH,DIRECT'])
    expect(await store.getSection('id1', 'dns')).toEqual({
      enable: true,
      nameserver: ['1.1.1.1'],
    })
    expect(await store.getSection('id1', 'mode')).toBe('rule')
  })

  it('getSection returns null for an absent key', async () => {
    await store.create({ name: 'home', content: sample })
    expect(await store.getSection('id1', 'proxies')).toBeNull()
  })

  it('getSection returns null when the profile content is empty / not a mapping', async () => {
    await store.create({ name: 'blank', content: '' })
    expect(await store.getSection('id1', 'rules')).toBeNull()
  })

  it('setSection replaces only the target key and preserves the rest', async () => {
    await store.create({ name: 'home', content: sample })
    await store.setSection('id1', 'rules', ['MATCH,REJECT', 'MATCH,DIRECT'])
    const after = parse(await store.read('id1')) as Record<string, unknown>
    expect(after.rules).toEqual(['MATCH,REJECT', 'MATCH,DIRECT'])
    // Everything else preserved.
    expect(after['mixed-port']).toBe(7890)
    expect(after.mode).toBe('rule')
    expect(after.dns).toEqual({ enable: true, nameserver: ['1.1.1.1'] })
  })

  it('setSection adds a new top-level key when absent', async () => {
    await store.create({ name: 'home', content: sample })
    await store.setSection('id1', 'proxies', [{ name: 'a', type: 'http' }])
    const after = parse(await store.read('id1')) as Record<string, unknown>
    expect(after.proxies).toEqual([{ name: 'a', type: 'http' }])
    expect(after.mode).toBe('rule')
  })

  it('setSection with a null value deletes the key', async () => {
    await store.create({ name: 'home', content: sample })
    await store.setSection('id1', 'dns', null)
    const after = parse(await store.read('id1')) as Record<string, unknown>
    expect('dns' in after).toBe(false)
    expect(after.mode).toBe('rule')
  })

  it('setSection with an undefined value deletes the key', async () => {
    await store.create({ name: 'home', content: sample })
    await store.setSection('id1', 'mode', undefined)
    const after = parse(await store.read('id1')) as Record<string, unknown>
    expect('mode' in after).toBe(false)
    expect(after['mixed-port']).toBe(7890)
  })

  it('setSection on empty content seeds a mapping with just the key', async () => {
    await store.create({ name: 'blank', content: '' })
    await store.setSection('id1', 'mode', 'global')
    const after = parse(await store.read('id1')) as Record<string, unknown>
    expect(after).toEqual({ mode: 'global' })
  })
})
