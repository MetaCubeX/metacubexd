import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { githubGet, kyCreate } = vi.hoisted(() => ({
  githubGet: vi.fn(),
  kyCreate: vi.fn(),
}))

vi.mock('ky', () => ({
  default: { create: kyCreate, get: vi.fn() },
}))

const VERNESONG_VERSION =
  'Mihomo Meta alpha-smart-6c49454 windows amd64 with go1.26.4 Wed Jun 24 17:02:10 UTC 2026\nUse tags: with_gvisor'
const HOUR = 60 * 60 * 1000
let api: typeof import('../useApi')

function release(
  overrides: Partial<{
    tag_name: string
    body: string | null
    assets: { name: string }[]
    published_at: string
    draft: boolean
    prerelease: boolean
  }> = {},
) {
  return {
    tag_name: 'v1.0.0',
    body: 'notes',
    assets: [] as { name: string }[],
    published_at: '2026-06-24T17:02:10Z',
    draft: false,
    prerelease: false,
    ...overrides,
  }
}

function responseJson(value: unknown) {
  return { json: vi.fn().mockResolvedValue(value) }
}

describe('composables/useApi release helpers', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    vi.resetModules()
    vi.clearAllMocks()
    delete (
      window as unknown as {
        __METACUBEXD_CONFIG__?: { githubToken?: string }
      }
    ).__METACUBEXD_CONFIG__
    delete (window as unknown as { metacubexd?: { githubToken?: string } })
      .metacubexd
    kyCreate.mockReturnValue({ get: githubGet })
    api = await import('../useApi')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the runtime GitHub token and media type headers when configured (#2135)', async () => {
    ;(
      window as unknown as {
        __METACUBEXD_CONFIG__: { githubToken: string }
      }
    ).__METACUBEXD_CONFIG__ = { githubToken: 'runtime-token' }
    githubGet.mockReturnValue(responseJson([release()]))

    await api.backendReleaseAPI('v1.0.0')

    const options = kyCreate.mock.calls[0]?.[0] as { headers: Headers }
    expect(options.headers.get('Accept')).toBe('application/vnd.github+json')
    expect(options.headers.get('Authorization')).toBe('Bearer runtime-token')
  })

  it('keeps GitHub release requests anonymous when no token is configured', async () => {
    githubGet.mockReturnValue(responseJson([release()]))

    await api.backendReleaseAPI('v1.0.0')

    const options = kyCreate.mock.calls[0]?.[0] as { headers: Headers }
    expect(options.headers.get('Accept')).toBe('application/vnd.github+json')
    expect(options.headers.has('Authorization')).toBe(false)
  })

  it('shares two requests between concurrent update checks and changelog lists', async () => {
    githubGet.mockReturnValue(responseJson([release({ tag_name: 'v1.1.0' })]))

    const [frontend, backend, frontendList, backendList] = await Promise.all([
      api.frontendReleaseAPI('v1.0.0'),
      api.backendReleaseAPI('v1.0.0'),
      api.fetchFrontendReleasesAPI('v1.0.0'),
      api.fetchBackendReleasesAPI('v1.0.0'),
    ])

    expect(githubGet).toHaveBeenCalledTimes(2)
    expect(githubGet).toHaveBeenCalledWith(
      'repos/MetaCubeX/metacubexd/releases?per_page=20',
      {
        cache: 'reload',
        retry: 0,
      },
    )
    expect(githubGet).toHaveBeenCalledWith(
      'repos/MetaCubeX/mihomo/releases?per_page=20',
      {
        cache: 'reload',
        retry: 0,
      },
    )
    expect(frontend).toEqual({ isUpdateAvailable: true, changelog: 'notes' })
    expect(backend).toEqual(frontend)
    expect(frontendList[0]?.version).toBe('v1.1.0')
    expect(backendList[0]?.version).toBe('v1.1.0')

    await api.frontendReleaseAPI('v1.1.0')
    expect(githubGet).toHaveBeenCalledTimes(2)
  })

  it('survives reloads and refreshes exactly one hour after the original fetch', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000)
    githubGet.mockReturnValue(responseJson([release()]))
    await api.frontendReleaseAPI('v1.0.0')

    vi.resetModules()
    api = await import('../useApi')
    now.mockReturnValue(100_000 + HOUR - 1)
    await api.frontendReleaseAPI('v1.0.0')
    expect(githubGet.mock.calls.map(([, options]) => options.cache)).toEqual([
      'reload',
      'force-cache',
    ])

    vi.resetModules()
    api = await import('../useApi')
    now.mockReturnValue(100_000 + HOUR)
    githubGet.mockReturnValue(responseJson([release({ tag_name: 'v1.1.0' })]))
    expect((await api.frontendReleaseAPI('v1.0.0')).isUpdateAvailable).toBe(
      true,
    )
    expect(githubGet.mock.calls.map(([, options]) => options.cache)).toEqual([
      'reload',
      'force-cache',
      'reload',
    ])
  })

  it('waits for the GitHub rate limit reset across repositories', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000)
    const error = {
      response: new Response(null, {
        status: 403,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '3600',
        },
      }),
    }
    githubGet.mockReturnValueOnce({ json: () => Promise.reject(error) })
    await expect(api.frontendReleaseAPI('v1.0.0')).rejects.toBe(error)
    now.mockReturnValue(3_599_999)
    await expect(api.backendReleaseAPI('v1.0.0')).rejects.toBe(error)
    expect(githubGet).toHaveBeenCalledOnce()
    now.mockReturnValue(3_600_000)
    githubGet.mockReturnValue(
      responseJson([
        release({ tag_name: 'LightGBM-Model' }),
        release({ tag_name: 'v2.0.0' }),
      ]),
    )
    expect((await api.backendReleaseAPI('v1.0.0')).isUpdateAvailable).toBe(true)
  })

  it('clears failed in-flight requests so a later attempt can recover', async () => {
    const error = new Error('403')
    githubGet.mockReturnValueOnce({ json: () => Promise.reject(error) })

    const failures = await Promise.allSettled([
      api.frontendReleaseAPI('v1.0.0'),
      api.fetchFrontendReleasesAPI('v1.0.0'),
    ])
    expect(failures.every((result) => result.status === 'rejected')).toBe(true)
    expect(githubGet).toHaveBeenCalledOnce()

    githubGet.mockReturnValue(responseJson([release()]))
    await api.frontendReleaseAPI('v1.0.0')
    expect(githubGet).toHaveBeenCalledTimes(2)
  })

  it('skips drafts and prereleases when checking stable updates', async () => {
    githubGet.mockReturnValue(
      responseJson([
        { ...release({ tag_name: 'v3.0.0', draft: true }), published_at: null },
        release({ tag_name: 'v2.0.0-beta', prerelease: true }),
        release({ tag_name: 'v1.0.0' }),
      ]),
    )

    expect((await api.frontendReleaseAPI('v1.0.0')).isUpdateAvailable).toBe(
      false,
    )
    expect((await api.backendReleaseAPI('v1.0.0')).isUpdateAvailable).toBe(
      false,
    )
    expect(
      (await api.fetchFrontendReleasesAPI('v1.0.0')).map((r) => r.version),
    ).toEqual(['v2.0.0-beta', 'v1.0.0'])
    expect(
      (await api.fetchBackendReleasesAPI('v1.0.0')).map((r) => r.version),
    ).toEqual(['v1.0.0'])
  })

  it.each([
    [
      'Mihomo Meta alpha-6c49454 windows amd64',
      'MetaCubeX/mihomo',
      'alpha-6c49454',
    ],
    [VERNESONG_VERSION, 'vernesong/mihomo', 'alpha-smart-6c49454'],
    [
      'Mihomo Meta alpha-6c49454 windows amd64\nUse tags: with_gvisor',
      'MetaCubeX/mihomo',
      'alpha-6c49454',
    ],
  ])(
    'checks %s using the matching repository and assets',
    async (version, repository, suffix) => {
      githubGet.mockReturnValue(
        responseJson([
          release({ tag_name: 'LightGBM-Model' }),
          release({
            tag_name: 'Prerelease-Alpha',
            body: 'alpha notes',
            prerelease: true,
            assets: [{ name: `mihomo-windows-amd64-${suffix}.zip` }],
          }),
        ]),
      )

      const [result, releases] = await Promise.all([
        api.backendReleaseAPI(version),
        api.fetchBackendReleasesAPI(version),
      ])
      expect(result).toEqual({
        isUpdateAvailable: false,
        changelog: 'alpha notes',
      })
      expect(releases).toEqual([
        {
          version: 'Prerelease-Alpha',
          changelog: 'alpha notes',
          publishedAt: '2026-06-24T17:02:10Z',
          isCurrent: true,
        },
      ])
      expect(githubGet).toHaveBeenCalledExactlyOnceWith(
        `repos/${repository}/releases?per_page=20`,
        {
          cache: 'reload',
          retry: 0,
        },
      )
    },
  )

  it('caches an alpha tag lookup when it is missing from the first page', async () => {
    githubGet
      .mockReturnValueOnce(responseJson([release()]))
      .mockReturnValueOnce(
        responseJson(
          release({
            tag_name: 'Prerelease-Alpha',
            prerelease: true,
            assets: [{ name: 'mihomo-alpha-smart-new.zip' }],
          }),
        ),
      )

    expect(
      (await api.backendReleaseAPI(VERNESONG_VERSION)).isUpdateAvailable,
    ).toBe(true)
    await api.backendReleaseAPI(VERNESONG_VERSION)
    expect(githubGet).toHaveBeenCalledTimes(2)
    expect(githubGet).toHaveBeenLastCalledWith(
      'repos/vernesong/mihomo/releases/tags/Prerelease-Alpha',
      { cache: 'reload', retry: 0 },
    )
  })

  it('caches the latest stable lookup when the first page only contains prereleases', async () => {
    githubGet
      .mockReturnValueOnce(responseJson([release({ prerelease: true })]))
      .mockReturnValueOnce(responseJson(release({ tag_name: 'v1.1.0' })))

    expect((await api.frontendReleaseAPI('v1.0.0')).isUpdateAvailable).toBe(
      true,
    )
    await api.frontendReleaseAPI('v1.0.0')
    expect(githubGet).toHaveBeenCalledTimes(2)
    expect(githubGet).toHaveBeenLastCalledWith(
      'repos/MetaCubeX/metacubexd/releases/latest',
      { cache: 'reload', retry: 0 },
    )
  })

  it('keeps meta builds on the stable release feed and compares asset suffixes', async () => {
    githubGet.mockReturnValue(
      responseJson([
        release({
          assets: [{ name: 'mihomo-meta-6c49454.zip' }],
        }),
      ]),
    )

    expect(
      (await api.backendReleaseAPI('meta-6c49454')).isUpdateAvailable,
    ).toBe(false)
    expect(
      (await api.fetchBackendReleasesAPI('meta-6c49454'))[0]?.isCurrent,
    ).toBe(true)
    expect(githubGet).toHaveBeenCalledOnce()
  })

  it('does not query Mihomo releases for sing-box or unsupported beta builds', async () => {
    expect(await api.backendReleaseAPI('sing-box 1.12.0')).toEqual({
      isUpdateAvailable: false,
    })
    expect(await api.fetchBackendReleasesAPI('sing-box 1.12.0')).toEqual([])
    expect(await api.backendReleaseAPI('beta-old')).toEqual({
      isUpdateAvailable: false,
    })
    expect(await api.fetchBackendReleasesAPI('beta-old')).toEqual([])
    expect(githubGet).not.toHaveBeenCalled()
  })

  it('limits changelog lists and handles releases without notes', async () => {
    githubGet.mockReturnValue(
      responseJson([release({ body: null }), release({ tag_name: 'v0.9.0' })]),
    )

    const list = await api.fetchFrontendReleasesAPI('v1.0.0', 1)
    expect(list).toHaveLength(1)
    expect(list[0]?.changelog).toBe('')
    expect((await api.frontendReleaseAPI('v1.0.0')).changelog).toBe('')
    expect(githubGet).toHaveBeenCalledOnce()
  })
})
