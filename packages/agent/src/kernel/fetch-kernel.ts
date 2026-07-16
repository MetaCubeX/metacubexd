import { Buffer } from 'node:buffer'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { MIHOMO_VERSION, mihomoAsset } from './assets'
import { unzipEntry as defaultUnzipEntry } from './unzip-entry'

export interface FetchKernelDeps {
  fetch?: typeof fetch
  /** mihomo release tag to download; defaults to MIHOMO_VERSION. */
  version?: string
  /**
   * Extract a single entry from a .zip buffer. Injected in tests; the default
   * shells out to the platform's unzip and is covered by MANUAL smoke testing.
   */
  unzipEntry?: (buf: Buffer, entry: string) => Promise<Buffer>
}

export async function fetchKernel(
  os: string,
  arch: string,
  destDir: string,
  deps: FetchKernelDeps = {},
): Promise<{ binPath: string }> {
  const doFetch = deps.fetch ?? fetch
  const unzipEntry = deps.unzipEntry ?? defaultUnzipEntry
  const asset = mihomoAsset(os, arch, deps.version ?? MIHOMO_VERSION)

  const res = await doFetch(asset.url)
  if (!res.ok) {
    throw new Error(
      `fetchKernel: download failed ${res.status} for ${asset.url}`,
    )
  }
  const downloaded = Buffer.from(await res.arrayBuffer())

  let binary: Buffer
  if (asset.ext === 'gz') {
    // .gz is a RAW single-file binary — gunzip, NEVER tar.
    binary = gunzipSync(downloaded)
  } else {
    // .zip — extract the archive's binary entry (its name differs from binName).
    binary = await unzipEntry(downloaded, asset.zipEntry ?? asset.binName)
  }

  await mkdir(destDir, { recursive: true })
  const binPath = join(destDir, asset.binName)
  await writeFile(binPath, binary)
  if (process.platform !== 'win32') {
    await chmod(binPath, 0o755)
  }
  return { binPath }
}

const RELEASES_URL = 'https://api.github.com/repos/MetaCubeX/mihomo/releases'
// Keep `vX.Y...` tags; drop the rolling 'Prerelease-Alpha' and any non-version tags.

function isAsciiDigits(value: string): boolean {
  if (!value) return false
  for (const char of value) {
    if (char < '0' || char > '9') return false
  }
  return true
}

function isVersionTag(tag: string): boolean {
  if (!tag.startsWith('v')) return false
  const prereleaseIndex = tag.indexOf('-')
  const core = tag.slice(
    1,
    prereleaseIndex === -1 ? undefined : prereleaseIndex,
  )
  const parts = core.split('.')
  return parts.length >= 2 && parts.every(isAsciiDigits)
}

interface GithubRelease {
  tag_name?: string
}

/** Compare two `v\d+.\d+.\d+...` tags numerically, descending. */
function compareTagsDesc(a: string, b: string): number {
  const parse = (t: string) =>
    t
      .slice(1)
      .replaceAll('-', '.')
      .split('.')
      .map((p) => Number.parseInt(p, 10))
  const pa = parse(a)
  const pb = parse(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    // Pre-release segments (NaN) sort below their release counterpart.
    if (Number.isNaN(x) && Number.isNaN(y)) continue
    if (Number.isNaN(x)) return 1
    if (Number.isNaN(y)) return -1
    if (x !== y) return y - x
  }
  return b.localeCompare(a)
}

/**
 * List installable mihomo kernel versions from GitHub releases, newest first.
 * Filters to semantic-version tags only. `fetch` is injectable for tests.
 */
export async function listMihomoVersions(
  deps: { fetch?: typeof fetch; githubToken?: string } = {},
): Promise<string[]> {
  const doFetch = deps.fetch ?? fetch
  const headers: Record<string, string> = {
    'User-Agent': 'metacubexd-agent',
    Accept: 'application/vnd.github+json',
  }
  if (deps.githubToken) {
    headers.Authorization = `Bearer ${deps.githubToken}`
  }
  const res = await doFetch(RELEASES_URL, {
    headers,
  })
  if (!res.ok) {
    throw new Error(
      `listMihomoVersions: failed ${res.status} for ${RELEASES_URL}`,
    )
  }
  const releases = (await res.json()) as GithubRelease[]
  return releases
    .map((r) => r.tag_name)
    .filter((t): t is string => typeof t === 'string' && isVersionTag(t))
    .sort(compareTagsDesc)
}
