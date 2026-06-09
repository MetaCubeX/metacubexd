import type { ChildProcess } from 'node:child_process'
import type { BrowserContext, Page } from 'playwright'
// Page-based e2e tests for metacubexd dashboard
// Usage: pnpm test:e2e
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Validate PORT is a valid number for security
function validatePort(port: string): string {
  const portNum = Number.parseInt(port, 10)

  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error(`Invalid port: ${port}`)
  }

  return portNum.toString()
}

const PORT = validatePort(process.env.PORT || '4199')
const BASE_URL = `http://localhost:${PORT}`
const NITRO_CONFIG_PATH = resolve(process.cwd(), '.output/nitro.json')
const NITRO_CHUNK_PATH = resolve(
  process.cwd(),
  '.output/server/chunks/nitro/nitro.mjs',
)
const SERVER_ENTRY_PATH = resolve(process.cwd(), '.output/server/index.mjs')
const PAGE_LOAD_TIMEOUT = 30000
const ELEMENT_TIMEOUT = 10000
const SERVER_READY_TIMEOUT = 30000
const SERVER_STOP_TIMEOUT = 5000

async function runCommand(command: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
    })

    child.on('error', reject)

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()

        return
      }

      reject(
        new Error(
          `${command} ${args.join(' ')} failed with ${signal || `exit code ${code}`}`,
        ),
      )
    })
  })
}

async function ensurePreviewBuild() {
  const hasMockBuild =
    existsSync(NITRO_CONFIG_PATH) &&
    existsSync(SERVER_ENTRY_PATH) &&
    existsSync(NITRO_CHUNK_PATH) &&
    readFileSync(NITRO_CHUNK_PATH, 'utf8').includes('"mockMode": true')

  if (hasMockBuild) {
    return
  }

  console.log('Mock preview build not found. Building Nuxt app for e2e...')
  await runCommand('pnpm', ['exec', 'nuxt', 'build'], {
    ...process.env,
    MOCK_MODE: 'true',
  })
}

async function waitForServer(timeout = SERVER_READY_TIMEOUT): Promise<void> {
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL)

      if (response.ok) {
        console.log(`Server is ready at ${BASE_URL}`)

        return
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Server failed to start within ${timeout}ms`)
}

function getPage(page: Page | null): Page {
  if (!page) {
    throw new Error('Playwright page was not initialized')
  }

  return page
}

async function gotoAppPath(page: Page | null, path: string): Promise<Page> {
  const currentPage = getPage(page)

  if (currentPage.url().startsWith(BASE_URL)) {
    await currentPage.evaluate((nextPath) => {
      window.location.hash = nextPath
    }, path)
  } else {
    await currentPage.goto(`${BASE_URL}/#${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT,
    })
  }

  await expectHashPath(currentPage, path)
  await currentPage.waitForLoadState('networkidle')

  return currentPage
}

async function expectHashPath(page: Page | null, path: string): Promise<void> {
  await expect
    .poll(() => getPage(page).url(), { timeout: ELEMENT_TIMEOUT })
    .toContain(`#${path}`)
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) {
    return
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (server.exitCode === null && server.signalCode === null) {
        server.kill('SIGKILL')
      }
    }, SERVER_STOP_TIMEOUT)

    server.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    server.kill('SIGTERM')
  })
}

