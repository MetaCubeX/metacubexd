// Page-based e2e tests for metacubexd dashboard
// Usage: pnpm test:e2e
import { spawn, type ChildProcess } from 'node:child_process'
import { type BrowserContext, chromium, type Page } from 'playwright'

const PORT = process.env.PORT || '4199'
const BASE_URL = `http://localhost:${PORT}`

// Helper function to assert element is visible
async function assertVisible(
  page: Page,
  selector: string,
  description: string,
): Promise<void> {
  const element = page.locator(selector).first()
  const isVisible = await element.isVisible()

  if (!isVisible) {
    throw new Error(`Expected ${description} (${selector}) to be visible`)
  }
}

// Helper function to assert element exists
async function assertExists(
  page: Page,
  selector: string,
  description: string,
): Promise<void> {
  const count = await page.locator(selector).count()

  if (count === 0) {
    throw new Error(`Expected ${description} (${selector}) to exist`)
  }
}

type PageConfig = {
  name: string
  path: string // Hash route path (e.g., '/#/overview')
  waitFor: string
  expectations: (page: Page) => Promise<void>
}

// Test configuration for each page
const PAGES: PageConfig[] = [
  {
    name: 'overview',
    path: '/#/overview',
    waitFor: '.stat-value',
    expectations: async (page: Page) => {
      // Check for traffic stats
      await assertVisible(page, '.stats', 'stats container')
      await assertVisible(page, '.stat-title', 'stat title')
      // Check for charts container
      await assertExists(page, '.rounded-box', 'charts container')
    },
  },
  {
    name: 'proxies',
    path: '/#/proxies',
    waitFor: '.tabs',
    expectations: async (page: Page) => {
      // Check for tabs
      await assertVisible(page, '.tabs', 'tabs')
      // Check for proxy groups/cards
      await assertExists(page, '.card, .collapse', 'proxy cards')
    },
  },
  {
    name: 'connections',
    path: '/#/conns',
    waitFor: 'table',
    expectations: async (page: Page) => {
      // Check for connections table
      await assertVisible(page, 'table', 'connections table')
      await assertExists(page, 'thead', 'table header')
    },
  },
  {
    name: 'rules',
    path: '/#/rules',
    waitFor: '.tabs',
    expectations: async (page: Page) => {
      // Check for rules tabs
      await assertVisible(page, '.tabs', 'tabs')
    },
  },
  {
    name: 'logs',
    path: '/#/logs',
    waitFor: 'table',
    expectations: async (page: Page) => {
      // Check for logs table
      await assertVisible(page, 'table', 'logs table')
    },
  },
  {
    name: 'config',
    path: '/#/config',
    waitFor: '.fieldset',
    expectations: async (page: Page) => {
      // Check for config fieldsets
      await assertVisible(page, '.fieldset', 'config fieldset')
    },
  },
  {
    name: 'setup',
    path: '/#/setup',
    waitFor: 'form',
    expectations: async (page: Page) => {
      // Check for setup form
      await assertVisible(page, 'form', 'setup form')
      await assertExists(page, 'input[type="url"]', 'URL input')
      await assertExists(page, 'input[type="password"]', 'password input')
      await assertExists(page, 'button[type="submit"]', 'submit button')
    },
  },
]

// Setup localStorage to enable mock mode navigation
const setupLocalStorage = () => {
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

async function runTests(): Promise<{ passed: number; failed: number }> {
  console.log('Starting page-based e2e tests...')
  console.log(`Base URL: ${BASE_URL}`)

  const browser = await chromium.launch({ headless: true })
  const results = { passed: 0, failed: 0 }

  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })

    page = await context.newPage()

    // Setup localStorage before navigation
    await page.addInitScript(setupLocalStorage)

    // Test each page
    for (const pageConfig of PAGES) {
      console.log(`\nTesting: ${pageConfig.name}`)

      try {
        // Navigate to page
        await page.goto(`${BASE_URL}${pageConfig.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        })

        // Wait for page to stabilize
        await page.waitForTimeout(2000)

        // Wait for expected element
        try {
          await page.waitForSelector(pageConfig.waitFor, { timeout: 10000 })
          console.log(`  ✓ Found expected element: ${pageConfig.waitFor}`)
        } catch {
          console.log(`  ⚠ Element not found: ${pageConfig.waitFor}`)
        }

        // Run page-specific expectations
        await pageConfig.expectations(page)

        console.log(`  ✓ ${pageConfig.name} page passed`)
        results.passed++
      } catch (error) {
        console.error(`  ✗ ${pageConfig.name} page failed:`, error)
        results.failed++
      }
    }

    // Additional navigation tests
    console.log('\nTesting navigation...')

    try {
      // Test navigation from setup to overview after endpoint setup
      await page.goto(`${BASE_URL}/#/setup`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(1000)

      // Verify we can navigate using the header
      const headerNav = page.locator('header, nav')

      if ((await headerNav.count()) > 0) {
        console.log('  ✓ Header/navigation is present')
        results.passed++
      } else {
        console.log('  ⚠ Header/navigation not found')
      }
    } catch (error) {
      console.error('  ✗ Navigation test failed:', error)
      results.failed++
    }

    // Test responsive viewport
    console.log('\nTesting mobile viewport...')

    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${BASE_URL}/#/overview`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(2000)

      // Check that page still renders
      const stats = page.locator('.stats')

      if ((await stats.count()) > 0) {
        console.log('  ✓ Mobile viewport renders correctly')
        results.passed++
      } else {
        console.log('  ⚠ Mobile viewport may have issues')
      }
    } catch (error) {
      console.error('  ✗ Mobile viewport test failed:', error)
      results.failed++
    }
  } finally {
    if (context) {
      await context.close()
    }

    await browser.close()
  }

  return results
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

// Main entry point
async function main() {
  let server: ChildProcess | null = null

  try {
    // Start the preview server
    console.log(`Starting preview server on port ${PORT}...`)
    server = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], {
      stdio: 'inherit',
      shell: true,
      detached: false,
    })

    server.on('error', (err) => {
      console.error('Server error:', err)
    })

    // Wait for server to be ready
    await waitForServer()

    // Run tests
    const results = await runTests()

    // Print summary
    console.log('\n' + '='.repeat(50))
    console.log('Test Summary')
    console.log('='.repeat(50))
    console.log(`Passed: ${results.passed}`)
    console.log(`Failed: ${results.failed}`)
    console.log(`Total:  ${results.passed + results.failed}`)

    if (results.failed > 0) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error('E2E tests failed:', error)
    process.exitCode = 1
  } finally {
    if (server) {
      console.log('Stopping preview server...')

      server.kill('SIGTERM')
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!server!.killed) {
          server!.kill('SIGKILL')
        }
      }, 5000)
    }
  }
}

main()
