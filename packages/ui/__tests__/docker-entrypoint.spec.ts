import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const entrypoint = readFileSync(
  resolve(process.cwd(), 'docker-entrypoint.sh'),
  'utf8',
)

describe('docker-entrypoint', () => {
  it('does not mutate Nitro public assets at container startup', () => {
    expect(entrypoint).toContain('NUXT_PUBLIC_DEFAULT_BACKEND_URL')
    expect(entrypoint).toContain('NUXT_PUBLIC_GITHUB_TOKEN')
    expect(entrypoint).toContain('GITHUB_TOKEN')
    expect(entrypoint).not.toContain('/app/.output/public/config.js')
  })

  it('maps the documented DEFAULT_BACKEND_URL onto the Nuxt runtime var (#2155)', () => {
    // The README documents `DEFAULT_BACKEND_URL` as the operator-facing knob
    // for pre-filling the connect form. The entrypoint MUST keep mapping it
    // onto NUXT_PUBLIC_DEFAULT_BACKEND_URL — Nuxt's runtime-config path is
    // the only way to inject the value without rebuilding (rewriting the
    // static config.js truncates because Nitro pins Content-Length at build
    // time, see a3422496).
    expect(entrypoint).toContain('DEFAULT_BACKEND_URL')
    expect(entrypoint).toMatch(
      /NUXT_PUBLIC_DEFAULT_BACKEND_URL=.*DEFAULT_BACKEND_URL/,
    )
  })
})
