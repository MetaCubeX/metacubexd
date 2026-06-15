import { Worker } from 'node:worker_threads'

// ---------------------------------------------------------------------------
// SECURITY NOTE — READ BEFORE TOUCHING THIS FILE
//
// This module executes USER-SUPPLIED JavaScript to transform a parsed Clash /
// mihomo config object. It runs that code inside a node:worker_threads worker
// with a deliberately minimal global surface (no `require`, no `fetch`, no `fs`
// handed in) and enforces a wall-clock timeout that terminates the worker.
//
// This is NOT a hard security sandbox. node:worker_threads / node:vm do not
// provide a real trust boundary — a determined script can still reach Node
// internals or exhaust resources. Script profiles are a power-user feature for
// TRUSTED scripts the user wrote or vetted. Do not present this as a way to run
// arbitrary untrusted code safely.
// ---------------------------------------------------------------------------

/** A config transform: takes the parsed config object, returns the new one. */
export type ScriptRun = (code: string, input: unknown) => Promise<unknown>

export interface ScriptRunner {
  run: ScriptRun
}

export interface CreateScriptRunnerOptions {
  /** Override the executor (tests inject a fake so they never spawn a worker). */
  run?: ScriptRun
  /** Wall-clock budget per script; the worker is terminated past this. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

// Bootstrap that runs INSIDE the worker. Receives { code, input } via
// workerData, evaluates the user code as a CommonJS-ish module (so both
// `module.exports = fn` and `export default fn` work), calls the exported
// function with the input config, and posts the result back. Any throw is
// serialized and posted as an error so the parent can reject with a message.
//
// `export default <expr>` is rewritten to `module.exports = <expr>` because the
// user code is evaluated as a function body (where the `export` keyword is a
// syntax error). This is a pragmatic transform, not a full ESM parser.
const WORKER_BOOTSTRAP = `
const { parentPort, workerData } = require('node:worker_threads')
async function main() {
  const { code, input } = workerData
  const transformed = String(code).replace(
    /(^|[;\\n])\\s*export\\s+default\\s+/,
    '$1module.exports = ',
  )
  const moduleObj = { exports: {} }
  // Minimal surface: provide module/exports; do NOT forward require/fetch/fs.
  // eslint-disable-next-line no-new-func
  const factory = new Function('module', 'exports', transformed)
  factory(moduleObj, moduleObj.exports)
  const fn = moduleObj.exports
  if (typeof fn !== 'function') {
    throw new Error(
      'script profile must export a function (config) => config',
    )
  }
  const result = await fn(input)
  return result
}
main().then(
  (result) => { parentPort.postMessage({ ok: true, result }) },
  (err) => {
    parentPort.postMessage({
      ok: false,
      message: err && err.message ? String(err.message) : String(err),
    })
  },
)
`

type WorkerReply =
  | { ok: true; result: unknown }
  | { ok: false; message: string }

function runInWorker(timeoutMs: number): ScriptRun {
  return (code, input) =>
    new Promise<unknown>((resolve, reject) => {
      const worker = new Worker(WORKER_BOOTSTRAP, {
        eval: true,
        workerData: { code, input },
      })
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        void worker.terminate()
        fn()
      }
      const timer = setTimeout(() => {
        finish(() => reject(new Error(`script timed out after ${timeoutMs}ms`)))
      }, timeoutMs)
      worker.on('message', (msg: WorkerReply) => {
        if (msg.ok) finish(() => resolve(msg.result))
        else finish(() => reject(new Error(msg.message)))
      })
      worker.on('error', (err) => {
        finish(() =>
          reject(err instanceof Error ? err : new Error(String(err))),
        )
      })
      worker.on('exit', (codeNum) => {
        // Exit without a prior message/error means the worker died unexpectedly.
        if (codeNum !== 0) {
          finish(() =>
            reject(new Error(`script worker exited with code ${codeNum}`)),
          )
        }
      })
    })
}

export function createScriptRunner(
  opts: CreateScriptRunnerOptions = {},
): ScriptRunner {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const run = opts.run ?? runInWorker(timeoutMs)
  return { run }
}
