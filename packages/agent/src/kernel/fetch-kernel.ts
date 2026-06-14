import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { MIHOMO_VERSION, mihomoAsset } from './assets'

const execFileAsync = promisify(execFile)

export interface FetchKernelDeps {
  fetch?: typeof fetch
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
  const dir = await mkdtemp(join(tmpdir(), 'mcxd-unzip-'))
  const zipPath = join(dir, 'kernel.zip')
  try {
    await wf(zipPath, buf)
    // `unzip` ships on macOS/Linux runners; Windows runners have `tar` (bsdtar) which reads zip.
    await execFileAsync('unzip', ['-o', zipPath, entry, '-d', dir])
    return await readFile(join(dir, entry))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function fetchKernel(
  os: string,
  arch: string,
  destDir: string,
  deps: FetchKernelDeps = {},
): Promise<{ binPath: string }> {
  const doFetch = deps.fetch ?? fetch
  const unzipEntry = deps.unzipEntry ?? defaultUnzipEntry
  const asset = mihomoAsset(os, arch, MIHOMO_VERSION)

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
    // .zip — extract the single binName entry.
    binary = await unzipEntry(downloaded, asset.binName)
  }

  await mkdir(destDir, { recursive: true })
  const binPath = join(destDir, asset.binName)
  await writeFile(binPath, binary)
  if (process.platform !== 'win32') {
    await chmod(binPath, 0o755)
  }
  return { binPath }
}
