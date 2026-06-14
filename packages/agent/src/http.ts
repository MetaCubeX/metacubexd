import type { App, H3Event } from 'h3'
import type {
  KernelLogLine,
  KernelState,
  MihomoSupervisor,
  ProfileStore,
} from './types'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  createApp,
  createEventStream,
  createRouter,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  readBody,
  sendNoContent,
  setResponseHeader,
  setResponseStatus,
} from 'h3'

export interface ControlRouterDeps {
  supervisor: MihomoSupervisor
  profiles: ProfileStore
  info: () => unknown
  homeDir: string // writable dir for materializing validate candidate files
  token?: string
}

const PREFIX = '/api/control'

export function createControlRouter(deps: ControlRouterDeps): App {
  const app = createApp()
  const router = createRouter()
  const { supervisor, profiles, info, homeDir, token } = deps

  // ---- Auth middleware: applied to every route except public ones. ----
  function isPublic(path: string): boolean {
    return path === `${PREFIX}/health` || path === `${PREFIX}/info`
  }

  function authorized(event: H3Event): boolean {
    if (!token) return true // in-process (Electron) — no network surface
    const header = getHeader(event, 'authorization')
    if (header === `Bearer ${token}`) return true
    const q = getQuery(event)
    if (q.token === token) return true // SSE may pass ?token=
    return false
  }

  app.use(
    defineEventHandler((event) => {
      const path = (event.path ?? '').split('?')[0]
      if (!path.startsWith(PREFIX)) return
      if (isPublic(path)) return
      if (!authorized(event)) {
        setResponseStatus(event, 401)
        return { error: 'unauthorized' }
      }
    }),
  )

  // ---- Health + info ----
  router.get(
    `${PREFIX}/health`,
    defineEventHandler(() => ({ ok: true })),
  )
  router.get(
    `${PREFIX}/info`,
    defineEventHandler(() => info()),
  )

  // ---- Kernel ----
  router.get(
    `${PREFIX}/kernel/status`,
    defineEventHandler((): KernelState => supervisor.getState()),
  )
  router.post(
    `${PREFIX}/kernel/start`,
    defineEventHandler(() => supervisor.start()),
  )
  router.post(
    `${PREFIX}/kernel/stop`,
    defineEventHandler(() => supervisor.stop()),
  )
  router.post(
    `${PREFIX}/kernel/restart`,
    defineEventHandler(() => supervisor.restart()),
  )

  // ---- Kernel logs (SSE) ----
  router.get(
    `${PREFIX}/kernel/logs`,
    defineEventHandler((event) => {
      const stream = createEventStream(event)
      const onLog = (l: KernelLogLine) =>
        stream.push(JSON.stringify({ type: 'log', ...l }))
      const onState = (s: KernelState) =>
        stream.push(JSON.stringify({ type: 'state', ...s }))
      supervisor.on('log', onLog)
      supervisor.on('state', onState)
      // Seed with current state so a late subscriber knows where things stand.
      stream.push(JSON.stringify({ type: 'state', ...supervisor.getState() }))
      return stream.send()
    }),
  )

  // ---- Profiles ----
  router.get(
    `${PREFIX}/profiles`,
    defineEventHandler(() => profiles.list()),
  )
  router.post(
    `${PREFIX}/profiles`,
    defineEventHandler(async (event) => {
      const body = (await readBody(event)) as { name: string; content?: string }
      return profiles.create(body)
    }),
  )
  router.get(
    `${PREFIX}/profiles/:id`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      const [meta, content] = await Promise.all([
        profiles.list().then((l) => l.find((m) => m.id === id)),
        profiles.read(id),
      ])
      return { meta, content }
    }),
  )
  router.put(
    `${PREFIX}/profiles/:id`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      const body = (await readBody(event)) as {
        name?: string
        content?: string
      }
      return profiles.update(id, body)
    }),
  )
  router.delete(
    `${PREFIX}/profiles/:id`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      await profiles.delete(id)
      return sendNoContent(event)
    }),
  )
  router.post(
    `${PREFIX}/profiles/:id/duplicate`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      const body = (await readBody(event).catch(() => ({}))) as {
        name?: string
      }
      return profiles.duplicate(id, body?.name)
    }),
  )
  router.post(
    `${PREFIX}/profiles/import`,
    defineEventHandler(async (event) => {
      const body = (await readBody(event)) as { url: string; name?: string }
      return profiles.importFromUrl(body.url, body.name)
    }),
  )
  router.post(
    `${PREFIX}/profiles/:id/activate`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      await profiles.setActive(id)
      return supervisor.restart()
    }),
  )
  router.post(
    `${PREFIX}/profiles/:id/validate`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      const content = await profiles.read(id)
      // Materialize a temp candidate file so `mihomo -t -f <path>` runs against a
      // real config (the route carries no body — the id is the source of truth).
      const candidate = join(homeDir, `.validate-${id}.yaml`)
      await writeFile(candidate, content)
      try {
        return await supervisor.validate(candidate)
      } finally {
        await rm(candidate, { force: true })
      }
    }),
  )

  // ---- Active config ----
  router.get(
    `${PREFIX}/config`,
    defineEventHandler(async (event) => {
      const activeId = await profiles.getActiveId()
      setResponseHeader(event, 'content-type', 'text/yaml')
      return activeId ? profiles.read(activeId) : ''
    }),
  )
  router.put(
    `${PREFIX}/config`,
    defineEventHandler(async (event) => {
      const activeId = await profiles.getActiveId()
      if (!activeId) {
        setResponseStatus(event, 409)
        return { error: 'no active profile' }
      }
      const body = (await readBody(event)) as { content: string }
      await profiles.update(activeId, { content: body.content })
      await profiles.setActive(activeId)
      return supervisor.restart()
    }),
  )

  app.use(router)
  return app
}
