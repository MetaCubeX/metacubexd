import type { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Extract a single entry from a .zip buffer by shelling out to the platform's
 * `unzip` (ships on macOS/Linux runners; Windows runners have bsdtar via
 * `tar`). Injected as a fake in unit tests; the default path is covered by
 * MANUAL smoke testing.
 */
export async function unzipEntry(buf: Buffer, entry: string): Promise<Buffer> {
  const { mkdtemp, readFile, rm, writeFile } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const dir = await mkdtemp(join(tmpdir(), 'mcxd-unzip-'))
  const zipPath = join(dir, 'archive.zip')
  try {
    await writeFile(zipPath, buf)
    await execFileAsync('unzip', ['-o', zipPath, entry, '-d', dir])
    return await readFile(join(dir, entry))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
