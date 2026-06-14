import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MIHOMO_VERSION } from './assets'
import { fetchKernel } from './fetch-kernel'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'mcxd-fetch-'))
}

describe('fetchKernel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('linux/arm64: hits the exact pinned .gz URL and gunzips the raw binary', async () => {
    const dest = tmp()
    const rawBinary = Buffer.from('\x7FELF-fake-mihomo-binary')
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(gzipSync(rawBinary), { status: 200 })
    })

    const { binPath } = await fetchKernel('linux', 'arm64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })

    expect(requested).toEqual([
      `https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/mihomo-linux-arm64-${MIHOMO_VERSION}.gz`,
    ])
    expect(binPath).toBe(join(dest, 'mihomo'))
    // The written file is the RAW binary (gunzipped), NOT the gz bytes and NOT a tar.
    expect(readFileSync(binPath)).toEqual(rawBinary)
  })

  it('linux/amd64: uses the -compatible asset', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(
      async () => new Response(gzipSync(Buffer.from('bin')), { status: 200 }),
    )
    await fetchKernel('linux', 'amd64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })
    expect(
      (
        fakeFetch.mock.calls as unknown as [string][][]
      )[0]![0] as unknown as string,
    ).toContain(`mihomo-linux-amd64-compatible-${MIHOMO_VERSION}.gz`)
  })

  it('chmods the binary 0o755 on posix', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(
      async () => new Response(gzipSync(Buffer.from('bin')), { status: 200 }),
    )
    const { binPath } = await fetchKernel('darwin', 'arm64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })
    if (process.platform !== 'win32') {
      expect(statSync(binPath).mode & 0o777).toBe(0o755)
    }
  })

  it('windows: unzips and extracts mihomo.exe via injected unzipEntry', async () => {
    const dest = tmp()
    const exeBytes = Buffer.from('MZ-fake-exe')
    const fakeFetch = vi.fn(
      async () =>
        new Response(Buffer.from('zip-archive-bytes'), { status: 200 }),
    )
    const unzipEntry = vi.fn(async (_buf: Buffer, entry: string) => {
      expect(entry).toBe('mihomo.exe')
      return exeBytes
    })
    const { binPath } = await fetchKernel('win32', 'amd64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
      unzipEntry,
    })
    expect(binPath).toBe(join(dest, 'mihomo.exe'))
    expect(readFileSync(binPath)).toEqual(exeBytes)
    expect(unzipEntry).toHaveBeenCalledOnce()
  })

  it('throws on non-200 response', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    )
    await expect(
      fetchKernel('linux', 'arm64', dest, {
        fetch: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/404/)
  })

  it('never targets a legacy -go1xx asset name', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(
      async () => new Response(gzipSync(Buffer.from('bin')), { status: 200 }),
    )
    await fetchKernel('linux', 'arm64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })
    expect(
      (
        fakeFetch.mock.calls as unknown as [string][][]
      )[0]![0] as unknown as string,
    ).not.toMatch(/-go\d/)
  })
})
