import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MIHOMO_VERSION } from './assets'
import { fetchKernel, listMihomoVersions } from './fetch-kernel'

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
      // the zip entry is the un-versioned full name, not the output binName
      expect(entry).toBe('mihomo-windows-amd64-compatible.exe')
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
    ).rejects.toThrow('404')
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
    ).not.toContain('-go')
  })

  it('uses an injected version for the download URL', async () => {
    const dest = tmp()
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(gzipSync(Buffer.from('bin')), { status: 200 })
    })
    const { binPath } = await fetchKernel('linux', 'arm64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
      version: 'v1.18.0',
    })
    expect(requested).toEqual([
      'https://github.com/MetaCubeX/mihomo/releases/download/v1.18.0/mihomo-linux-arm64-v1.18.0.gz',
    ])
    expect(binPath).toBe(join(dest, 'mihomo'))
  })

  it('defaults to MIHOMO_VERSION when no version is injected', async () => {
    const dest = tmp()
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(gzipSync(Buffer.from('bin')), { status: 200 })
    })
    await fetchKernel('linux', 'arm64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
    })
    expect(requested[0]).toContain(`/download/${MIHOMO_VERSION}/`)
  })
})

describe('listMihomoVersions', () => {
  afterEach(() => vi.restoreAllMocks())

  function releasesPayload() {
    return [
      { tag_name: 'Prerelease-Alpha' },
      { tag_name: 'v1.19.27' },
      { tag_name: 'v1.18.0' },
      { tag_name: 'v1.19.2' },
      { tag_name: 'v1.19.10' },
      { tag_name: 'latest' },
      { tag_name: 'v1.20.0-beta.1' },
    ]
  }

  it('parses, filters non-version tags, and sorts descending', async () => {
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(JSON.stringify(releasesPayload()), { status: 200 })
    })

    const versions = await listMihomoVersions({
      fetch: fakeFetch as unknown as typeof fetch,
    })

    expect(requested).toEqual([
      'https://api.github.com/repos/MetaCubeX/mihomo/releases',
    ])
    // Only semantic-version tags, newest first.
    expect(versions).toEqual([
      'v1.20.0-beta.1',
      'v1.19.27',
      'v1.19.10',
      'v1.19.2',
      'v1.18.0',
    ])
    // Drops the rolling prerelease + non-version tags.
    expect(versions).not.toContain('Prerelease-Alpha')
    expect(versions).not.toContain('latest')
  })

  it('sends a User-Agent header (GitHub API requires it)', async () => {
    let seenHeaders: Record<string, string> = {}
    const fakeFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      seenHeaders = (init?.headers ?? {}) as Record<string, string>
      return new Response(JSON.stringify(releasesPayload()), { status: 200 })
    })
    await listMihomoVersions({ fetch: fakeFetch as unknown as typeof fetch })
    expect(seenHeaders['User-Agent']).toBeTruthy()
  })

  it('authenticates GitHub release requests when a token is configured (#2135)', async () => {
    let seenHeaders: Record<string, string> = {}
    const fakeFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      seenHeaders = (init?.headers ?? {}) as Record<string, string>
      return new Response(JSON.stringify(releasesPayload()), { status: 200 })
    })

    await listMihomoVersions({
      fetch: fakeFetch as unknown as typeof fetch,
      githubToken: 'github-token',
    })

    expect(seenHeaders).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer github-token',
    })
  })

  it('throws on a non-200 response', async () => {
    const fakeFetch = vi.fn(
      async () => new Response('rate limited', { status: 403 }),
    )
    await expect(
      listMihomoVersions({ fetch: fakeFetch as unknown as typeof fetch }),
    ).rejects.toThrow('403')
  })
})
