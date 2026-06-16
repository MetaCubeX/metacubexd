import type { App, H3Event } from 'h3'
import type {
  KernelLogLine,
  KernelManager,
  KernelState,
  MihomoSupervisor,
  ProfileStore,
  SystemProxyController,
  TunController,
} from './types'
import { readFile as defaultReadFile, rm, writeFile } from 'node:fs/promises'
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
import { fetchGeoAssets } from './kernel/geo'
import { createWebdavClient as defaultCreateWebdavClient } from './webdav'

const BACKUP_FILENAME = 'metacubexd-backup.json'

interface WebdavCredentials {
  url: string
  username: string
  password: string
  dir?: string
}

export interface ControlRouterDeps {
  supervisor: MihomoSupervisor
  profiles: ProfileStore
  info: () => unknown
  homeDir: string // writable dir for materializing validate candidate files
  activeConfigPath: string // file the kernel runs with -f (supervisor-injected at spawn)
  token?: string
  systemProxy?: SystemProxyController // OS proxy controller; capability-gated
  kernelManager?: KernelManager // kernel version mgmt; capability-gated
  tunController?: TunController // TUN mode controller; capability-gated
  geoFetch?: typeof fetch // override for tests; defaults to global fetch
  createWebdavClient?: typeof defaultCreateWebdavClient // override for tests
  readFile?: typeof defaultReadFile // override for tests; defaults to fs/promises readFile
}

const PREFIX = '/api/control'

