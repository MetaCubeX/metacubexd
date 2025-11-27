// Screenshot generation script for CI
// Usage: pnpm screenshot
import { chromium } from 'playwright'

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173'
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'docs'

type ScreenshotConfig = {
  name: string
  path: string // Hash route path (e.g., '/overview' becomes '/#/overview')
  waitFor: string
  mobile?: boolean
}

const DESKTOP_SCREENSHOTS: ScreenshotConfig[] = [
  {
    name: 'preview-overview',
    path: '/#/overview',
    waitFor: '.stat-value',
  },
  {
    name: 'preview-proxies',
    path: '/#/proxies',
    waitFor: '[class*="card"]',
  },
  {
    name: 'preview-connections',
    path: '/#/conns',
    waitFor: '[class*="table"]',
  },
  {
    name: 'preview-rules',
    path: '/#/rules',
    waitFor: '[class*="table"]',
  },
  {
    name: 'preview-logs',
    path: '/#/logs',
    waitFor: '[class*="table"]',
  },
  {
    name: 'preview-config',
    path: '/#/config',
    waitFor: '[class*="card"]',
  },
]

const MOBILE_SCREENSHOTS: ScreenshotConfig[] = [
  {
    name: 'preview-overview-mobile',
    path: '/#/overview',
    waitFor: '.stat-value',
    mobile: true,
  },
  {
    name: 'preview-proxies-mobile',
    path: '/#/proxies',
    waitFor: '[class*="card"]',
    mobile: true,
  },
  {
    name: 'preview-connections-mobile',
    path: '/#/connections',
    waitFor: '[class*="table"]',
    mobile: true,
  },
]

const ALL_SCREENSHOTS = [...DESKTOP_SCREENSHOTS, ...MOBILE_SCREENSHOTS]

const DESKTOP_VIEWPORT = { width: 1920, height: 1080 }
const MOBILE_VIEWPORT = { width: 390, height: 844 } // iPhone 14 Pro size

async function takeScreenshots() {
  console.log('Starting screenshot generation...')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Output directory: ${OUTPUT_DIR}`)

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

  for (const screenshot of ALL_SCREENSHOTS) {
    const isMobile = screenshot.mobile
    const page = isMobile ? mobilePage : desktopPage
    const label = isMobile ? '📱' : '🖥️'

    console.log(`${label} Taking screenshot: ${screenshot.name}`)

    try {
      // Navigate directly to the hash route
      await page.goto(`${BASE_URL}${screenshot.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })

      // Wait for page to stabilize
      await page.waitForTimeout(2000)

      // Try to wait for specific element, but don't fail if not found
      if (screenshot.waitFor) {
        try {
          await page.waitForSelector(screenshot.waitFor, { timeout: 5000 })
        } catch {
          console.log(
            `  (element ${screenshot.waitFor} not found, continuing anyway)`,
          )
        }
      }

      // Log current URL for debugging
      const currentUrl = page.url()
      console.log(`  URL: ${currentUrl}`)

      // Additional wait for animations
      await page.waitForTimeout(500)

      await page.screenshot({
        path: `${OUTPUT_DIR}/${screenshot.name}.png`,
        type: 'png',
        fullPage: false,
      })

      console.log(`✓ Saved ${screenshot.name}.png`)
    } catch (error) {
      console.error(`✗ Failed to capture ${screenshot.name}:`, error)
    }
  }

  await desktopContext.close()
  await mobileContext.close()
  await browser.close()
  console.log('Screenshot generation complete!')
}

takeScreenshots().catch((error) => {
  console.error('Screenshot generation failed:', error)
  process.exit(1)
})
