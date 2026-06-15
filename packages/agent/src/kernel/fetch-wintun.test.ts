import { Buffer } from 'node:buffer'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchWintun,
  WINTUN_VERSION,
  wintunAsset,
  wintunZipEntry,
} from './fetch-wintun'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'mcxd-wintun-'))
}

describe('wintunAsset', () => {
  it('points at the pinned wintun.net builds zip', () => {
    const a = wintunAsset()
    expect(a.url).toBe(
      `https://www.wintun.net/builds/wintun-${WINTUN_VERSION}.zip`,
    )
  })

  it('accepts an explicit version override', () => {
    expect(wintunAsset('0.14.1').url).toBe(
      'https://www.wintun.net/builds/wintun-0.14.1.zip',
    )
  })
})

describe('wintunZipEntry', () => {
  it('selects the amd64 dll for x64/amd64', () => {
    expect(wintunZipEntry('x64')).toBe('wintun/bin/amd64/wintun.dll')
    expect(wintunZipEntry('amd64')).toBe('wintun/bin/amd64/wintun.dll')
  })

  it('selects the arm64 dll for arm64', () => {
    expect(wintunZipEntry('arm64')).toBe('wintun/bin/arm64/wintun.dll')
  })

  it('throws on an unsupported arch', () => {
    expect(() => wintunZipEntry('mips')).toThrow(/unsupported arch/i)
  })
})

describe('fetchWintun', () => {
  afterEach(() => vi.restoreAllMocks())

  it('downloads the zip and extracts the arch-correct wintun.dll', async () => {
    const dest = tmp()
    const dllBytes = Buffer.from('MZ-fake-wintun-dll')
    const requested: string[] = []
    const fakeFetch = vi.fn(async (url: string) => {
      requested.push(url)
      return new Response(Buffer.from('zip-archive-bytes'), { status: 200 })
    })
    const unzipEntry = vi.fn(async (_buf: Buffer, entry: string) => {
      expect(entry).toBe('wintun/bin/amd64/wintun.dll')
      return dllBytes
    })

    const { dllPath } = await fetchWintun('x64', dest, {
      fetch: fakeFetch as unknown as typeof fetch,
      unzipEntry,
    })

    expect(requested).toEqual([
      `https://www.wintun.net/builds/wintun-${WINTUN_VERSION}.zip`,
    ])
    expect(dllPath).toBe(join(dest, 'wintun.dll'))
    expect(readFileSync(dllPath)).toEqual(dllBytes)
    expect(unzipEntry).toHaveBeenCalledOnce()
  })

  it('throws on a non-200 response', async () => {
    const dest = tmp()
    const fakeFetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    )
    await expect(
      fetchWintun('x64', dest, {
        fetch: fakeFetch as unknown as typeof fetch,
        unzipEntry: async () => Buffer.from(''),
      }),
    ).rejects.toThrow(/404/)
  })
})
