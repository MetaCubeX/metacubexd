import { describe, expect, it } from 'vitest'
import { resolveHelperEntry } from '../helper/paths'

const base = {
  resourcesPath: '/app/resources',
  appPath: '/repo/apps/desktop',
}

describe('resolveHelperEntry', () => {
  it('packaged -> the asarUnpack-ed helper entry under resourcesPath', () => {
    expect(resolveHelperEntry({ ...base, isPackaged: true })).toBe(
      '/app/resources/app.asar.unpacked/out/helper/index.js',
    )
  })

  it('dev -> <appPath>/out/helper/index.js', () => {
    expect(resolveHelperEntry({ ...base, isPackaged: false })).toBe(
      '/repo/apps/desktop/out/helper/index.js',
    )
  })
})