describe('e2E Page Tests', () => {
  let server: ChildProcess | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  beforeAll(async () => {
    await ensurePreviewBuild()

    // Start the preview server
    console.log(`Starting preview server on port ${PORT}...`)
    server = spawn(process.execPath, [SERVER_ENTRY_PATH], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORT,
        MOCK_MODE: 'true',
      },
    })

    server.on('error', (err) => {
      console.error('Server error:', err)
    })

    // Wait for server to be ready
    await waitForServer()

    // Launch browser
    browser = await chromium.launch({ headless: true })
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })
    page = await context.newPage()

    // Setup localStorage - must navigate to origin first, then set storage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('curTheme', '"dark"')
      // Note: VueUse's useLocalStorage<string> stores raw strings, not JSON-serialized
      // But useLocalStorage<T[]> expects JSON-serialized arrays
      localStorage.setItem('selectedEndpoint', 'mock-endpoint')
      localStorage.setItem(
        'endpointList',
        JSON.stringify([
          { id: 'mock-endpoint', url: 'http://127.0.0.1:9090', secret: '' },
        ]),
      )
    })
    // Reload to apply localStorage changes to Pinia store
    await page.reload({ waitUntil: 'domcontentloaded' })
  }, 120000)

  afterAll(async () => {
    try {
      if (context) {
        await context.close()
      }

      if (browser) {
        await browser.close()
      }
    } finally {
      if (server) {
        console.log('Stopping preview server...')
        await stopServer(server)
      }
    }
  })

  describe('overview Page', () => {
    it('should display stats container and charts', async () => {
      const currentPage = await gotoAppPath(page, '/overview')

      // Wait for expected element - overview stat cards
      await currentPage.waitForSelector('.overview-stat-card', {
        timeout: ELEMENT_TIMEOUT,
      })

      // Check for stat cards
      const statCards = currentPage.locator('.overview-stat-card')
      await expect(statCards.count()).resolves.toBe(6)
      await expect(
        statCards.filter({ hasText: 'Upload' }).count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        statCards.filter({ hasText: 'Download' }).count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        statCards.filter({ hasText: 'Active Connections' }).count(),
      ).resolves.toBe(1)

      await expect(currentPage.getByText('Traffic').count()).resolves.toBe(1)
      await expect(
        currentPage.getByText('Memory').count(),
      ).resolves.toBeGreaterThan(0)
    })
  })

  describe('proxies Page', () => {
    it('should display tabs and proxy cards', async () => {
      const currentPage = await gotoAppPath(page, '/proxies')

      await currentPage.waitForSelector('text=Proxy Providers', {
        timeout: ELEMENT_TIMEOUT,
      })
      await expect(
        currentPage.locator('button').filter({ hasText: 'Proxies' }).count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        currentPage
          .locator('button')
          .filter({ hasText: 'Proxy Providers' })
          .count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        currentPage.getByRole('button', { name: 'Test All' }).isVisible(),
      ).resolves.toBe(true)
    })
  })

  describe('connections Page', () => {
    it('should display connections table', async () => {
      const currentPage = await gotoAppPath(page, '/connections')

      // Wait for table
      await currentPage.waitForSelector('table', { timeout: ELEMENT_TIMEOUT })

      // Check for connections table
      const table = currentPage.locator('table').first()
      await expect(table.isVisible()).resolves.toBe(true)

      // Check for table header
      await expect(table.locator('thead').count()).resolves.toBe(1)
      await expect(table.locator('thead').innerText()).resolves.toContain(
        'HOST',
      )
    })
  })

  describe('rules Page', () => {
    it('should display rules tabs', async () => {
      const currentPage = await gotoAppPath(page, '/rules')

      await currentPage.waitForSelector('text=Rule Providers', {
        timeout: ELEMENT_TIMEOUT,
      })
      await expect(
        currentPage.locator('button').filter({ hasText: 'Rules' }).count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        currentPage
          .locator('button')
          .filter({ hasText: 'Rule Providers' })
          .count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        currentPage.getByPlaceholder('Search').isVisible(),
      ).resolves.toBe(true)
    })
  })

  describe('logs Page', () => {
    it('should display logs table', async () => {
      const currentPage = await gotoAppPath(page, '/logs')

      // Wait for table
      await currentPage.waitForSelector('table', { timeout: ELEMENT_TIMEOUT })

      // Check for logs table
      const table = currentPage.locator('table').first()
      await expect(table.isVisible()).resolves.toBe(true)
      await expect(table.locator('thead').innerText()).resolves.toContain(
        'Level',
      )
      await expect(table.locator('thead').innerText()).resolves.toContain(
        'Payload',
      )
    })
  })

  describe('config Page', () => {
    it('should display config fieldsets', async () => {
      const currentPage = await gotoAppPath(page, '/config')

      await currentPage.waitForSelector('.config-card', {
        timeout: ELEMENT_TIMEOUT,
      })
      await expect(
        currentPage.locator('.config-card').count(),
      ).resolves.toBeGreaterThan(0)
      await expect(
        currentPage.getByText('Keyboard Shortcuts').first().isVisible(),
      ).resolves.toBe(true)
    })
  })

  describe('setup Page', () => {
    it('should display setup form with inputs', async () => {
      const currentPage = await gotoAppPath(page, '/setup')

      // Wait for setup form
      await currentPage.waitForSelector('#url', {
        state: 'visible',
        timeout: ELEMENT_TIMEOUT,
      })

      // Check for setup form
      const form = currentPage.locator('form').first()
      await expect(form.isVisible()).resolves.toBe(true)

      // Check for input fields
      await expect(currentPage.locator('#url').isVisible()).resolves.toBe(true)
      await expect(currentPage.locator('#secret').isVisible()).resolves.toBe(
        true,
      )

      // Check for submit button
      await expect(
        currentPage.getByRole('button', { name: 'Add' }).isVisible(),
      ).resolves.toBe(true)
    })
  })

  describe('navigation', () => {
    it('should have header/navigation present', async () => {
      const currentPage = await gotoAppPath(page, '/overview')

      await currentPage.waitForSelector('a[href="#/overview"]', {
        state: 'visible',
        timeout: ELEMENT_TIMEOUT,
      })
      await expect(
        currentPage.locator('a[href="#/overview"]').first().isVisible(),
      ).resolves.toBe(true)
      await expect(
        currentPage.locator('a[href="#/proxies"]').first().isVisible(),
      ).resolves.toBe(true)
    })
  })

  describe('keyboard Shortcuts', () => {
    it('should open help modal when pressing ?', async () => {
      const currentPage = await gotoAppPath(page, '/overview')

      // Press ? key (Shift + /)
      await currentPage.keyboard.press('Shift+/')

      // Wait for modal to appear
      await currentPage.waitForSelector('.modal-open', {
        timeout: ELEMENT_TIMEOUT,
      })

      // Check modal is visible
      const modal = currentPage.locator('.modal-open')
      await expect(modal.isVisible()).resolves.toBe(true)

      // Check modal contains shortcuts content
      const modalContent = currentPage.locator('.modal-box')
      await expect(modalContent.isVisible()).resolves.toBe(true)
      await expect(modalContent.innerText()).resolves.toContain(
        'Keyboard Shortcuts',
      )

      // Close with Escape
      await currentPage.keyboard.press('Escape')

      // Modal should be closed
      await currentPage.waitForSelector('.modal-open', {
        state: 'hidden',
        timeout: ELEMENT_TIMEOUT,
      })
    })

    it('should navigate to proxies page with g+p', async () => {
      const currentPage = await gotoAppPath(page, '/overview')

      // Press g then p
      await currentPage.keyboard.press('g')
      await currentPage.keyboard.press('p')

      await expectHashPath(page, '/proxies')
    })

    it('should navigate to connections page with g+c', async () => {
      const currentPage = await gotoAppPath(page, '/overview')

      // Press g then c
      await currentPage.keyboard.press('g')
      await currentPage.keyboard.press('c')

      await expectHashPath(page, '/connections')
    })

    it('should not trigger shortcuts when typing in input', async () => {
      const currentPage = await gotoAppPath(page, '/setup')

      // Find an input field on setup page
      const input = currentPage.locator('#url')
      await input.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT })
      await input.click()

      // Type 'g' and 'p' in input - should not navigate
      await input.type('gp')

      await expectHashPath(page, '/setup')
    })
  })

  describe('mobile Viewport', () => {
    it('should render correctly on mobile viewport', async () => {
      const currentPage = getPage(page)
      await currentPage.setViewportSize({ width: 390, height: 844 })
      await gotoAppPath(currentPage, '/overview')

      // Check that page still renders - look for main content (stat cards or rounded elements)
      await currentPage.waitForSelector('.overview-stat-card', {
        timeout: ELEMENT_TIMEOUT,
      })
      const mainContent = currentPage.locator('.overview-stat-card')
      await expect(mainContent.count()).resolves.toBeGreaterThan(0)

      // Reset viewport for other tests
      await currentPage.setViewportSize({ width: 1920, height: 1080 })
    })
  })
})
