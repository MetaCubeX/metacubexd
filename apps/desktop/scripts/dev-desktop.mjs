// `pnpm dev:desktop` launcher — desktop dev with full renderer HMR.
//
// Runs the live Nuxt dev server (HMR) AND electron-vite dev together, and points
// the Electron main process at the dev server via MCXD_RENDERER_DEV_URL —
// index.ts then loadURL()s the dev server and flips on the control server's
// dev-only CORS shim (the renderer is now a different loopback origin than
// /api/control). Packaged builds never set that env, so this whole path is
// dev-only. No extra deps — plain child_process.
//
// (Packaging uses a separate static-renderer build: nuxt generate → copy into
// apps/desktop/renderer; see .github/workflows/release.yml and copy:renderer.)
import { spawn } from 'node:child_process'
import { stripVTControlCharacters } from 'node:util'

const children = []
let shuttingDown = false
let electronStarted = false
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stripAnsi = (s) => stripVTControlCharacters(s)

function findDevUrl(text) {
  for (const prefix of ['http://localhost:', 'http://127.0.0.1:']) {
    let start = text.indexOf(prefix)
    while (start !== -1) {
      let end = start + prefix.length
      while (end < text.length && text[end] >= '0' && text[end] <= '9') end++
      if (end > start + prefix.length) return text.slice(start, end)
      start = text.indexOf(prefix, start + prefix.length)
    }
  }
  return undefined
}

function killAll(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    if (c && !c.killed) {
      try {
        c.kill('SIGTERM')
      } catch {
        /* already gone */
      }
    }
  }
  setTimeout(() => process.exit(code), 600)
}
process.on('SIGINT', () => killAll(0))
process.on('SIGTERM', () => killAll(0))

function spawnFiltered(pkg, env) {
  const child = spawn('pnpm', ['--filter', pkg, 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  children.push(child)
  return child
}

function pipe(stream, prefix, scan) {
  stream.on('data', (buf) => {
    const text = buf.toString()
    process.stdout.write(prefix + text.replaceAll('\n', `\n${prefix}`))
    if (scan) scan(stripAnsi(text))
  })
}

async function startElectron(devUrl) {
  if (electronStarted) return
  electronStarted = true
  // Wait until the dev server actually answers, so Electron's loadURL doesn't
  // hit ERR_CONNECTION_REFUSED on a server that printed its URL but isn't ready.
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(devUrl)
      if (r.status < 500) break
    } catch {
      /* not up yet */
    }
    await sleep(500)
  }
  console.log(
    `\n[dev-hmr] Nuxt dev ready → launching Electron with HMR (${devUrl})\n`,
  )
  const desktop = spawnFiltered('@metacubexd/desktop', {
    MCXD_RENDERER_DEV_URL: devUrl,
  })
  pipe(desktop.stdout, '[desktop] ')
  pipe(desktop.stderr, '[desktop] ')
  desktop.on('exit', (code) => killAll(code ?? 0))
}

const ui = spawnFiltered('@metacubexd/ui')
const onUiOut = (clean) => {
  if (electronStarted) return
  const devUrl = findDevUrl(clean)
  if (devUrl) void startElectron(devUrl)
}
pipe(ui.stdout, '[ui] ', onUiOut)
pipe(ui.stderr, '[ui] ', onUiOut)
ui.on('exit', (code) => {
  if (!electronStarted) {
    console.error('[dev-hmr] Nuxt dev exited before it became ready')
    killAll(code ?? 1)
  }
})

// Safety net: if the dev server URL never shows up, don't hang forever.
setTimeout(() => {
  if (!electronStarted) {
    console.error('[dev-hmr] timed out waiting for the Nuxt dev URL (90s)')
    killAll(1)
  }
}, 90_000)
