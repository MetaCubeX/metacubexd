import { describe, expect, it } from 'vitest'
import { resolveMihomoBinary } from '../binary-path'

const base = {
  isPackaged: false,
  resourcesPath: '/app/resources',
  appPath: '/repo/apps/desktop',
}

describe('resolveMihomoBinary', () => {
  it('uses resourcesPath when packaged (unix)', () => {
    expect(
      resolveMihomoBinary({ ...base, isPackaged: true, platform: 'darwin' }),
    ).toBe('/app/resources/mihomo')
  })

  it('uses appPath/resources when not packaged (dev, unix)', () => {
    expect(
      resolveMihomoBinary({ ...base, isPackaged: false, platform: 'linux' }),
    ).toBe('/repo/apps/desktop/resources/mihomo')
  })

  it('appends .exe on win32 (packaged)', () => {
    expect(
      resolveMihomoBinary({ ...base, isPackaged: true, platform: 'win32' }),
    ).toBe('/app/resources/mihomo.exe')
  })

  it('appends .exe on win32 (dev)', () => {
    expect(
      resolveMihomoBinary({ ...base, isPackaged: false, platform: 'win32' }),
    ).toBe('/repo/apps/desktop/resources/mihomo.exe')
  })

  it('user override always wins, verbatim, regardless of packaging/platform', () => {
    expect(
      resolveMihomoBinary({
        ...base,
        isPackaged: true,
        platform: 'win32',
        userOverride: '/Users/me/my-mihomo',
      }),
    ).toBe('/Users/me/my-mihomo')
  })

  it('ignores an empty-string override (treats as unset)', () => {
    expect(
      resolveMihomoBinary({
        ...base,
        isPackaged: true,
        platform: 'darwin',
        userOverride: '',
      }),
    ).toBe('/app/resources/mihomo')
  })
})
