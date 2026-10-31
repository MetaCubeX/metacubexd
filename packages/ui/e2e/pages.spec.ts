import type { ChildProcess } from 'node:child_process'
import type { BrowserContext, Page } from 'playwright'
import type { Connection } from '../types'
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
    // The index page redirects on mount. Let it finish before a test changes
    // the hash, otherwise the initial redirect can overwrite that navigation.
    await page.waitForURL('**/#/overview', { timeout: ELEMENT_TIMEOUT })
    await page.waitForSelector('.overview-stat-card', {
      timeout: ELEMENT_TIMEOUT,
    })
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

    it('should jump to the selected proxy on desktop', async () => {
      const currentPage = await gotoAppPath(page, '/proxies')
      const jumpButton = currentPage.locator(
        'button[data-testid="jump-to-current"][data-proxy-group="Auto Select"]',
      )
      const selectedProxy = currentPage.locator(
        '[data-proxy-group="Auto Select"][data-selected="true"]',
      )

      await expect
        .poll(() => jumpButton.isVisible(), { timeout: ELEMENT_TIMEOUT })
        .toBe(true)
      const wasExpanded = (await selectedProxy.count()) > 0

      await currentPage.evaluate(() => {
        const testWindow = window as unknown as Record<string, unknown>
        testWindow.originalScrollIntoView = Element.prototype.scrollIntoView
        Element.prototype.scrollIntoView = function () {
          testWindow.scrolledProxyGroup = (
            this as HTMLElement
          ).dataset.proxyGroup
        }
      })

      try {
        await jumpButton.click()
        await expect
          .poll(() =>
            currentPage.evaluate(
              () =>
                (window as unknown as Record<string, unknown>)
                  .scrolledProxyGroup,
            ),
          )
          .toBe('Auto Select')
        await expect(selectedProxy.isVisible()).resolves.toBe(true)
      } finally {
        await currentPage.evaluate(() => {
          const testWindow = window as unknown as Record<string, unknown>
          Element.prototype.scrollIntoView =
            testWindow.originalScrollIntoView as typeof Element.prototype.scrollIntoView
          delete testWindow.originalScrollIntoView
          delete testWindow.scrolledProxyGroup
        })
        if (!wasExpanded) {
          await jumpButton.evaluate((button) => {
            const groupHeader = button.closest(
              '.cursor-pointer',
            ) as HTMLElement | null
            groupHeader?.click()
          })
        }
      }
    })

    it('should scroll the master-detail pane to top on desktop', async () => {
      const currentPage = await gotoAppPath(page, '/proxies')
      await currentPage.setViewportSize({ width: 1024, height: 600 })

      try {
        await currentPage.getByTitle('Master-detail').click()
        const detailScrollContainer = currentPage.getByTestId(
          'master-detail-scroll-container',
        )
        const detailHeader = currentPage.getByTestId('master-detail-header')
        await expect(
          detailHeader.locator('input[type="search"]').count(),
        ).resolves.toBe(0)
        const headerTopBeforeScroll = await detailHeader.evaluate(
          (element) => element.getBoundingClientRect().top,
        )

        await detailScrollContainer.evaluate((element) => {
          const spacer = document.createElement('div')
          spacer.style.flex = '0 0 600px'
          spacer.setAttribute('aria-hidden', 'true')
          element.append(spacer)
          element.scrollTop = 320
          element.dispatchEvent(new Event('scroll'))
        })
        await expect(
          detailHeader.evaluate(
            (element) => element.getBoundingClientRect().top,
          ),
        ).resolves.toBe(headerTopBeforeScroll)

        const scrollToTopButton = currentPage.getByTestId('scroll-to-top')
        await expect
          .poll(() => scrollToTopButton.isVisible(), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(true)

        await currentPage.emulateMedia({ reducedMotion: 'reduce' })
        await scrollToTopButton.click()
        await expect(
          detailScrollContainer.evaluate((element) => element.scrollTop),
        ).resolves.toBe(0)
      } finally {
        await currentPage.emulateMedia({ reducedMotion: 'no-preference' })
        await currentPage.getByTitle('Card').click()
        await currentPage
          .getByTestId('proxies-scroll-container')
          .evaluate((element) => {
            element.scrollTop = 0
            element.dispatchEvent(new Event('scroll'))
          })
        await currentPage.setViewportSize({ width: 1920, height: 1080 })
      }
    })

    it('should scroll the active proxy tab to top on mobile', async () => {
      const currentPage = getPage(page)
      await currentPage.setViewportSize({ width: 390, height: 844 })

      try {
        await gotoAppPath(currentPage, '/proxies')

        const proxyScrollContainer = currentPage.getByTestId(
          'proxies-scroll-container',
        )
        await currentPage.getByTitle('Expand All').click()
        await expect
          .poll(
            () =>
              proxyScrollContainer.evaluate(
                (el) => el.scrollHeight - el.clientHeight,
              ),
            { timeout: ELEMENT_TIMEOUT },
          )
          .toBeGreaterThan(360)

        await proxyScrollContainer.evaluate((el) => {
          el.scrollTop = 0
          el.dispatchEvent(new Event('scroll'))
        })
        await expect
          .poll(() => currentPage.getByTestId('scroll-to-top').count(), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(0)
        await proxyScrollContainer.evaluate((el) => {
          el.scrollTop = 360
          el.dispatchEvent(new Event('scroll'))
        })

        const scrollToTopButton = currentPage.getByTestId('scroll-to-top')
        await expect
          .poll(() => scrollToTopButton.isVisible(), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(true)

        // Reduced-motion users should jump immediately instead of animating.
        await currentPage.emulateMedia({ reducedMotion: 'reduce' })
        await scrollToTopButton.click()
        await expect(
          proxyScrollContainer.evaluate((el) => el.scrollTop),
        ).resolves.toBe(0)
        await currentPage.emulateMedia({ reducedMotion: 'no-preference' })

        // The providers tab owns a separate scroll container. Re-selecting the
        // active Proxies item in the mobile nav should scroll that container.
        await currentPage
          .locator('button')
          .filter({ hasText: 'Proxy Providers' })
          .click()
        await currentPage.getByText('Provider A', { exact: true }).click()
        await currentPage.getByText('Provider B', { exact: true }).click()

        const providerScrollContainer = currentPage.getByTestId(
          'providers-scroll-container',
        )
        await expect
          .poll(
            () =>
              providerScrollContainer.evaluate(
                (el) => el.scrollHeight - el.clientHeight,
              ),
            { timeout: ELEMENT_TIMEOUT },
          )
          .toBeGreaterThan(320)
        await providerScrollContainer.evaluate((el) => {
          el.scrollTop = 320
          el.dispatchEvent(new Event('scroll'))
        })

        const mobileNav = currentPage.getByRole('navigation', {
          name: 'Mobile bottom navigation',
        })
        await mobileNav.locator('a[href="#/proxies"]').click()
        await expect
          .poll(() => providerScrollContainer.evaluate((el) => el.scrollTop), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(0)

        // The floating control remains available after switching to desktop.
        await providerScrollContainer.evaluate((el) => {
          el.scrollTop = 320
          el.dispatchEvent(new Event('scroll'))
        })
        await expect
          .poll(() => scrollToTopButton.isVisible(), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(true)
        await currentPage.setViewportSize({ width: 1024, height: 844 })
        await expect(scrollToTopButton.isVisible()).resolves.toBe(true)
        await scrollToTopButton.click()
        await expect
          .poll(() => providerScrollContainer.evaluate((el) => el.scrollTop), {
            timeout: ELEMENT_TIMEOUT,
          })
          .toBe(0)

        // Inactive bottom-nav items preserve their normal navigation behavior.
        await currentPage.setViewportSize({ width: 390, height: 844 })
        await mobileNav.locator('a[href="#/overview"]').click()
        await expectHashPath(currentPage, '/overview')
      } finally {
        await currentPage.emulateMedia({ reducedMotion: 'no-preference' })
        await currentPage.setViewportSize({ width: 1920, height: 1080 })
      }
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

    it('keeps live connection rows, column widths and scroll positions stable', async () => {
      if (!browser || !context) throw new Error('Browser was not initialized')
      const isolatedContext = await browser.newContext({
        storageState: await context.storageState(),
        viewport: { width: 1024, height: 680 },
      })
      const livePage = await isolatedContext.newPage()

      interface RegressionState {
        store: { activeConnections: Connection[] }
        config: { connectionsDisplayMode: 'auto' | 'table' | 'card' }
        fixtures: Connection[]
        nodes: Map<string, { row: Element; cells: Element[] }>
      }
      type RegressionWindow = Window & {
        connectionRegression: RegressionState
      }

      async function settle() {
        await livePage.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              )
            }),
        )
      }

      async function update(bytes: number, append = false) {
        await livePage.evaluate(
          ({ bytes, append }) => {
            const state = (window as unknown as RegressionWindow)
              .connectionRegression
            const fixtures = [...state.fixtures]
            if (append) {
              fixtures.push({
                ...fixtures[0]!,
                id: 'live-030',
                metadata: { ...fixtures[0]!.metadata, host: 'live-030.test' },
              })
            }
            state.store.activeConnections = fixtures.reverse().map((conn) => ({
              ...conn,
              download: bytes * 10,
              upload: bytes * 2,
              downloadSpeed: bytes,
              uploadSpeed: bytes,
            }))
          },
          { bytes, append },
        )
        await settle()
      }

      async function measure(remember = false) {
        return livePage.evaluate((remember) => {
          const state = (window as unknown as RegressionWindow)
            .connectionRegression
          const container = document.querySelector('.conn-table-container')!
          const scroll = container.parentElement!
          const rows = Array.from(
            container.querySelectorAll('.conn-data-row, .conn-card'),
          )
          const rowStates = rows.map((row) => {
            const id = row.textContent!.match(/live-\d{3}/)![0]
            const cells = Array.from(
              row.querySelectorAll('.conn-cell-wrap, .conn-primary'),
            )
            const previous = state.nodes.get(id)
            const reused =
              previous?.row === row &&
              previous.cells.length === cells.length &&
              previous.cells.every((cell, i) => cell === cells[i])
            if (remember) state.nodes.set(id, { row, cells })
            const style = getComputedStyle(row)
            return {
              id,
              reused,
              animation: style.animationName,
              opacity: style.opacity,
              transform: style.transform,
            }
          })
          return {
            rows: rowStates,
            headers: Array.from(container.querySelectorAll('th'), (header) => {
              const bounds = header.getBoundingClientRect()
              return { x: bounds.x, width: bounds.width }
            }),
            scrollTop: scroll.scrollTop,
            scrollLeft: scroll.scrollLeft,
            scrollWidth: scroll.scrollWidth,
            clientWidth: scroll.clientWidth,
            tableWidth: container
              .querySelector('table')
              ?.getBoundingClientRect().width,
            viewportOverflow: document.documentElement.scrollWidth > innerWidth,
          }
        }, remember)
      }

      function expectStableRows(
        snapshot: Awaited<ReturnType<typeof measure>>,
        count: number,
      ) {
        expect(snapshot.rows.map((row) => row.id)).toEqual(
          Array.from(
            { length: count },
            (_, i) => `live-${String(i).padStart(3, '0')}`,
          ),
        )
        expect(snapshot.rows.slice(0, 30).every((row) => row.reused)).toBe(true)
        expect(
          snapshot.rows.every(
            (row) =>
              row.animation === 'none' &&
              row.opacity === '1' &&
              row.transform === 'none',
          ),
        ).toBe(true)
      }

      try {
        await isolatedContext.addInitScript(() => {
          localStorage.setItem('connectionsTableSortColumn', 'ConnectTime')
          localStorage.setItem('connectionsTableSortDesc', 'true')
          localStorage.setItem('connectionsTableGrouping', 'null')
          localStorage.setItem('connectionsTablePageSize', '50')
          localStorage.setItem('connectionsDisplayMode', 'table')
          localStorage.setItem('showConnectionGeoIP', 'false')
        })
        await gotoAppPath(livePage, '/connections')
        await livePage.waitForSelector('.conn-data-row')
        await livePage.evaluate(() => {
          const root = document.querySelector('#__nuxt') as Element & {
            __vue_app__: {
              config: {
                globalProperties: { $pinia: { _s: Map<string, unknown> } }
              }
            }
          }
          const stores = root.__vue_app__.config.globalProperties.$pinia._s
          const store = stores.get('connections') as RegressionState['store']
          const config = stores.get('config') as RegressionState['config']
          const original = store.activeConnections[0]!
          const fixtures = Array.from({ length: 30 }, (_, i) => {
            const id = `live-${String(i).padStart(3, '0')}`
            return {
              ...original,
              id,
              start: '2026-11-01T00:00:00.000Z',
              download: 0,
              upload: 0,
              downloadSpeed: 0,
              uploadSpeed: 0,
              metadata: { ...original.metadata, host: `${id}.test` },
            }
          })
          ;(window as unknown as RegressionWindow).connectionRegression = {
            store,
            config,
            fixtures,
            nodes: new Map(),
          }
          store.activeConnections = fixtures
        })
        await settle()
        await livePage
          .locator('.conn-table-container')
          .evaluate((container) => {
            container.parentElement!.scrollTop = 120
            container.parentElement!.scrollLeft = 60
          })
        const desktop = await measure(true)
        expect(desktop.scrollTop).toBeGreaterThan(0)
        expect(desktop.scrollLeft).toBeGreaterThan(0)

        for (const bytes of [12, 9999, 1e12]) {
          await update(bytes)
          const refreshed = await measure()
          expectStableRows(refreshed, 30)
          expect(refreshed.headers).toEqual(desktop.headers)
          expect(refreshed.scrollTop).toBe(desktop.scrollTop)
          expect(refreshed.scrollLeft).toBe(desktop.scrollLeft)
        }
        await update(1e12, true)
        expectStableRows(await measure(), 31)

        await livePage.setViewportSize({ width: 390, height: 844 })
        for (const mode of ['card', 'auto', 'table'] as const) {
          await livePage.evaluate((mode) => {
            ;(
              window as unknown as RegressionWindow
            ).connectionRegression.config.connectionsDisplayMode = mode
          }, mode)
          await settle()
          const before = await measure(true)
          await update(1, true)
          const after = await measure()
          expectStableRows(after, 31)
          expect(after.headers).toEqual(before.headers)
          expect(after.scrollTop).toBe(before.scrollTop)
          expect(after.scrollLeft).toBe(before.scrollLeft)
          expect(after.viewportOverflow).toBe(false)
          if (mode === 'auto') {
            expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth + 1)
          }
          if (mode === 'table') {
            expect(after.tableWidth).toBe(before.tableWidth)
            expect(after.tableWidth).toBeGreaterThan(after.clientWidth)
          }
        }
      } finally {
        await isolatedContext.close()
      }
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
    async function configureMobileLayout(
      currentPage: Page,
      useMobileBottomNav: boolean,
      height: number,
    ) {
      await currentPage.setViewportSize({ width: 390, height })
      await currentPage.evaluate((enabled) => {
        localStorage.setItem('useMobileBottomNav', String(enabled))
      }, useMobileBottomNav)
      await currentPage.reload({ waitUntil: 'domcontentloaded' })
      await currentPage.waitForLoadState('networkidle')
    }

    async function restoreDesktopLayout(currentPage: Page) {
      await currentPage.evaluate(() => {
        localStorage.setItem('useMobileBottomNav', 'true')
        document.body.style.paddingBottom = ''
      })
      await currentPage.setViewportSize({ width: 1920, height: 1080 })
      await currentPage.reload({ waitUntil: 'domcontentloaded' })
    }

    it('should keep the document viewport locked with either mobile navigation', async () => {
      const currentPage = getPage(page)

      try {
        for (const useMobileBottomNav of [true, false]) {
          await configureMobileLayout(currentPage, useMobileBottomNav, 844)
          await gotoAppPath(currentPage, '/overview')
          await currentPage.waitForSelector('.overview-stat-card', {
            timeout: ELEMENT_TIMEOUT,
          })

          const viewportState = await currentPage.evaluate(() => {
            const nuxtRoot = document.querySelector<HTMLElement>('#__nuxt')
            if (!nuxtRoot) throw new Error('Nuxt root was not rendered')

            const roots = [document.documentElement, document.body, nuxtRoot]
            const overflowY = roots.map(
              (element) => getComputedStyle(element).overflowY,
            )
            const heights = roots.map((element) => element.clientHeight)

            // Recreate the kind of incidental body growth that previously let
            // the mobile document move independently from its page scrollport.
            document.body.style.paddingBottom = '5rem'
            window.scrollTo(0, document.documentElement.scrollHeight)
            const windowScrollY = window.scrollY
            document.body.style.paddingBottom = ''
            window.scrollTo(0, 0)

            return {
              heights,
              overflowY,
              viewportHeight: window.innerHeight,
              windowScrollY,
            }
          })

          expect(viewportState.overflowY).toEqual([
            'hidden',
            'hidden',
            'hidden',
          ])
          expect(viewportState.heights).toEqual([
            viewportState.viewportHeight,
            viewportState.viewportHeight,
            viewportState.viewportHeight,
          ])
          expect(viewportState.windowScrollY).toBe(0)
        }
      } finally {
        await restoreDesktopLayout(currentPage)
      }
    })

    it('should scroll page content without moving the header on a short viewport', async () => {
      const currentPage = getPage(page)

      try {
        for (const useMobileBottomNav of [true, false]) {
          await configureMobileLayout(currentPage, useMobileBottomNav, 500)
          await gotoAppPath(currentPage, '/overview')
          await currentPage.waitForSelector('.overview-stat-card', {
            timeout: ELEMENT_TIMEOUT,
          })

          const scrollState = await currentPage.evaluate(() => {
            const firstCard = document.querySelector('.overview-stat-card')
            const scrollport =
              firstCard?.closest<HTMLElement>('.overflow-y-auto')
            const header = document.querySelector<HTMLElement>('header')
            if (!scrollport || !header) {
              throw new Error(
                'Mobile header or overview scrollport was missing',
              )
            }

            const headerTopBefore = header.getBoundingClientRect().top
            const maxScroll = scrollport.scrollHeight - scrollport.clientHeight
            scrollport.scrollTop = Math.min(200, maxScroll)

            return {
              headerTopAfter: header.getBoundingClientRect().top,
              headerTopBefore,
              maxScroll,
              scrollTop: scrollport.scrollTop,
              windowScrollY: window.scrollY,
            }
          })

          expect(scrollState.maxScroll).toBeGreaterThan(0)
          expect(scrollState.scrollTop).toBeGreaterThan(0)
          expect(scrollState.headerTopAfter).toBe(scrollState.headerTopBefore)
          expect(scrollState.windowScrollY).toBe(0)
        }
      } finally {
        await restoreDesktopLayout(currentPage)
      }
    })
  })
})
