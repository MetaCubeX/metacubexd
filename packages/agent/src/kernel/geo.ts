import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Canonical download sources for mihomo's default geo data. Centralized so the
 * exact URL per file is asserted in tests and easy to bump.
 *
 * geoip.dat / geosite.dat / country.mmdb all ship from meta-rules-dat's rolling
 * `latest` release, which is the source mihomo documents for its default geodata.
 */
export const GEO_ASSET_URLS = {
  'geoip.dat':
    'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
  'geosite.dat':
    'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
  'country.mmdb':
    'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb',
} as const

export type GeoAssetFile = keyof typeof GEO_ASSET_URLS

const GEO_FILES = Object.keys(GEO_ASSET_URLS) as GeoAssetFile[]

export interface FetchGeoAssetsDeps {
  fetch?: typeof fetch
}

/**
 * Download mihomo's default geo data (geoip.dat, geosite.dat, country.mmdb) into
 * `destDir` (the kernel home dir). `fetch` is injectable for tests; a non-OK
 * response throws a clear error naming the file and status. Returns the list of
 * written file names.
 */
export async function fetchGeoAssets(
  destDir: string,
  deps: FetchGeoAssetsDeps = {},
): Promise<{ files: string[] }> {
  const doFetch = deps.fetch ?? fetch
  await mkdir(destDir, { recursive: true })

  const files: string[] = []
  for (const file of GEO_FILES) {
    const url = GEO_ASSET_URLS[file]
    const res = await doFetch(url)
    if (!res.ok) {
      throw new Error(
        `fetchGeoAssets: download failed ${res.status} for ${file} (${url})`,
      )
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    await writeFile(join(destDir, file), bytes)
    files.push(file)
  }
  return { files }
}
