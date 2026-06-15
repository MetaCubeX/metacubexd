import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Pinned wintun.dll release. mihomo's Windows TUN backend needs wintun.dll next
 * to the kernel; the canonical distribution is the upstream wintun.net builds
 * zip. Override with the WINTUN_VERSION env for a bump.
 */
export const WINTUN_VERSION = process.env.WINTUN_VERSION ?? '0.14.1'

const ARCH_MAP: Record<string, 'amd64' | 'arm64'> = {
  x64: 'amd64',
  amd64: 'amd64',
  arm64: 'arm64',
}

export interface WintunAsset {
  /** Canonical wintun.net builds zip URL. */
  url: string
}

/** The canonical wintun.net builds zip for a version. */
export function wintunAsset(version: string = WINTUN_VERSION): WintunAsset {
  return { url: `https://www.wintun.net/builds/wintun-${version}.zip` }
}

/**
 * The arch-correct zip entry holding wintun.dll inside the wintun.net zip
 * (layout: `wintun/bin/<arch>/wintun.dll`). Throws on an unsupported arch.
 */
export function wintunZipEntry(arch: string): string {
  const a = ARCH_MAP[arch]
  if (!a) throw new Error(`unsupported arch: ${arch}`)
  return `wintun/bin/${a}/wintun.dll`
}

export interface FetchWintunDeps {
  fetch?: typeof fetch
  /** wintun release version to download; defaults to WINTUN_VERSION. */
  version?: string
  /**
   * Extract a single entry from a .zip buffer. Injected in tests; the default
   * shells out to the platform's unzip and is covered by MANUAL smoke testing.
   */
  unzipEntry?: (buf: Buffer, entry: string) => Promise<Buffer>
}

async function defaultUnzipEntry(buf: Buffer, entry: string): Promise<Buffer> {
  const {
    mkdtemp,
    readFile,
    rm,
    writeFile: wf,
  } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const dir = await mkdtemp(join(tmpdir(), 'mcxd-wintun-unzip-'))
  const zipPath = join(dir, 'wintun.zip')
  try {
    await wf(zipPath, buf)
    // `unzip` ships on macOS/Linux runners; Windows runners have `tar` (bsdtar) which reads zip.
    await execFileAsync('unzip', ['-o', zipPath, entry, '-d', dir])
    return await readFile(join(dir, entry))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Download the wintun.dll for the given Windows arch into `destDir` (writes
 * `<destDir>/wintun.dll`). `fetch`/`unzipEntry`/`version` are injectable for
 * tests. Idempotency (skip-if-present) is the caller's concern, mirroring
 * fetch-mihomo's staging script.
 */
export async function fetchWintun(
  arch: string,
  destDir: string,
  deps: FetchWintunDeps = {},
): Promise<{ dllPath: string }> {
  const doFetch = deps.fetch ?? fetch
  const unzipEntry = deps.unzipEntry ?? defaultUnzipEntry
  const asset = wintunAsset(deps.version ?? WINTUN_VERSION)
  const entry = wintunZipEntry(arch)

  const res = await doFetch(asset.url)
  if (!res.ok) {
    throw new Error(
      `fetchWintun: download failed ${res.status} for ${asset.url}`,
    )
  }
  const downloaded = Buffer.from(await res.arrayBuffer())
  const dll = await unzipEntry(downloaded, entry)

  await mkdir(destDir, { recursive: true })
  const dllPath = join(destDir, 'wintun.dll')
  await writeFile(dllPath, dll)
  return { dllPath }
}
