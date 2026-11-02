// Exercise the built helper with ONLY the files electron-builder unpacks. Source
// tests cannot catch imports that work in out/ but are missing beside app.asar.
// No elevation, service installation, or mihomo process is involved.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const require = createRequire(import.meta.url)
const builderRequire = createRequire(require.resolve('electron-builder'))
// Use the installed packager's matcher, including platform pattern merging.
const { getFileMatchers } = builderRequire('app-builder-lib/out/fileMatcher.js')
const electron = require('electron')
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Verify the bundled main-process entry parses cleanly as an ES module (guards
// against duplicate top-level identifiers when electron-vite injects CJS shims).
execFileSync(process.execPath, ['--check', join(appDir, 'out/main/index.js')])
const config = parse(
  await readFile(join(appDir, 'electron-builder.yml'), 'utf8'),
)
const scratch = await mkdtemp(join(tmpdir(), 'mcxd-pkg-'))
const secret = randomBytes(32).toString('hex')
const secretPath = join(scratch, 'secret')
await writeFile(secretPath, secret, { mode: 0o600 })

function request(socketPath, message) {
  return new Promise((resolveRequest, reject) => {
    const socket = connect(socketPath)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.setTimeout(1000, () =>
      socket.destroy(new Error('IPC request timed out')),
    )
    socket.once('error', reject)
    socket.once('connect', () => socket.write(`${JSON.stringify(message)}\n`))
    socket.on('data', (chunk) => {
      buffer += chunk
      if (!buffer.includes('\n')) return
      socket.end()
      try {
        resolveRequest(JSON.parse(buffer.slice(0, buffer.indexOf('\n'))))
      } catch (err) {
        reject(err)
      }
    })
  })
}

try {
  for (const platform of ['mac', 'linux', 'win']) {
    const unpacked = join(scratch, platform, 'app.asar.unpacked')
    const matchers = getFileMatchers(config, 'asarUnpack', unpacked, {
      defaultSrc: appDir,
      customBuildOptions: config[platform] ?? {},
      macroExpander: (value) => value,
      globalOutDir: join(appDir, 'dist'),
    })
    const filters = (matchers ?? []).map((matcher) => matcher.createFilter())
    for (const relative of await readdir(join(appDir, 'out'), {
      recursive: true,
    })) {
      const source = join(appDir, 'out', relative)
      const info = await stat(source)
      if (!info.isFile() || !filters.some((filter) => filter(source, info)))
        continue
      const destination = join(unpacked, 'out', relative)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(source, destination)
    }

    const socketPath =
      process.platform === 'win32'
        ? `\\\\.\\pipe\\mcxd-pkg-${process.pid}-${platform}`
        : join(scratch, `${platform}.sock`)
    const child = spawn(electron, [join(unpacked, 'out/helper/index.js')], {
      cwd: unpacked,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        MCXD_HELPER_SOCKET: socketPath,
        MCXD_HELPER_SECRET_FILE: secretPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    let spawnError
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (err) => {
      spawnError = err
    })
    try {
      let version
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        if (spawnError) throw spawnError
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`${platform} unpacked helper exited: ${stderr}`)
        }
        try {
          const response = await request(socketPath, {
            type: 'getVersion',
            secret,
            version: 'packaging-probe',
          })
          assert.equal(response.ok, true)
          version = response.version
          break
        } catch (err) {
          if (err.code !== 'ENOENT' && err.code !== 'ECONNREFUSED') throw err
          await delay(50)
        }
      }
      assert.ok(
        version,
        `${platform} unpacked helper did not become ready: ${stderr}`,
      )
      assert.deepEqual(
        await request(socketPath, { type: 'ping', secret, version }),
        {
          type: 'ping',
          ok: true,
          version,
        },
      )
      assert.deepEqual(
        await request(socketPath, { type: 'status', secret, version }),
        {
          type: 'status',
          ok: true,
          version,
          running: false,
        },
      )
      assert.equal(
        (
          await request(socketPath, {
            type: 'ping',
            secret: 'wrong-secret',
            version,
          })
        ).ok,
        false,
      )
      console.log(`Helper IPC passed with ${platform} asarUnpack rules`)
    } finally {
      if (child.exitCode === null && child.signalCode === null && !spawnError) {
        const exited = once(child, 'exit')
        const forceStop = setTimeout(() => child.kill('SIGKILL'), 2000)
        child.kill('SIGTERM')
        await exited
        clearTimeout(forceStop)
      }
    }
  }
} finally {
  await rm(scratch, { recursive: true, force: true })
}
