import { createServer } from 'node:http'
import { createApp, toNodeListener } from 'h3'
import { afterEach, describe, expect, it } from 'vitest'

// Spin the dynamic /config.js handler on an ephemeral port and fetch it. The
// handler reads CONTROL_TOKEN via serverEnv() at request time, so toggling the
// env between cases works without re-importing.
async function start() {
  const handler = (await import('../config.js')).default
  const app = createApp()
  app.use(handler)
  const server = createServer(toNodeListener(app))
  await new Promise<void>((r) => server.listen(0, () => r()))
  const addr = server.address()
  const base = `http://127.0.0.1:${
    typeof addr === 'object' && addr ? addr.port : 0
  }`
  return { server, base }
}

describe('apps/server routes/config.js -> control token injection (#2074)', () => {
  const original = process.env.CONTROL_TOKEN
  const originalGithubToken = process.env.GITHUB_TOKEN
  afterEach(() => {
    if (original === undefined) delete process.env.CONTROL_TOKEN
    else process.env.CONTROL_TOKEN = original
    if (originalGithubToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = originalGithubToken
  })

  it('injects CONTROL_TOKEN into window.__METACUBEXD_CONFIG__ as no-store JS', async () => {
    process.env.CONTROL_TOKEN = 'super-secret'
    const { server, base } = await start()
    try {
      const res = await fetch(`${base}/config.js`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('javascript')
      expect(res.headers.get('cache-control')).toContain('no-store')
      const body = await res.text()
      expect(body).toContain('window.__METACUBEXD_CONFIG__')
      expect(body).toContain('"controlToken":"super-secret"')
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('omits controlToken when CONTROL_TOKEN is unset', async () => {
    delete process.env.CONTROL_TOKEN
    const { server, base } = await start()
    try {
      const body = await (await fetch(`${base}/config.js`)).text()
      expect(body).toContain('window.__METACUBEXD_CONFIG__')
      expect(body).not.toContain('controlToken')
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('injects an optional GitHub Releases token into the runtime UI config (#2135)', async () => {
    process.env.GITHUB_TOKEN = 'github-token'
    const { server, base } = await start()
    try {
      const body = await (await fetch(`${base}/config.js`)).text()
      expect(body).toContain('"githubToken":"github-token"')
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('omits githubToken when GITHUB_TOKEN is unset', async () => {
    delete process.env.GITHUB_TOKEN
    const { server, base } = await start()
    try {
      const body = await (await fetch(`${base}/config.js`)).text()
      expect(body).not.toContain('githubToken')
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })
})
