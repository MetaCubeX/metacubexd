import type { ProfileMeta, ProfileStore } from './types'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mergeConfigs } from './merge'

export interface ProfileStoreOptions {
  dir: string
  activeConfigPath: string
  fetch?: typeof fetch
  idGen?: () => string
}

interface StateFile {
  activeId?: string
}

export function createProfileStore(opts: ProfileStoreOptions): ProfileStore {
  const { dir, activeConfigPath } = opts
  const doFetch = opts.fetch ?? fetch
  const idGen = opts.idGen ?? (() => randomUUID())
  const indexPath = join(dir, 'index.json')
  const statePath = join(dir, 'state.json')
  const profilePath = (id: string) => join(dir, `${id}.yaml`)

  async function ensureDir(): Promise<void> {
    await mkdir(dir, { recursive: true })
  }

  async function readIndex(): Promise<ProfileMeta[]> {
    if (!existsSync(indexPath)) return []
    return JSON.parse(await readFile(indexPath, 'utf8')) as ProfileMeta[]
  }

  async function writeIndex(list: ProfileMeta[]): Promise<void> {
    await ensureDir()
    await writeFile(indexPath, `${JSON.stringify(list, null, 2)}\n`)
  }

  async function readState(): Promise<StateFile> {
    if (!existsSync(statePath)) return {}
    return JSON.parse(await readFile(statePath, 'utf8')) as StateFile
  }

  async function writeState(s: StateFile): Promise<void> {
    await ensureDir()
    await writeFile(statePath, `${JSON.stringify(s, null, 2)}\n`)
  }

  async function findMeta(id: string): Promise<ProfileMeta> {
    const meta = (await readIndex()).find((m) => m.id === id)
    if (!meta) throw new Error(`profile not found: ${id}`)
    return meta
  }

  function parseSubscriptionUserinfo(
    header: string | null,
  ): ProfileMeta['subscriptionInfo'] | undefined {
    if (!header) return undefined
    const out: Record<string, number> = {}
    for (const part of header.split(';')) {
      const [k, v] = part.split('=').map((s) => s.trim())
      if (k && v != null && !Number.isNaN(Number(v))) out[k] = Number(v)
    }
    if (!('upload' in out) && !('download' in out) && !('total' in out)) {
      return undefined
    }
    return {
      upload: out.upload ?? 0,
      download: out.download ?? 0,
      total: out.total ?? 0,
      expire: out.expire ?? 0,
    }
  }

  // Shared fetch+parse used by both importFromUrl (mints a new id) and
  // refresh (overwrites an existing id) so the two stay DRY.
  async function fetchSubscription(
    url: string,
    userAgent: string,
  ): Promise<{
    content: string
    subscriptionInfo: ProfileMeta['subscriptionInfo'] | undefined
  }> {
    const res = await doFetch(url, { headers: { 'User-Agent': userAgent } })
    if (!res.ok) {
      throw new Error(`fetch failed ${res.status} for ${url}`)
    }
    const content = await res.text()
    const subscriptionInfo = parseSubscriptionUserinfo(
      res.headers.get('subscription-userinfo'),
    )
    return { content, subscriptionInfo }
  }

  const store: ProfileStore = {
    async list() {
      return readIndex()
    },

    async read(id) {
      await findMeta(id)
      return readFile(profilePath(id), 'utf8')
    },

    async create(i) {
      await ensureDir()
      const id = idGen()
      const meta: ProfileMeta = {
        id,
        name: i.name,
        type: i.type ?? 'local',
        updatedAt: Date.now(),
      }
      await writeFile(profilePath(id), i.content ?? '')
      await writeIndex([...(await readIndex()), meta])
      return meta
    },

    async update(id, p) {
      const list = await readIndex()
      const meta = list.find((m) => m.id === id)
      if (!meta) throw new Error(`profile not found: ${id}`)
      if (p.content != null) await writeFile(profilePath(id), p.content)
      if (p.name != null) meta.name = p.name
      if (p.enabled != null) meta.enabled = p.enabled
      meta.updatedAt = Date.now()
      await writeIndex(list)
      return meta
    },

    async delete(id) {
      await findMeta(id)
      await rm(profilePath(id), { force: true })
      await writeIndex((await readIndex()).filter((m) => m.id !== id))
      const state = await readState()
      if (state.activeId === id) {
        delete state.activeId
        await writeState(state)
      }
    },

    async duplicate(id, name) {
      const src = await findMeta(id)
      const content = await readFile(profilePath(id), 'utf8')
      const newId = idGen()
      const meta: ProfileMeta = {
        id: newId,
        name: name ?? `${src.name} copy`,
        type: 'local',
        updatedAt: Date.now(),
      }
      await writeFile(profilePath(newId), content)
      await writeIndex([...(await readIndex()), meta])
      return meta
    },

    async importFromUrl(url, name) {
      await ensureDir()
      const userAgent = 'clash.meta'
      const { content, subscriptionInfo } = await fetchSubscription(
        url,
        userAgent,
      )
      const id = idGen()
      const meta: ProfileMeta = {
        id,
        name: name ?? url,
        type: 'remote',
        url,
        userAgent,
        updatedAt: Date.now(),
        ...(subscriptionInfo ? { subscriptionInfo } : {}),
      }
      await writeFile(profilePath(id), content)
      await writeIndex([...(await readIndex()), meta])
      return meta
    },

    async refresh(id) {
      const list = await readIndex()
      const meta = list.find((m) => m.id === id)
      if (!meta) throw new Error(`profile not found: ${id}`)
      if (meta.type !== 'remote' || !meta.url) {
        throw new Error(`refresh: profile ${id} is not a remote subscription`)
      }
      const userAgent = meta.userAgent ?? 'clash.meta'
      const { content, subscriptionInfo } = await fetchSubscription(
        meta.url,
        userAgent,
      )
      // Overwrite the SAME file in place — keep the same id (no orphan).
      await writeFile(profilePath(id), content)
      meta.updatedAt = Date.now()
      if (subscriptionInfo) meta.subscriptionInfo = subscriptionInfo
      await writeIndex(list)
      return meta
    },

    async getActiveId() {
      return (await readState()).activeId
    },

    async setActive(id) {
      const base = await findMeta(id)
      if (base.type === 'merge') {
        throw new Error(
          `setActive: profile ${id} is a merge overlay and cannot be the active base`,
        )
      }
      const baseContent = await readFile(profilePath(id), 'utf8')
      // Collect enabled merge overlays in index order (undefined enabled == on).
      const overlays: string[] = []
      for (const meta of await readIndex()) {
        if (meta.type === 'merge' && meta.enabled !== false) {
          overlays.push(await readFile(profilePath(meta.id), 'utf8'))
        }
      }
      // No overlays -> write the base verbatim (preserve formatting byte-for-byte).
      const content = overlays.length
        ? mergeConfigs(baseContent, overlays)
        : baseContent
      await mkdir(join(activeConfigPath, '..'), { recursive: true })
      await writeFile(activeConfigPath, content)
      await writeState({ activeId: id })
    },
  }

  return store
}
