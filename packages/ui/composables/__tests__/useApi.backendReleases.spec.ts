import { beforeEach, describe, expect, it, vi } from 'vitest'

import { backendReleaseAPI, fetchBackendReleasesAPI } from '../useApi'

const { githubGet, kyCreate } = vi.hoisted(() => ({
  githubGet: vi.fn(),
  kyCreate: vi.fn(),
}))

vi.mock('ky', () => ({
  default: {
    create: kyCreate,
    get: vi.fn(),
  },
}))

const VERNESONG_VERSION =
  'Mihomo Meta alpha-smart-6c49454 windows amd64 with go1.26.4 Wed Jun 24 17:02:10 UTC 2026\nUse tags: with_gvisor'

function responseJson(value: unknown) {
  return {
    json: vi.fn().mockResolvedValue(value),
  }
}

describe('composables/useApi backend release helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    kyCreate.mockReturnValue({ get: githubGet })
  })

  it('keeps regular alpha builds on the MetaCubeX/mihomo release feed', async () => {
    githubGet.mockReturnValue(
      responseJson({
        assets: [{ name: 'mihomo-windows-amd64-alpha-6c49454.zip' }],
        body: 'alpha notes',
      }),
    )

    const result = await backendReleaseAPI(
      'Mihomo Meta alpha-6c49454 windows amd64',
    )

    expect(result).toEqual({
      isUpdateAvailable: false,
      changelog: 'alpha notes',
    })
    expect(githubGet).toHaveBeenCalledWith(
      'repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha',
    )
  })

  it('checks vernesong alpha-smart builds against vernesong/mihomo', async () => {
    githubGet.mockReturnValue(
      responseJson({
        assets: [{ name: 'mihomo-windows-amd64-alpha-smart-6c49454.zip' }],
        body: 'smart notes',
      }),
    )

    const result = await backendReleaseAPI(VERNESONG_VERSION)

    expect(result).toEqual({
      isUpdateAvailable: false,
      changelog: 'smart notes',
    })
    expect(githubGet).toHaveBeenCalledWith(
      'repos/vernesong/mihomo/releases/tags/Prerelease-Alpha',
    )
  })

  it('does not use vernesong/mihomo for with_gvisor builds without -smart-', async () => {
    githubGet.mockReturnValue(
      responseJson({
        assets: [{ name: 'mihomo-windows-amd64-alpha-6c49454.zip' }],
        body: 'alpha notes',
      }),
    )

    await backendReleaseAPI(
      'Mihomo Meta alpha-6c49454 windows amd64\nUse tags: with_gvisor',
    )

    expect(githubGet).toHaveBeenCalledWith(
      'repos/MetaCubeX/mihomo/releases/tags/Prerelease-Alpha',
    )
  })

  it('marks the current vernesong alpha-smart release by asset suffix', async () => {
    githubGet.mockReturnValue(
      responseJson([
        {
          tag_name: 'LightGBM-Model',
          body: 'model notes',
          assets: [{ name: 'LightGBM-Model.txt' }],
          published_at: '2026-06-24T17:00:00Z',
        },
        {
          tag_name: 'Prerelease-Alpha',
          body: 'smart notes',
          assets: [{ name: 'mihomo-windows-amd64-alpha-smart-6c49454.zip' }],
          published_at: '2026-06-24T17:02:10Z',
        },
      ]),
    )

    const releases = await fetchBackendReleasesAPI(VERNESONG_VERSION)

    expect(githubGet).toHaveBeenCalledWith('repos/vernesong/mihomo/releases', {
      searchParams: { per_page: 20 },
    })
    expect(releases).toEqual([
      {
        version: 'Prerelease-Alpha',
        changelog: 'smart notes',
        publishedAt: '2026-06-24T17:02:10Z',
        isCurrent: true,
      },
    ])
  })
})
