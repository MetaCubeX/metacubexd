import type { ScriptRunner } from './script'
import type { ProfileMeta, ProfileStore } from './types'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { isPlainObject, mergeConfigs } from './merge'

export interface ProfileStoreOptions {
  dir: string
  activeConfigPath: string
  fetch?: typeof fetch
  // Bounds subscription import/refresh network I/O; default 30_000.
  subscriptionTimeoutMs?: number
  idGen?: () => string
  // Runs enabled 'script' profiles during setActive. Injected so tests use a
  // fake (no real worker). Absent runner => script profiles are skipped.
  scriptRunner?: ScriptRunner
}

interface StateFile {
  activeId?: string
}

/** Known HTTP failure returned by a remote subscription provider. */
export class SubscriptionFetchError extends Error {
  constructor(readonly upstreamStatus: number) {
    super(`subscription provider returned HTTP ${upstreamStatus}`)
    this.name = 'SubscriptionFetchError'
  }
}

export function createProfileStore(opts: ProfileStoreOptions): ProfileStore {
  const { dir, activeConfigPath, scriptRunner } = opts
  const doFetch = opts.fetch ?? fetch
  const subscriptionTimeoutMs = opts.subscriptionTimeoutMs ?? 30_000
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
    const signal = AbortSignal.timeout(subscriptionTimeoutMs)
    try {
      const res = await doFetch(url, {
        headers: { 'User-Agent': userAgent },
        signal,
      })
      if (!res.ok) {
        // Keep the provider status without echoing a potentially credentialed
        // subscription URL into logs or API responses (#2138).
        throw new SubscriptionFetchError(res.status)
      }
      const content = await res.text()
      const subscriptionInfo = parseSubscriptionUserinfo(
        res.headers.get('subscription-userinfo'),
      )
      return { content, subscriptionInfo }
    } catch (err) {
      if (signal.aborted) {
        throw new Error(
          `subscription fetch timed out after ${subscriptionTimeoutMs}ms for ${url}`,
        )
      }
      throw err
    }
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
      // 0 is meaningful (disables auto-update) so distinguish it from omitted.
      if (p.updateInterval != null) meta.updateInterval = p.updateInterval
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
      if (base.type === 'merge' || base.type === 'script') {
        throw new Error(
          `setActive: profile ${id} is a ${base.type} overlay and cannot be the active base`,
        )
      }
      const baseContent = await readFile(profilePath(id), 'utf8')
      const index = await readIndex()
      // Collect enabled merge overlays in index order (undefined enabled == on).
      const overlays: string[] = []
      // Collect enabled script profiles in index order (undefined enabled == on).
      // A runner is required to apply them; without one, scripts are skipped.
      const scripts: string[] = []
      for (const meta of index) {
        if (meta.enabled === false) continue
        if (meta.type === 'merge') {
          overlays.push(await readFile(profilePath(meta.id), 'utf8'))
        } else if (meta.type === 'script' && scriptRunner) {
          scripts.push(await readFile(profilePath(meta.id), 'utf8'))
        }
      }
      // Compose pipeline: base -> merge overlays -> script transforms.
      // No overlays AND no scripts -> write the base verbatim (preserve
      // formatting byte-for-byte).
      let content = overlays.length
        ? mergeConfigs(baseContent, overlays)
        : baseContent
      if (scripts.length && scriptRunner) {
        let obj = parse(content) as unknown
        for (const code of scripts) {
          obj = await scriptRunner.run(code, obj)
        }
        content = stringify(obj)
      }
      await mkdir(join(activeConfigPath, '..'), { recursive: true })
      // Snapshot the previous active config so /kernel/rollback can restore it
      // when the new config bricks the kernel. The supervisor has not injected
      // its header into the in-memory `content` yet, but rollback feeds the file
      // straight back into restart() which re-injects — so the header round-trips.
      if (existsSync(activeConfigPath)) {
        await copyFile(activeConfigPath, `${activeConfigPath}.bak`)
      }
      await writeFile(activeConfigPath, content)
      await writeState({ activeId: id })
    },

    async rollback() {
      const bak = `${activeConfigPath}.bak`
      if (!existsSync(bak)) return false
      await mkdir(join(activeConfigPath, '..'), { recursive: true })
      await copyFile(bak, activeConfigPath)
      return true
    },

    async resetActive() {
      await mkdir(join(activeConfigPath, '..'), { recursive: true })
      // Keep the broken config aside (same .bak channel) so an operator can still
      // inspect it on the volume after a reset-to-minimal recovery.
      if (existsSync(activeConfigPath)) {
        await copyFile(activeConfigPath, `${activeConfigPath}.bak`)
      }
      // Empty body => the supervisor's injectClashConfig writes just its managed
      // header (external-controller/secret/mixed-port) and mihomo runs on its
      // defaults — enough for the dashboard to reconnect and re-import a profile.
      await writeFile(activeConfigPath, '')
      await writeState({})
    },

    async getSection(id, key) {
      await findMeta(id)
      const parsed = parse(await readFile(profilePath(id), 'utf8')) as unknown
      if (!isPlainObject(parsed)) return null
      const value = parsed[key]
      return value === undefined ? null : value
    },

    async setSection(id, key, value) {
      await findMeta(id)
      const parsed = parse(await readFile(profilePath(id), 'utf8')) as unknown
      // Empty / non-mapping content seeds a fresh top-level mapping.
      const doc: Record<string, unknown> = isPlainObject(parsed) ? parsed : {}
      if (value == null) {
        delete doc[key]
      } else {
        doc[key] = value
      }
      await store.update(id, { content: stringify(doc) })
    },
  }

  return store
}
