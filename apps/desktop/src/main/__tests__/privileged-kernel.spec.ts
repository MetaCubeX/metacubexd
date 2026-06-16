import type { ChildProcess } from 'node:child_process'
import type { StatPathFn } from '../../helper/index'
import { describe, expect, it, vi } from 'vitest'
import {
  assertSafeKernelPaths,
  createPrivilegedKernel,
  resolveHelperSecret,
} from '../../helper/index'

// Minimal ChildProcess double: never spawns a real process.
function fakeProc(): ChildProcess {
  return {
    exitCode: null,
    killed: false,
    kill: vi.fn(),
    on: vi.fn(),
  } as unknown as ChildProcess
}

const GOOD = {
  binaryPath: '/opt/app/resources/mihomo',
  homeDir: '/home/user/.config/mcxd',
  configPath: '/home/user/.config/mcxd/config.yaml',
}

// A regular, non-group/world-writable file (0o755).
const okStat: StatPathFn = () => ({ isFile: true, mode: 0o755 })

describe('createPrivilegedKernel.start — spawn-path validation', () => {
  it('spawns mihomo with -d/-f when the paths are valid', async () => {
    const spawn = vi.fn(() => fakeProc())
    const kernel = createPrivilegedKernel({
      spawn,
      statPath: okStat,
      platform: 'linux',
    })
    const res = await kernel.start(GOOD)
    expect(res.ok).toBe(true)
    expect(spawn).toHaveBeenCalledWith(
      GOOD.binaryPath,
      ['-d', GOOD.homeDir, '-f', GOOD.configPath],
      expect.objectContaining({ stdio: 'ignore' }),
    )
  })

  it('rejects a relative binaryPath (never spawns)', async () => {
    const spawn = vi.fn(() => fakeProc())
    const kernel = createPrivilegedKernel({
      spawn,
      statPath: okStat,
      platform: 'linux',
    })
    await expect(
      kernel.start({ ...GOOD, binaryPath: 'mihomo' }),
    ).rejects.toThrow(/absolute path/i)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('rejects a relative homeDir / configPath', async () => {
    const kernel = createPrivilegedKernel({
      statPath: okStat,
      platform: 'linux',
    })
    await expect(kernel.start({ ...GOOD, homeDir: '../etc' })).rejects.toThrow(
      /homeDir must be an absolute path/i,
    )
    await expect(
      kernel.start({ ...GOOD, configPath: 'config.yaml' }),
    ).rejects.toThrow(/configPath must be an absolute path/i)
  })

  it('rejects a binaryPath that does not exist', async () => {
    const spawn = vi.fn(() => fakeProc())
    const kernel = createPrivilegedKernel({
      spawn,
      statPath: () => {
        throw new Error('ENOENT')
      },
      platform: 'linux',
    })
    await expect(kernel.start(GOOD)).rejects.toThrow(/does not exist/i)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('rejects a binaryPath that is not a regular file', async () => {
    const kernel = createPrivilegedKernel({
      statPath: () => ({ isFile: false, mode: 0o755 }),
      platform: 'linux',
    })
    await expect(kernel.start(GOOD)).rejects.toThrow(/not a regular file/i)
  })

  it('rejects a group/world-writable binary on POSIX (anti-planting)', async () => {
    const spawn = vi.fn(() => fakeProc())
    const kernel = createPrivilegedKernel({
      spawn,
      statPath: () => ({ isFile: true, mode: 0o757 }),
      platform: 'linux',
    })
    await expect(kernel.start(GOOD)).rejects.toThrow(/group\/world-writable/i)
    expect(spawn).not.toHaveBeenCalled()
  })

  it('skips the POSIX writable-bit check on win32 (synthetic mode bits)', async () => {
    const spawn = vi.fn(() => fakeProc())
    const kernel = createPrivilegedKernel({
      spawn,
      // 0o666 would trip the POSIX check, but Windows mode bits are synthetic.
      // (Paths stay POSIX-absolute so node:path.isAbsolute passes on the runner;
      // the `platform` flag is what gates the writable-bit check.)
      statPath: () => ({ isFile: true, mode: 0o666 }),
      platform: 'win32',
    })
    const res = await kernel.start(GOOD)
    expect(res.ok).toBe(true)
    expect(spawn).toHaveBeenCalledOnce()
  })
})

describe('assertSafeKernelPaths', () => {
  it('passes for valid absolute paths + a normal file', () => {
    expect(() => assertSafeKernelPaths(GOOD, okStat, 'linux')).not.toThrow()
  })

  it('throws for an empty binaryPath', () => {
    expect(() =>
      assertSafeKernelPaths({ ...GOOD, binaryPath: '' }, okStat, 'linux'),
    ).toThrow(/absolute path/i)
  })
})

describe('resolveHelperSecret', () => {
  const readOk = (p: string) => `secret-from:${p}`

  it('reads the secret from MCXD_HELPER_SECRET_FILE when set', () => {
    const env = { MCXD_HELPER_SECRET_FILE: '/etc/mcxd/helper.secret' }
    expect(resolveHelperSecret(env, readOk)).toBe(
      'secret-from:/etc/mcxd/helper.secret',
    )
  })

  it('prefers the file over the inline env var', () => {
    const env = {
      MCXD_HELPER_SECRET_FILE: '/etc/mcxd/helper.secret',
      MCXD_HELPER_SECRET: 'inline-old',
    }
    expect(resolveHelperSecret(env, () => 'from-file')).toBe('from-file')
  })

  it('falls back to MCXD_HELPER_SECRET when no file is configured (upgrade-skew)', () => {
    expect(resolveHelperSecret({ MCXD_HELPER_SECRET: 'inline' }, readOk)).toBe(
      'inline',
    )
  })

  it('throws when the secret file cannot be read', () => {
    const env = { MCXD_HELPER_SECRET_FILE: '/etc/mcxd/helper.secret' }
    expect(() =>
      resolveHelperSecret(env, () => {
        throw new Error('EACCES')
      }),
    ).toThrow(/cannot read MCXD_HELPER_SECRET_FILE/i)
  })

  it('throws when the secret file is empty (no auth against a blank secret)', () => {
    const env = { MCXD_HELPER_SECRET_FILE: '/etc/mcxd/helper.secret' }
    expect(() => resolveHelperSecret(env, () => '')).toThrow(/is empty/i)
  })

  it('throws when neither a file nor an inline secret is set', () => {
    expect(() => resolveHelperSecret({}, readOk)).toThrow(/no shared secret/i)
  })
})