export function createControlRouter(deps: ControlRouterDeps): App {
  const app = createApp()
  const router = createRouter()
  const {
    supervisor,
    profiles,
    info,
    homeDir,
    activeConfigPath,
    token,
    systemProxy,
    kernelManager,
    tunController,
    geoFetch,
    createWebdavClient = defaultCreateWebdavClient,
    readFile = defaultReadFile,
  } = deps

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
      const path = (event.path ?? '').split('?')[0] ?? ''
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
      // Detach on disconnect. Without this, every EventSource reconnect
      // (navigation, kernel restart, network blip, HMR) permanently adds two
      // more closures to the supervisor's callback sets — an unbounded leak on
      // the hottest path, fanning push() out to long-dead streams forever.
      stream.onClosed(() => {
        supervisor.off('log', onLog)
        supervisor.off('state', onState)
      })
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
      const body = (await readBody(event)) as {
        name: string
        content?: string
        type?: 'local' | 'merge' | 'script'
      }
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
        enabled?: boolean
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
    `${PREFIX}/profiles/:id/refresh`,
    defineEventHandler(async (event) => {
      const id = getRouterParam(event, 'id')!
      return profiles.refresh(id)
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

  // ---- Runtime config (read-only) ----
  // Returns the actual file the kernel runs with -f. At runtime this holds the
  // supervisor-injected external-controller/secret/mixed-port, so it differs from
  // the active profile source served by GET /config. Missing file -> ''.
  router.get(
    `${PREFIX}/config/runtime`,
    defineEventHandler(async (event) => {
      setResponseHeader(event, 'content-type', 'text/yaml')
      try {
        return await readFile(activeConfigPath, 'utf8')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
        throw err
      }
    }),
  )

  // ---- Config sections (top-level key read/write on the active profile) ----
  // GET reads one parsed section (null when absent / no active profile). PUT
  // replaces that section on the active profile content, then re-activates
  // (re-composes + writes activeConfigPath) and restarts the kernel.
  router.get(
    `${PREFIX}/config/section`,
    defineEventHandler(async (event) => {
      const key = String(getQuery(event).key ?? '')
      const activeId = await profiles.getActiveId()
      const value = activeId ? await profiles.getSection(activeId, key) : null
      // Serialize explicitly so an absent section / no-active-profile still
      // yields a JSON `null` body (h3 would 204 a bare null return).
      setResponseHeader(event, 'content-type', 'application/json')
      return JSON.stringify(value ?? null)
    }),
  )
  router.put(
    `${PREFIX}/config/section`,
    defineEventHandler(async (event) => {
      const activeId = await profiles.getActiveId()
      if (!activeId) {
        setResponseStatus(event, 409)
        return { error: 'no active profile' }
      }
      const body = (await readBody(event)) as { key: string; value: unknown }
      await profiles.setSection(activeId, body.key, body.value)
      await profiles.setActive(activeId)
      return supervisor.restart()
    }),
  )

  // ---- Geo assets (always available — backed by homeDir + fetch) ----
  router.post(
    `${PREFIX}/geo/update`,
    defineEventHandler(async () => {
      const { files } = await fetchGeoAssets(homeDir, { fetch: geoFetch })
      return { ok: true, files }
    }),
  )

  // ---- WebDAV backup / restore (always available — credentials per-request) ----
  function backupPath(dir?: string): string {
    return dir
      ? `${dir.replace(/\/+$/, '')}/${BACKUP_FILENAME}`
      : BACKUP_FILENAME
  }

  router.post(
    `${PREFIX}/backup`,
    defineEventHandler(async (event) => {
      const body = (await readBody(event)) as {
        webdav: WebdavCredentials
        uiSettings?: unknown
      }
      const { webdav } = body
      const client = createWebdavClient({
        url: webdav.url,
        username: webdav.username,
        password: webdav.password,
      })
      // Build a bundle of every profile (meta + raw content).
      const metas = await profiles.list()
      const bundleProfiles = await Promise.all(
        metas.map(async (meta) => ({
          meta,
          content: await profiles.read(meta.id),
        })),
      )
      const bundle = {
        version: 1 as const,
        profiles: bundleProfiles,
        ...(body.uiSettings !== undefined
          ? { uiSettings: body.uiSettings }
          : {}),
      }
      // Best-effort directory creation — ignore "already exists" / transient errors
      // so an existing collection doesn't fail the upload.
      if (webdav.dir) {
        await client.mkcol(webdav.dir).catch(() => {})
      }
      const path = backupPath(webdav.dir)
      await client.put(path, JSON.stringify(bundle))
      return { ok: true, path }
    }),
  )

  router.post(
    `${PREFIX}/restore`,
    defineEventHandler(async (event) => {
      const body = (await readBody(event)) as { webdav: WebdavCredentials }
      const { webdav } = body
      const client = createWebdavClient({
        url: webdav.url,
        username: webdav.username,
        password: webdav.password,
      })
      const raw = await client.get(backupPath(webdav.dir))
      const bundle = JSON.parse(raw) as {
        version: number
        profiles: Array<{
          meta: { name: string; type?: string }
          content: string
        }>
        uiSettings?: unknown
      }
      // Recreate via profiles.create so each restored profile gets a fresh id
      // (avoids clashing with any existing local ids).
      let restored = 0
      for (const p of bundle.profiles ?? []) {
        // Preserve composition types (merge/script) so restored overlays/scripts
        // still apply; 'remote' is intentionally restored as 'local' (keep the
        // captured content, no network re-fetch).
        const type =
          p.meta.type === 'merge' || p.meta.type === 'script'
            ? p.meta.type
            : 'local'
        await profiles.create({ name: p.meta.name, content: p.content, type })
        restored += 1
      }
      return { ok: true, restored, uiSettings: bundle.uiSettings }
    }),
  )

  // ---- System proxy (capability-gated) ----
  if (systemProxy) {
    router.get(
      `${PREFIX}/sysproxy`,
      defineEventHandler(async () => ({
        enabled: await systemProxy.isEnabled(),
        ...systemProxy.describe(),
      })),
    )
    router.post(
      `${PREFIX}/sysproxy`,
      defineEventHandler(async (event) => {
        const body = (await readBody(event)) as {
          enabled: boolean
          bypass?: string[]
          // 'fixed' (default) = manual host:port proxy; 'pac' = auto-config URL.
          mode?: 'fixed' | 'pac'
          pacUrl?: string
        }
        if (body.mode === 'pac') {
          if (body.enabled) {
            if (!body.pacUrl) {
              setResponseStatus(event, 400)
              return { error: 'pacUrl required for pac mode' }
            }
            await systemProxy.setAutoProxy(body.pacUrl)
          } else {
            await systemProxy.disableAutoProxy()
          }
        } else if (body.enabled) {
          await systemProxy.enable(body.bypass)
        } else {
          await systemProxy.disable()
        }
        return {
          enabled: await systemProxy.isEnabled(),
          ...systemProxy.describe(),
        }
      }),
    )
  } else {
    // No controller injected — respond with a clean 404 JSON for both verbs so the
    // shared UI can detect the missing capability without a router-default 404 shape.
    const unavailable = defineEventHandler((event) => {
      setResponseStatus(event, 404)
      return { error: 'system-proxy unavailable' }
    })
    router.get(`${PREFIX}/sysproxy`, unavailable)
    router.post(`${PREFIX}/sysproxy`, unavailable)
  }

  // ---- Kernel version management (capability-gated) ----
  if (kernelManager) {
    router.get(
      `${PREFIX}/kernel/versions`,
      defineEventHandler(() => kernelManager.listVersions()),
    )
    router.post(
      `${PREFIX}/kernel/switch`,
      defineEventHandler(async (event) => {
        const body = (await readBody(event)) as { version: string }
        await kernelManager.switch(body.version)
        return { ok: true }
      }),
    )
  } else {
    // No manager injected — clean 404 JSON for both routes so the shared UI can
    // detect the missing capability without a router-default 404 shape.
    const unavailable = defineEventHandler((event) => {
      setResponseStatus(event, 404)
      return { error: 'kernel-version unavailable' }
    })
    router.get(`${PREFIX}/kernel/versions`, unavailable)
    router.post(`${PREFIX}/kernel/switch`, unavailable)
  }

  // ---- TUN mode (capability-gated) ----
  // Clean 404 JSON so the shared UI can detect a missing capability/route without
  // a router-default 404 shape (used for an absent controller AND for an
  // uninstall route the controller doesn't support).
  const tunUnavailable = defineEventHandler((event) => {
    setResponseStatus(event, 404)
    return { error: 'tun unavailable' }
  })
  if (tunController) {
    const { uninstall } = tunController
    router.get(
      `${PREFIX}/tun`,
      defineEventHandler(() => tunController.status()),
    )
    router.post(
      `${PREFIX}/tun`,
      defineEventHandler(async (event) => {
        const body = (await readBody(event)) as {
          enabled: boolean
          stack?: string
        }
        if (body.enabled) {
          await tunController.enable({ stack: body.stack ?? '' })
        } else {
          await tunController.disable()
        }
        return tunController.status()
      }),
    )
    // Remove the privileged helper service entirely. Only registered when the
    // controller supports it (desktop wires installer.uninstall); otherwise the
    // route 404s so the UI can hide the action.
    router.post(
      `${PREFIX}/tun/uninstall`,
      uninstall
        ? defineEventHandler(async () => {
            await uninstall()
            return tunController.status()
          })
        : tunUnavailable,
    )
  } else {
    router.get(`${PREFIX}/tun`, tunUnavailable)
    router.post(`${PREFIX}/tun`, tunUnavailable)
    router.post(`${PREFIX}/tun/uninstall`, tunUnavailable)
  }

  app.use(router)
  return app
}
