import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUwpLoopback } from '../uwp-loopback'

interface ExecResult {
  stdout: string
  stderr: string
}

/**
 * Scripted mock exec: queue canned stdout (matched in order) and record every
 * command string issued. Defaults to empty stdout when the queue runs dry so
 * command-only assertions don't need to script returns. No test shells out.
 */
function makeExec(responses: string[] = []) {
  const calls: string[] = []
  const queue = [...responses]
  const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
    calls.push(cmd)
    return { stdout: queue.shift() ?? '', stderr: '' }
  })
  return { exec, calls }
}

// A realistic-ish slice of `CheckNetIsolation LoopbackExempt -s` output.
const LIST_OUTPUT = [
  'List Loopback Exempted AppContainers',
  '',
  '[1] -----------------------------------------------------------------',
  '    Name: microsoft.windowscommunicationsapps_8wekyb3d8bbwe',
  '    AppContainer Name: microsoft.windowscommunicationsapps_8wekyb3d8bbwe',
  '    SID: S-1-15-2-...',
  '',
].join('\r\n')

describe('createUwpLoopback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('windows (win32)', () => {
    it('list() runs CheckNetIsolation LoopbackExempt -s and returns stdout', async () => {
      const { exec, calls } = makeExec([LIST_OUTPUT])
      const uwp = createUwpLoopback({ platform: 'win32', exec })

      const out = await uwp.list()

      expect(calls).toEqual(['CheckNetIsolation LoopbackExempt -s'])
      expect(out).toBe(LIST_OUTPUT)
    })

    it('exempt(pkg) runs CheckNetIsolation LoopbackExempt -a -n=<pkg>', async () => {
      const { exec, calls } = makeExec()
      const uwp = createUwpLoopback({ platform: 'win32', exec })

      await uwp.exempt('microsoft.windowscommunicationsapps_8wekyb3d8bbwe')

      expect(calls).toEqual([
        'CheckNetIsolation LoopbackExempt -a -n=microsoft.windowscommunicationsapps_8wekyb3d8bbwe',
      ])
    })

    it('remove(pkg) runs CheckNetIsolation LoopbackExempt -d -n=<pkg>', async () => {
      const { exec, calls } = makeExec()
      const uwp = createUwpLoopback({ platform: 'win32', exec })

      await uwp.remove('microsoft.windowscommunicationsapps_8wekyb3d8bbwe')

      expect(calls).toEqual([
        'CheckNetIsolation LoopbackExempt -d -n=microsoft.windowscommunicationsapps_8wekyb3d8bbwe',
      ])
    })

    it('rejects an empty / whitespace package name without touching exec', async () => {
      const { exec, calls } = makeExec()
      const uwp = createUwpLoopback({ platform: 'win32', exec })

      await expect(uwp.exempt('')).rejects.toThrow('package name')
      await expect(uwp.exempt('   ')).rejects.toThrow('package name')
      await expect(uwp.remove('')).rejects.toThrow('package name')
      expect(calls).toEqual([])
    })
  })

  describe('non-win32 platforms', () => {
    it('list/exempt/remove throw a clear Windows-only error and never call exec', async () => {
      for (const platform of ['darwin', 'linux'] as const) {
        const { exec, calls } = makeExec()
        const uwp = createUwpLoopback({ platform, exec })

        await expect(uwp.list()).rejects.toThrow('Windows-only')
        await expect(uwp.exempt('SomePackage_abc')).rejects.toThrow(
          'Windows-only',
        )
        await expect(uwp.remove('SomePackage_abc')).rejects.toThrow(
          'Windows-only',
        )
        expect(calls).toEqual([])
      }
    })
  })

  it('defaults platform to process.platform when omitted', async () => {
    const { exec } = makeExec()
    // On this (non-win32) CI/dev machine the default-platform path must reject;
    // on a real Windows host it would call exec. We only assert the contract
    // that omitting `platform` falls back to the host platform.
    const uwp = createUwpLoopback({ exec })
    if (process.platform === 'win32') {
      await expect(uwp.list()).resolves.toBeDefined()
    } else {
      await expect(uwp.list()).rejects.toThrow('Windows-only')
    }
  })
})
