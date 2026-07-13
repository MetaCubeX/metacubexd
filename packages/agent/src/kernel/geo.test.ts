import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGeoAssets, GEO_ASSET_URLS } from './geo'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'mcxd-geo-'))
}

describe('fetchGeoAssets', () => {
  afterEach(() => vi.restoreAllMocks())

  it('downloads geoip.dat, geosite.dat and country.mmdb into destDir', async () => {
    const dest = tmp()
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(Buffer.from(`bytes-for:${url}`), { status: 200 })
    })

    const { files } = await fetchGeoAssets(dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })

    // Returns the three written file names.
    expect(files).toEqual(['geoip.dat', 'geosite.dat', 'country.mmdb'])

    // Hits exactly the canonical URL for each file.
    expect(requested).toEqual([
      GEO_ASSET_URLS['geoip.dat'],
      GEO_ASSET_URLS['geosite.dat'],
      GEO_ASSET_URLS['country.mmdb'],
    ])

    // Writes the fetched bytes into destDir under the correct names.
    for (const file of files) {
      expect(readFileSync(join(dest, file)).toString()).toBe(
        `bytes-for:${GEO_ASSET_URLS[file as keyof typeof GEO_ASSET_URLS]}`,
      )
    }
  })

  it('throws a clear error naming the file + status on a failing fetch', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(async (url: string) => {
      if (url === GEO_ASSET_URLS['geosite.dat']) {
        return new Response('not found', { status: 404 })
      }
      return new Response(Buffer.from('ok'), { status: 200 })
    })

    const error = await fetchGeoAssets(dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    }).catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('geosite.dat')
    expect((error as Error).message).toContain('404')
  })

  it('centralizes the canonical URLs in GEO_ASSET_URLS', () => {
    expect(GEO_ASSET_URLS['geoip.dat']).toBe(
      'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
    )
    expect(GEO_ASSET_URLS['geosite.dat']).toBe(
      'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    )
    expect(GEO_ASSET_URLS['country.mmdb'].endsWith('/country.mmdb')).toBe(true)
  })
})
