import type { FsLike } from '../paths'
import type { UpdateCheckResult } from '../update-check'
import { describe, expect, it, vi } from 'vitest'
import { CHECK_INTERVAL_MS, runSilentUpdateCheck } from '../silent-update'

const STATE_PATH = '/data/update-check-state.json'

function fakeFs(files: Record<string, string>): FsLike {
  return {
    existsSync: (p) => p in files,
    mkdirSync: () => {},
    readFileSync: (p) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    writeFileSync: (p: string, data: string) => {
      files[p] = data
    },
  }
}

function result(over: Partial<UpdateCheckResult> = {}): UpdateCheckResult {
  return {
    current: '1.0.0',
    latest: '1.1.0',
    hasUpdate: true,
    releaseUrl: 'https://example.test/releases/latest',
    ...over,
  }
}

describe('runSilentUpdateCheck', () => {
  it('notifies once when a newer version exists and records the check', async () => {
    const files: Record<string, string> = {}
    const notifyUpdate = vi.fn()
    const outcome = await runSilentUpdateCheck({
      check: async () => result(),
      statePath: STATE_PATH,
      fs: fakeFs(files),
      notifyUpdate,
      now: () => 1_000,
    })
    expect(outcome).toBe('notified')
    expect(notifyUpdate).toHaveBeenCalledOnce()
    const persisted = JSON.parse(files[STATE_PATH]!)
    expect(persisted).toMatchObject({
      lastCheckedAt: 1_000,
      lastNotifiedVersion: '1.1.0',
    })
  })

  it('does not notify for a version already announced', async () => {
    const files: Record<string, string> = {
      [STATE_PATH]: JSON.stringify({ lastNotifiedVersion: '1.1.0' }),
    }
    const notifyUpdate = vi.fn()
    const outcome = await runSilentUpdateCheck({
      check: async () => result(),
      statePath: STATE_PATH,
      fs: fakeFs(files),
      notifyUpdate,
      now: () => 5_000,
    })
    expect(outcome).toBe('already-notified')
    expect(notifyUpdate).not.toHaveBeenCalled()
  })

  it('throttles a second check inside the 24h window', async () => {
    const files: Record<string, string> = {
      [STATE_PATH]: JSON.stringify({ lastCheckedAt: 1_000 }),
    }
    const check = vi.fn(async () => result())
    const outcome = await runSilentUpdateCheck({
      check,
      statePath: STATE_PATH,
      fs: fakeFs(files),
      notifyUpdate: vi.fn(),
      now: () => 1_000 + CHECK_INTERVAL_MS - 1,
    })
    expect(outcome).toBe('throttled')
    expect(check).not.toHaveBeenCalled()
  })

  it('checks again once the window elapsed', async () => {
    const files: Record<string, string> = {
      [STATE_PATH]: JSON.stringify({ lastCheckedAt: 1_000 }),
    }
    const outcome = await runSilentUpdateCheck({
      check: async () => result({ hasUpdate: false, latest: '1.0.0' }),
      statePath: STATE_PATH,
      fs: fakeFs(files),
      notifyUpdate: vi.fn(),
      now: () => 1_000 + CHECK_INTERVAL_MS,
    })
    expect(outcome).toBe('no-update')
  })

  it('swallows a failing check and does not advance the timestamp', async () => {
    const files: Record<string, string> = {}
    const outcome = await runSilentUpdateCheck({
      check: async () => {
        throw new Error('network down')
      },
      statePath: STATE_PATH,
      fs: fakeFs(files),
      notifyUpdate: vi.fn(),
      now: () => 1_000,
    })
    expect(outcome).toBe('failed')
    // No state written → the next launch retries immediately.
    expect(files[STATE_PATH]).toBeUndefined()
  })
})
