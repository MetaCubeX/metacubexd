import type { FsLike } from '../paths'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SYSPROXY_BYPASS,
  readSysProxyBypass,
  writeSysProxyBypass,
} from '../sysproxy-config'

/** Build a fake FsLike from an in-memory map of path -> contents. */
function fakeFs(files: Record<string, string>): FsLike {
  return {
    existsSync: (p) => p in files,
    mkdirSync: () => {},
    readFileSync: (p) => {
      const v = files[p]
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    writeFileSync: (p, data) => {
      files[p] = data
    },
  }
}

describe('default sysproxy bypass', () => {
  it('covers loopback, IPv6 loopback, the RFC1918 private ranges and <local>', () => {
    expect(DEFAULT_SYSPROXY_BYPASS).toEqual([
      'localhost',
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '<local>',
    ])
  })
})

describe('readSysProxyBypass', () => {
  const PATH = '/userData/sysproxy.json'

  it('returns the defaults when the settings file is missing', () => {
    const fs = fakeFs({})
    expect(readSysProxyBypass(PATH, fs)).toEqual(DEFAULT_SYSPROXY_BYPASS)
  })

  it('returns the persisted bypass list when present', () => {
    const fs = fakeFs({
      [PATH]: JSON.stringify({ bypass: ['localhost', 'example.com'] }),
    })
    expect(readSysProxyBypass(PATH, fs)).toEqual(['localhost', 'example.com'])
  })

  it('falls back to the defaults when the JSON is malformed', () => {
    const fs = fakeFs({ [PATH]: '{ not json' })
    expect(readSysProxyBypass(PATH, fs)).toEqual(DEFAULT_SYSPROXY_BYPASS)
  })

  it('falls back to the defaults when bypass is not a string array', () => {
    const fs = fakeFs({ [PATH]: JSON.stringify({ bypass: 'nope' }) })
    expect(readSysProxyBypass(PATH, fs)).toEqual(DEFAULT_SYSPROXY_BYPASS)
  })
})

describe('writeSysProxyBypass', () => {
  const PATH = '/userData/sysproxy.json'

  it('round-trips: a written list is what readSysProxyBypass returns', () => {
    const fs = fakeFs({})
    writeSysProxyBypass(PATH, fs, ['localhost', 'corp.internal'])
    expect(readSysProxyBypass(PATH, fs)).toEqual(['localhost', 'corp.internal'])
  })

  it('overwrites a previously persisted list', () => {
    const fs = fakeFs({ [PATH]: JSON.stringify({ bypass: ['old.example'] }) })
    writeSysProxyBypass(PATH, fs, ['new.example'])
    expect(readSysProxyBypass(PATH, fs)).toEqual(['new.example'])
  })
})
