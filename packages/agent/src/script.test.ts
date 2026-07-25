import { describe, expect, it } from 'vitest'
import { createScriptRunner } from './script'

describe('createScriptRunner — injected run', () => {
  it('delegates to the injected run', async () => {
    const calls: Array<{ code: string; input: unknown }> = []
    const runner = createScriptRunner({
      run: async (code, input) => {
        calls.push({ code, input })
        return { ...(input as object), patched: true }
      },
    })
    const out = await runner.run('whatever', { mode: 'rule' })
    expect(out).toEqual({ mode: 'rule', patched: true })
    expect(calls).toEqual([{ code: 'whatever', input: { mode: 'rule' } }])
  })
})

describe('createScriptRunner — default worker runner', () => {
  it('runs a trivial script that changes a key on the input config', async () => {
    const runner = createScriptRunner()
    const code = `export default function (config) {
      config.mode = 'global'
      config.added = 42
      return config
    }`
    const out = (await runner.run(code, {
      mode: 'rule',
      'mixed-port': 7890,
    })) as Record<string, unknown>
    expect(out).toEqual({ mode: 'global', 'mixed-port': 7890, added: 42 })
  })

  it('supports module.exports style scripts', async () => {
    const runner = createScriptRunner()
    const code = `module.exports = function (config) {
      config.touched = true
      return config
    }`
    const out = (await runner.run(code, { a: 1 })) as Record<string, unknown>
    expect(out).toEqual({ a: 1, touched: true })
  })

  it('ignores export-like text in comments and strings', async () => {
    const runner = createScriptRunner()
    const code = `// export default should not be rewritten here
      const note = 'export default is documentation'
      /* export default is also inert here */
      export default function (config) {
        config.note = note
        return config
      }`
    const out = (await runner.run(code, {})) as Record<string, unknown>
    expect(out).toEqual({ note: 'export default is documentation' })
  })

  it('terminates and throws when the script never returns (timeout)', async () => {
    const runner = createScriptRunner({ timeoutMs: 200 })
    const code = `export default function () {
      while (true) {}
    }`
    await expect(runner.run(code, { a: 1 })).rejects.toThrow('timed out')
  })

  it('rejects when the script throws', async () => {
    const runner = createScriptRunner()
    const code = `export default function () {
      throw new Error('boom from script')
    }`
    await expect(runner.run(code, {})).rejects.toThrow('boom from script')
  })

  it('rejects when the module does not export a function', async () => {
    const runner = createScriptRunner()
    const code = `export default 123`
    await expect(runner.run(code, {})).rejects.toThrow('function')
  })

  it('runs the dashboard-provided default script template unchanged (#2155)', async () => {
    // Mirrors DEFAULT_SCRIPT_CONTENT in packages/ui/constants/index.ts. New
    // script profiles ship with this so users don't start from an empty file
    // and discover the (config) => config contract by trial and error.
    const runner = createScriptRunner()
    const code = `// Script profile: transform the parsed mihomo config and return the result.
// The export MUST be a function (config) => config — a "main()" function
// (Clash Verge / FlClash style) will NOT work here. Return the config
// unchanged to start; mutate or replace it as needed.
//
// Example: force the routing mode to "rule".
//   export default (config) => {
//     config.mode = 'rule'
//     return config
//   }
export default (config) => {
  return config
}
`
    const input = { mode: 'global', 'mixed-port': 7890 }
    const out = (await runner.run(code, input)) as Record<string, unknown>
    expect(out).toEqual(input)
  })
})
