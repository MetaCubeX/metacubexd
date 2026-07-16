import { describe, expect, it, vi } from 'vitest'
import { checkForUpdates, isNewerVersion, parseVersion } from '../update-check'

describe('parseVersion', () => {
  it('parses plain and v-prefixed versions into numeric segments', () => {
    expect(parseVersion('1.266.1')).toEqual([1, 266, 1])
    expect(parseVersion('v2.0.10')).toEqual([2, 0, 10])
    expect(parseVersion(' V1.2 ')).toEqual([1, 2])
  })

  it('returns null for unparseable input', () => {
    expect(parseVersion('')).toBeNull()
    expect(parseVersion('nightly')).toBeNull()
    expect(parseVersion('v')).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it('compares segment-wise numerically', () => {
    expect(isNewerVersion('v1.267.0', '1.266.1')).toBe(true)
    expect(isNewerVersion('1.266.2', '1.266.1')).toBe(true)
    expect(isNewerVersion('2.0.0', '1.999.999')).toBe(true)
    expect(isNewerVersion('1.266.1', '1.266.1')).toBe(false)
    expect(isNewerVersion('1.266.0', '1.266.1')).toBe(false)
  })

  it('treats missing segments as zero (1.2 == 1.2.0)', () => {
    expect(isNewerVersion('1.2', '1.2.0')).toBe(false)
    expect(isNewerVersion('1.2.1', '1.2')).toBe(true)
  })

  it('resolves false when either side is unparseable (no phantom updates)', () => {
    expect(isNewerVersion('nightly', '1.0.0')).toBe(false)
    expect(isNewerVersion('1.0.1', 'dev')).toBe(false)
  })
})

describe('checkForUpdates', () => {
  const ok = (body: unknown) =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response

  it('reports an update when the latest tag is newer', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({
        tag_name: 'v1.267.0',
        html_url:
          'https://github.com/MetaCubeX/metacubexd/releases/tag/v1.267.0',
      }),
    ) as unknown as typeof fetch
    const result = await checkForUpdates(fetchImpl, '1.266.1')
    expect(result).toEqual({
      current: '1.266.1',
      latest: 'v1.267.0',
      hasUpdate: true,
      releaseUrl:
        'https://github.com/MetaCubeX/metacubexd/releases/tag/v1.267.0',
    })
  })

  it('reports no update when already on the latest', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ tag_name: 'v1.266.1', html_url: 'x' }),
    ) as unknown as typeof fetch
    const result = await checkForUpdates(fetchImpl, '1.266.1')
    expect(result.hasUpdate).toBe(false)
  })

  it('falls back to the stable releases page when html_url is absent', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ tag_name: 'v9.0.0' }),
    ) as unknown as typeof fetch
    const result = await checkForUpdates(fetchImpl, '1.0.0')
    expect(result.releaseUrl).toBe(
      'https://github.com/MetaCubeX/metacubexd/releases/latest',
    )
  })

  it('rejects on a non-ok HTTP response', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 403 }) as unknown as Response,
    ) as unknown as typeof fetch
    await expect(checkForUpdates(fetchImpl, '1.0.0')).rejects.toThrow('403')
  })

  it('rejects when the response carries no tag_name', async () => {
    const fetchImpl = vi.fn(async () => ok({})) as unknown as typeof fetch
    await expect(checkForUpdates(fetchImpl, '1.0.0')).rejects.toThrow(
      'tag_name',
    )
  })

  it('sends the GitHub accept header and a bounded timeout signal', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ tag_name: 'v1.0.0' }),
    ) as unknown as typeof fetch
    await checkForUpdates(fetchImpl, '1.0.0')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/MetaCubeX/metacubexd/releases/latest',
      expect.objectContaining({
        headers: { Accept: 'application/vnd.github+json' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('sends a bearer token when GitHub authentication is configured (#2135)', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ tag_name: 'v1.0.0' }),
    ) as unknown as typeof fetch

    await checkForUpdates(fetchImpl, '1.0.0', {
      githubToken: 'github-token',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.github.com/repos/MetaCubeX/metacubexd/releases/latest',
      expect.objectContaining({
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer github-token',
        },
      }),
    )
  })

  it('keeps accepting a custom API URL as the legacy third argument', async () => {
    const fetchImpl = vi.fn(async () =>
      ok({ tag_name: 'v1.0.0' }),
    ) as unknown as typeof fetch

    await checkForUpdates(fetchImpl, '1.0.0', 'https://github.example/latest')

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://github.example/latest',
      expect.any(Object),
    )
  })
})
