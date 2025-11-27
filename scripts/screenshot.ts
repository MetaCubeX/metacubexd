// Screenshot generation script for CI
// Usage: pnpm screenshot
import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import { chromium } from 'playwright'

const PORT = process.env.PORT || '4199'
const BASE_URL = `http://localhost:${PORT}`
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'docs'
const PC_DIR = `${OUTPUT_DIR}/pc`
const MOBILE_DIR = `${OUTPUT_DIR}/mobile`

type PageConfig = {
  name: string
  path: string // Hash route path (e.g., '/#/overview')
  waitFor: string
}

// Pages to capture - same for both desktop and mobile
const PAGES: PageConfig[] = [
  {
    name: 'overview',
    path: '/#/overview',
    waitFor: '.stat-value', // Overview page stats
  },
  {
    name: 'proxies',
    path: '/#/proxies',
    waitFor: '.tabs', // Proxies page tabs
  },
  {
    name: 'connections',
    path: '/#/conns',
    waitFor: 'table', // Connections table
  },
  {
    name: 'rules',
    path: '/#/rules',
    waitFor: '.tabs', // Rules page tabs (uses virtual list, not table)
  },
  {
    name: 'logs',
    path: '/#/logs',
    waitFor: 'table', // Logs table
  },
  {
    name: 'config',
    path: '/#/config',
    waitFor: '.fieldset', // Config fieldsets
  },
]

const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }
const MOBILE_VIEWPORT = { width: 390, height: 844 } // iPhone 14 Pro size

// Check if server is ready by making HTTP request
async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(BASE_URL)

      if (response.ok) {
        console.log(`Server is ready at ${BASE_URL}`)

        return
      }
    } catch {
      // Server not ready yet, wait and retry
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error('Server failed to start within timeout')
}

// Start vite preview server
function startServer(): ChildProcess {
  console.log(`Starting preview server on port ${PORT}...`)

  const server = spawn(
    'npx',
    ['vite', 'preview', '--port', PORT, '--strictPort'],
    {
      stdio: 'inherit',
      shell: true,
      detached: false,
    },
  )

  server.on('error', (err) => {
    console.error('Server error:', err)
  })

  return server
}

// Stop the server gracefully
function stopServer(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!server.pid) {
      resolve()

      return
    }

    console.log('Stopping preview server...')

    server.on('close', () => {
      console.log('Server stopped')
      resolve()
    })

    // Try graceful shutdown first
    server.kill('SIGTERM')

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!server.killed) {
        server.kill('SIGKILL')
      }

      resolve()
    }, 5000)
  })
}

async function takeScreenshots() {
  console.log('Starting screenshot generation...')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output directory: ${OUTPUT_DIR}`)

  // Ensure output directories exist
  if (!fs.existsSync(PC_DIR)) {
    fs.mkdirSync(PC_DIR, { recursive: true })
  }

  if (!fs.existsSync(MOBILE_DIR)) {
    fs.mkdirSync(MOBILE_DIR, { recursive: true })
  }

  const browser = await chromium.launch({
    headless: true,
  })

  // Create desktop context
  const desktopContext = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: 2,
  })

  // Create mobile context
  const mobileContext = await browser.newContext({
    viewport: MOBILE_VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })

  const desktopPage = await desktopContext.newPage()
  const mobilePage = await mobileContext.newPage()

  // Set dark theme and mock endpoint for better screenshots
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

  await desktopPage.addInitScript(setupLocalStorage)
  await mobilePage.addInitScript(setupLocalStorage)

  // Take screenshots for each page in both desktop and mobile viewports
  for (const pageConfig of PAGES) {
    // Desktop screenshot
    await captureScreenshot(
      desktopPage,
      pageConfig,
      PC_DIR,
      pageConfig.name,
      '🖥️',
    )

    // Mobile screenshot
    await captureScreenshot(
      mobilePage,
      pageConfig,
      MOBILE_DIR,
      pageConfig.name,
      '📱',
    )
  }

  await desktopContext.close()
  await mobileContext.close()
  await browser.close()
  console.log('Screenshot generation complete!')
}

async function captureScreenshot(
  page: Awaited<
    ReturnType<typeof chromium.launch>
  >['newPage'] extends () => Promise<infer P>
    ? P
    : never,
  config: PageConfig,
  outputDir: string,
  filename: string,
  label: string,
) {
  console.log(`${label} Taking screenshot: ${outputDir}/${filename}.png`)

  try {
    // Navigate directly to the hash route
    await page.goto(`${BASE_URL}${config.path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Wait for page to stabilize
    await page.waitForTimeout(2000)

    // Try to wait for specific element, but don't fail if not found
    if (config.waitFor) {
      try {
        await page.waitForSelector(config.waitFor, { timeout: 5000 })
      } catch {
        console.log(
          `  (element ${config.waitFor} not found, continuing anyway)`,
        )
      }
    }

    // Log current URL for debugging
    const currentUrl = page.url()
    console.log(`  URL: ${currentUrl}`)

    // Additional wait for animations
    await page.waitForTimeout(500)

    await page.screenshot({
      path: `${outputDir}/${filename}.png`,
      type: 'png',
      fullPage: false,
    })

    console.log(`✓ Saved ${outputDir}/${filename}.png`)
  } catch (error) {
    console.error(`✗ Failed to capture ${filename}:`, error)
  }
}

// Main entry point
async function main() {
  let server: ChildProcess | null = null

  try {
    // Start the preview server
    server = startServer()

    // Wait for server to be ready
    await waitForServer()

    // Take screenshots
    await takeScreenshots()
  } catch (error) {
    console.error('Screenshot generation failed:', error)
    process.exitCode = 1
  } finally {
    // Always stop the server
    if (server) {
      await stopServer(server)
    }
  }
}

main()
