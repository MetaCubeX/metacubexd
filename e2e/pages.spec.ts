import type { ChildProcess } from 'node:child_process'
import type { BrowserContext, Page } from 'playwright'
// Page-based e2e tests for metacubexd dashboard
// Usage: pnpm test:e2e
import { spawn } from 'node:child_process'
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

// Setup localStorage to enable mock mode navigation
function setupLocalStorage() {
  localStorage.setItem('curTheme', '"dark"')
  // Set a mock endpoint to prevent redirect to setup page
  localStorage.setItem('selectedEndpoint', '"mock-endpoint"')
  localStorage.setItem(
    'endpointList',
    JSON.stringify([
      { id: 'mock-endpoint', url: 'http://127.0.0.1:9090', secret: '' },
    ]),
  )
}

// Check if server is ready
async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(BASE_URL)

      if (response.ok) {
        console.log(`Server is ready at ${BASE_URL}`)

        return
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Server failed to start within timeout')
}

describe('e2E Page Tests', () => {
  let server: ChildProcess | null = null
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  beforeAll(async () => {
    // Start the preview server
    console.log(`Starting preview server on port ${PORT}...`)
    server = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], {
      stdio: 'inherit',
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

    // Setup localStorage before navigation
    await page.addInitScript(setupLocalStorage)
  })

  afterAll(async () => {
    if (context) {
      await context.close()
    }

    if (browser) {
      await browser.close()
    }

    if (server) {
      console.log('Stopping preview server...')
      server.kill('SIGTERM')
      // Force kill after 5 seconds if still running
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (server && !server.killed) {
            server.kill('SIGKILL')
          }

          resolve()
        }, 5000)

        server!.on('exit', () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
  })

  describe('overview Page', () => {
    it('should display stats container and charts', async () => {
      await page!.goto(`${BASE_URL}/#/overview`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for expected element
      await page!.waitForSelector('.stat-value', { timeout: 10000 })

      // Check for traffic stats
      const stats = page!.locator('.stats').first()
      await expect(stats.isVisible()).resolves.toBe(true)

      const statTitle = page!.locator('.stat-title').first()
      await expect(statTitle.isVisible()).resolves.toBe(true)

      // Check for charts container
      const chartsContainer = page!.locator('.rounded-box')
      await expect(chartsContainer.count()).resolves.toBeGreaterThan(0)
    })
  })

  describe('proxies Page', () => {
    it('should display tabs and proxy cards', async () => {
      await page!.goto(`${BASE_URL}/#/proxies`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for tabs
      await page!.waitForSelector('.tabs', { timeout: 10000 })

      // Check for tabs
      const tabs = page!.locator('.tabs').first()
      await expect(tabs.isVisible()).resolves.toBe(true)

      // Check for proxy groups/cards
      const proxyCards = page!.locator('.card, .collapse')
      await expect(proxyCards.count()).resolves.toBeGreaterThan(0)
    })
  })

  describe('connections Page', () => {
    it('should display connections table', async () => {
      await page!.goto(`${BASE_URL}/#/conns`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for table
      await page!.waitForSelector('table', { timeout: 10000 })

      // Check for connections table
      const table = page!.locator('table').first()
      await expect(table.isVisible()).resolves.toBe(true)

      // Check for table header
      const thead = page!.locator('thead')
      await expect(thead.count()).resolves.toBeGreaterThan(0)
    })
  })

  describe('rules Page', () => {
    it('should display rules tabs', async () => {
      await page!.goto(`${BASE_URL}/#/rules`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for tabs
      await page!.waitForSelector('.tabs', { timeout: 10000 })

      // Check for rules tabs
      const tabs = page!.locator('.tabs').first()
      await expect(tabs.isVisible()).resolves.toBe(true)
    })
  })

  describe('logs Page', () => {
    it('should display logs table', async () => {
      await page!.goto(`${BASE_URL}/#/logs`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for table
      await page!.waitForSelector('table', { timeout: 10000 })

      // Check for logs table
      const table = page!.locator('table').first()
      await expect(table.isVisible()).resolves.toBe(true)
    })
  })

  describe('config Page', () => {
    it('should display config fieldsets', async () => {
      await page!.goto(`${BASE_URL}/#/config`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for fieldset
      await page!.waitForSelector('.fieldset', { timeout: 10000 })

      // Check for config fieldsets
      const fieldset = page!.locator('.fieldset').first()
      await expect(fieldset.isVisible()).resolves.toBe(true)
    })
  })

  describe('setup Page', () => {
    it('should display setup form with inputs', async () => {
      await page!.goto(`${BASE_URL}/#/setup`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Wait for form
      await page!.waitForSelector('form', { timeout: 10000 })

      // Check for setup form
      const form = page!.locator('form').first()
      await expect(form.isVisible()).resolves.toBe(true)

      // Check for URL input
      const urlInput = page!.locator('input[type="url"]')
      await expect(urlInput.count()).resolves.toBeGreaterThan(0)

      // Check for password input
      const passwordInput = page!.locator('input[type="password"]')
      await expect(passwordInput.count()).resolves.toBeGreaterThan(0)

      // Check for submit button
      const submitButton = page!.locator('button[type="submit"]')
      await expect(submitButton.count()).resolves.toBeGreaterThan(0)
    })
  })

  describe('navigation', () => {
    it('should have header/navigation present', async () => {
      await page!.goto(`${BASE_URL}/#/setup`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Verify we can navigate using the header
      const headerNav = page!.locator('header, nav')
      await expect(headerNav.count()).resolves.toBeGreaterThan(0)
    })
  })

  describe('mobile Viewport', () => {
    it('should render correctly on mobile viewport', async () => {
      await page!.setViewportSize({ width: 390, height: 844 })
      await page!.goto(`${BASE_URL}/#/overview`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page!.waitForLoadState('networkidle')

      // Check that page still renders
      const stats = page!.locator('.stats')
      await expect(stats.count()).resolves.toBeGreaterThan(0)

      // Reset viewport for other tests
      await page!.setViewportSize({ width: 1920, height: 1080 })
    })
  })
})
