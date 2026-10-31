import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Test the release artifact itself: a Nuxt preview server can hide broken
// prerendered HTML or absolute asset URLs that fail under Mihomo's /ui/xd/.
const publicDir = resolve(
  fileURLToPath(new URL('../.output/public/', import.meta.url)),
)
const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function checkHtml() {
  for (const filename of ['index.html', '200.html', '404.html']) {
    const html = await readFile(resolve(publicDir, filename), 'utf8')
    assert.match(html, /<!doctype html>/i, `${filename}: missing HTML document`)
    assert.match(
      html,
      /id=["']__nuxt["']/,
      `${filename}: missing Nuxt app shell`,
    )
    assert.match(
      html,
      /<script\b[^>]+\bsrc=["'][^"']*_nuxt\//i,
      `${filename}: missing app entry script`,
    )
    assert.doesNotMatch(html, /Redirecting\.\.\./, `${filename}: redirect body`)
  }
}

async function checkMount(basePath: string) {
  // Serve only this mount, so root-level asset requests cannot accidentally
  // make a broken subdirectory deployment pass. Missing files stay 404.
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(
        new URL(request.url || '/', 'http://localhost').pathname,
      )
      const relativePath = pathname.slice(basePath.length) || 'index.html'
      const filename = resolve(publicDir, relativePath)
      if (
        !pathname.startsWith(basePath) ||
        !filename.startsWith(`${publicDir}${sep}`)
      ) {
        response.writeHead(404).end()
        return
      }
      const content = await readFile(filename)
      response.writeHead(200, {
        'content-type':
          mimeTypes[extname(filename)] || 'application/octet-stream',
        'cache-control': 'no-store',
      })
      response.end(content)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    const address = server.address()
    assert(address && typeof address !== 'string')
    const origin = `http://127.0.0.1:${address.port}`
    const isBackendProbe = (url: string) => {
      const pathname = new URL(url).pathname
      const path = pathname.startsWith(basePath)
        ? `/${pathname.slice(basePath.length)}`
        : pathname
      return ['/api/control/info', '/configs', '/version'].includes(path)
    }
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      locale: 'en-US',
      serviceWorkers: 'block',
    })
    // The first-run form may probe the default backend. Keep the release
    // smoke test independent of network access and any local Mihomo instance.
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (isBackendProbe(url)) {
        return route.fulfill({ status: 503, body: 'No backend in static test' })
      }
      return new URL(url).origin === origin ? route.continue() : route.abort()
    })
    const page = await context.newPage()
    const failures: string[] = []
    const loadedAssets = new Set<string>()
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      if (
        new URL(response.url()).origin !== origin ||
        isBackendProbe(response.url())
      )
        return
      if (response.status() >= 400) {
        failures.push(`${response.status()} ${response.url()}`)
      } else {
        loadedAssets.add(response.request().resourceType())
      }
    })
    page.on('requestfailed', (request) => {
      if (new URL(request.url()).origin === origin) {
        failures.push(`${request.failure()?.errorText} ${request.url()}`)
      }
    })

    const response = await page.goto(`${origin}${basePath}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    assert.equal(response?.status(), 200)
    await page
      .getByRole('heading', { name: 'MetaCubeXD', exact: true })
      .waitFor()
    await page.locator('#url').waitFor({ state: 'visible' })
    await page.locator('#secret').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Connect', exact: true }).waitFor()
    assert.equal(new URL(page.url()).pathname, basePath)
    assert(loadedAssets.has('script'), 'No app scripts loaded')
    assert(loadedAssets.has('stylesheet'), 'No app styles loaded')
    assert.deepEqual(failures, [], `Static app failed under ${basePath}`)
    console.log(`Static release verified at ${basePath}`)
  } finally {
    try {
      await browser?.close()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    }
  }
}

await checkHtml()
for (const basePath of ['/', '/ui/xd/']) await checkMount(basePath)
