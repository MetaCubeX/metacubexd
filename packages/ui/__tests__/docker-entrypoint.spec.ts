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
})
