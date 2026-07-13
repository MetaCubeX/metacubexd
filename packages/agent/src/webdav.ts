import { Buffer } from 'node:buffer'

export interface WebdavClientOptions {
  url: string // base WebDAV URL (e.g. https://host/remote.php/dav/)
  username: string
  password: string
  fetch?: typeof fetch // injectable for tests; defaults to global fetch
}

export interface WebdavClient {
  put: (path: string, body: string) => Promise<void>
  get: (path: string) => Promise<string>
  mkcol: (dir: string) => Promise<void> // tolerates "already exists" (405/301)
}

/**
 * Join a base URL and a relative path with exactly one slash between them,
 * regardless of trailing/leading slashes on either side.
 */
function joinUrl(base: string, path: string): string {
  let baseEnd = base.length
  while (baseEnd > 0 && base[baseEnd - 1] === '/') baseEnd--
  let pathStart = 0
  while (path[pathStart] === '/') pathStart++
  return `${base.slice(0, baseEnd)}/${path.slice(pathStart)}`
}

/**
 * Minimal hand-rolled WebDAV client over fetch. Supports the three verbs the
 * backup/restore flow needs: PUT (upload), GET (download), MKCOL (create dir).
 * Credentials are sent via HTTP Basic auth on every request. `fetch` is
 * injectable so tests never hit the network.
 */
export function createWebdavClient(opts: WebdavClientOptions): WebdavClient {
  const doFetch = opts.fetch ?? fetch
  const authorization = `Basic ${Buffer.from(
    `${opts.username}:${opts.password}`,
  ).toString('base64')}`

  async function request(
    method: string,
    path: string,
    body?: string,
  ): Promise<Response> {
    return doFetch(joinUrl(opts.url, path), {
      method,
      headers: { authorization },
      ...(body != null ? { body } : {}),
    })
  }

  return {
    async put(path, body) {
      const res = await request('PUT', path, body)
      if (!res.ok) {
        throw new Error(
          `webdav PUT failed ${res.status} ${res.statusText} for ${path}`,
        )
      }
    },

    async get(path) {
      const res = await request('GET', path)
      if (!res.ok) {
        throw new Error(
          `webdav GET failed ${res.status} ${res.statusText} for ${path}`,
        )
      }
      return res.text()
    },

    async mkcol(dir) {
      const res = await request('MKCOL', dir)
      // 405 (Method Not Allowed) and 301 (Moved Permanently) are the typical
      // responses when the collection already exists — treat those as success.
      if (res.ok || res.status === 405 || res.status === 301) return
      throw new Error(
        `webdav MKCOL failed ${res.status} ${res.statusText} for ${dir}`,
      )
    },
  }
}
