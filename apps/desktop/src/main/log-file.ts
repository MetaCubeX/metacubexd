/**
 * Size-rotated on-disk log sink. The dashboard's SSE log view only shows the
 * live session; a mature desktop client also keeps kernel output + app events
 * on disk under userData/logs so "it crashed yesterday" is diagnosable (Help >
 * Open Logs Folder). Classic logrotate scheme: append to `<name>`, and once it
 * exceeds `maxBytes` shift `<name>` -> `<name>.1` -> ... -> `<name>.<maxFiles>`
 * (the oldest generation is dropped).
 *
 * All fs access is injected so rotation and formatting are unit-testable
 * without a disk; every write is best-effort (a full disk must never take the
 * proxy down or recurse through the notifier).
 */

import { Buffer } from 'node:buffer'

/** Minimal fs surface the sink needs (injectable). */
export interface LogFsLike {
  existsSync: (p: string) => boolean
  mkdirSync: (p: string) => void
  appendFileSync: (p: string, data: string) => void
  statSize: (p: string) => number
  renameSync: (from: string, to: string) => void
  unlinkSync: (p: string) => void
}

export interface LogFileSinkOptions {
  /** Directory the log files live in (created on first write). */
  dir: string
  /** Active log file name, e.g. 'kernel.log'. */
  fileName: string
  fs: LogFsLike
  /** Rotate once the active file exceeds this many bytes (default 5 MiB). */
  maxBytes?: number
  /** Rotated generations to keep (default 3, i.e. .1/.2/.3). */
  maxFiles?: number
  /** Injectable clock for the line timestamps (default Date). */
  now?: () => Date
}

export interface LogFileSink {
  /** Append one line (timestamp + optional tag are prepended). */
  write: (line: string, tag?: string) => void
  /** Absolute path of the active log file. */
  path: string
}

export function createLogFileSink(opts: LogFileSinkOptions): LogFileSink {
  const { dir, fileName, fs } = opts
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024
  const maxFiles = opts.maxFiles ?? 3
  const now = opts.now ?? (() => new Date())
  const path = `${dir}/${fileName}`

  // Track the active file size in memory (seeded lazily from the real file) so
  // steady-state writes never stat the disk.
  let size: number | null = null
  let ready = false

  function ensureReady(): void {
    if (ready) return
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)
    size = fs.existsSync(path) ? fs.statSize(path) : 0
    ready = true
  }

  // <name>.(maxFiles-1) -> <name>.maxFiles, ..., <name> -> <name>.1
  function rotate(): void {
    const oldest = `${path}.${maxFiles}`
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest)
    for (let i = maxFiles - 1; i >= 1; i--) {
      const from = `${path}.${i}`
      if (fs.existsSync(from)) fs.renameSync(from, `${path}.${i + 1}`)
    }
    if (fs.existsSync(path)) fs.renameSync(path, `${path}.1`)
    size = 0
  }

  return {
    path,
    write(line, tag) {
      try {
        ensureReady()
        const entry = `${now().toISOString()} ${tag ? `[${tag}] ` : ''}${line}\n`
        // Byte length, not entry.length (UTF-16 code units): maxBytes and the
        // statSize seed are UTF-8 byte counts, so CJK-heavy kernel logs (proxy
        // group / node names) would undercount ~3x and rotate past the cap.
        const bytes = Buffer.byteLength(entry)
        if ((size ?? 0) + bytes > maxBytes) rotate()
        fs.appendFileSync(path, entry)
        size = (size ?? 0) + bytes
      } catch {
        // Best-effort by contract: logging must never throw into the caller
        // (the supervisor's log fan-out / the notifier) or recurse via notify.
      }
    },
  }
}
