import type { LogFsLike } from '../log-file'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createLogFileSink } from '../log-file'

/** In-memory LogFsLike recording files + dirs. */
function fakeFs(initial: Record<string, string> = {}): {
  fs: LogFsLike
  files: Record<string, string>
  dirs: Set<string>
} {
  const files = { ...initial }
  const dirs = new Set<string>()
  const fs: LogFsLike = {
    existsSync: (p) => p in files || dirs.has(p),
    mkdirSync: (p) => void dirs.add(p),
    appendFileSync: (p, data) => {
      files[p] = (files[p] ?? '') + data
    },
    // Byte count, mirroring the real statSync(p).size adapter — so the sink's
    // UTF-8 byte accounting is exercised against multi-byte content.
    statSize: (p) => Buffer.byteLength(files[p] ?? ''),
    renameSync: (from, to) => {
      files[to] = files[from]!
      delete files[from]
    },
    unlinkSync: (p) => {
      delete files[p]
    },
  }
  return { fs, files, dirs }
}

const DIR = '/userData/logs'
const PATH = `${DIR}/kernel.log`
const at = (iso: string) => () => new Date(iso)

describe('createLogFileSink', () => {
  it('creates the dir on first write and appends timestamped lines', () => {
    const { fs, files, dirs } = fakeFs()
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs,
      now: at('2026-07-08T12:00:00.000Z'),
    })
    sink.write('kernel started', 'stdout')
    sink.write('plain line')
    expect(dirs.has(DIR)).toBe(true)
    expect(files[PATH]).toBe(
      '2026-07-08T12:00:00.000Z [stdout] kernel started\n' +
        '2026-07-08T12:00:00.000Z plain line\n',
    )
  })

  it('exposes the active file path', () => {
    const { fs } = fakeFs()
    const sink = createLogFileSink({ dir: DIR, fileName: 'app.log', fs })
    expect(sink.path).toBe(`${DIR}/app.log`)
  })

  it('appends to an existing file (size seeded from disk)', () => {
    const { fs, files } = fakeFs({ [PATH]: 'previous session\n' })
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs,
      now: at('2026-07-08T12:00:00.000Z'),
    })
    sink.write('new line')
    expect(files[PATH]).toBe(
      'previous session\n2026-07-08T12:00:00.000Z new line\n',
    )
  })

  it('rotates once the active file would exceed maxBytes', () => {
    const { fs, files } = fakeFs()
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs,
      maxBytes: 80,
      now: at('2026-07-08T12:00:00.000Z'),
    })
    sink.write('a'.repeat(40)) // ~66 bytes with timestamp
    sink.write('b'.repeat(40)) // would exceed 80 -> rotate first
    expect(files[`${PATH}.1`]).toContain('a'.repeat(40))
    expect(files[PATH]).toContain('b'.repeat(40))
    expect(files[PATH]).not.toContain('a'.repeat(40))
  })

  it('shifts generations and drops the oldest beyond maxFiles', () => {
    const { fs, files } = fakeFs()
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs,
      maxBytes: 40,
      maxFiles: 2,
      now: at('2026-07-08T12:00:00.000Z'),
    })
    // Each write (~30 bytes + payload) forces a rotation of the previous one.
    sink.write('gen1-xxxxxxxxxxxxxxxxxxx')
    sink.write('gen2-xxxxxxxxxxxxxxxxxxx')
    sink.write('gen3-xxxxxxxxxxxxxxxxxxx')
    sink.write('gen4-xxxxxxxxxxxxxxxxxxx')
    expect(files[PATH]).toContain('gen4')
    expect(files[`${PATH}.1`]).toContain('gen3')
    expect(files[`${PATH}.2`]).toContain('gen2')
    // gen1 fell off the end (maxFiles = 2).
    expect(files[`${PATH}.3`]).toBeUndefined()
    expect(Object.values(files).join('')).not.toContain('gen1')
  })

  it('rotates on UTF-8 byte size, not UTF-16 code units, for CJK content', () => {
    const { fs, files } = fakeFs()
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs,
      // Timestamp prefix is ~25 bytes; one CJK char is 3 UTF-8 bytes. Two
      // 10-char CJK lines are ~2*(25+30)=110 bytes on disk, so the second must
      // rotate the first. Counting .length (code units) would see ~2*35=70 and
      // never rotate.
      maxBytes: 90,
      now: at('2026-07-08T12:00:00.000Z'),
    })
    const cjk = '节点'.repeat(5) // 10 CJK chars = 30 UTF-8 bytes
    sink.write(cjk)
    sink.write(cjk)
    expect(files[`${PATH}.1`]).toContain(cjk)
    expect(files[PATH]).toContain(cjk)
    // The rotated generation holds only the first line; the active file the
    // second — proof the byte-size threshold fired.
    expect(Buffer.byteLength(files[PATH] ?? '')).toBeLessThan(90)
  })

  it('never throws when the fs fails (best-effort contract)', () => {
    const throwingFs: LogFsLike = {
      existsSync: () => {
        throw new Error('disk gone')
      },
      mkdirSync: () => {
        throw new Error('disk gone')
      },
      appendFileSync: () => {
        throw new Error('disk full')
      },
      statSize: () => {
        throw new Error('disk gone')
      },
      renameSync: () => {
        throw new Error('disk gone')
      },
      unlinkSync: () => {
        throw new Error('disk gone')
      },
    }
    const sink = createLogFileSink({
      dir: DIR,
      fileName: 'kernel.log',
      fs: throwingFs,
    })
    expect(() => sink.write('x')).not.toThrow()
  })
})
