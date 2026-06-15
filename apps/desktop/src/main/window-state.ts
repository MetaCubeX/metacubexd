import type { FsLike } from './paths'

/**
 * Persisted main-window geometry. `width`/`height` are always present; `x`/`y`
 * are optional so a first run (or a sanitized-away position) lets Electron
 * center the window on the primary display.
 */
export interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

/**
 * Default window geometry — the historical 1280x800 size with no fixed
 * position (Electron centers it). Used for first run and as the fallback when
 * the persisted state is missing, corrupt, or out of sane bounds.
 */
export const DEFAULT_WINDOW_BOUNDS: WindowBounds = { width: 1280, height: 800 }

// Outer bounds for sanitization. A persisted size/position outside these is
// treated as garbage (corrupt file, removed monitor, integer overflow) and
// replaced with the default — never blindly trusted to position the window.
const MIN_SIZE = 1
const MAX_SIZE = 100_000
const MAX_POSITION_ABS = 1_000_000

function isSaneSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_SIZE &&
    value <= MAX_SIZE
  )
}

function isSanePosition(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_POSITION_ABS
  )
}

/**
 * Clamp/replace invalid bounds against `defaults`. A NaN / non-positive /
 * absurdly-large width or height falls back to the default; a NaN / non-finite
 * / absurdly off-screen `x` or `y` is dropped entirely (so Electron centers the
 * window) rather than positioning it somewhere unreachable.
 */
export function sanitizeBounds(
  bounds: WindowBounds,
  defaults: WindowBounds,
): WindowBounds {
  const result: WindowBounds = {
    width: isSaneSize(bounds.width) ? bounds.width : defaults.width,
    height: isSaneSize(bounds.height) ? bounds.height : defaults.height,
  }
  if (isSanePosition(bounds.x) && isSanePosition(bounds.y)) {
    result.x = bounds.x
    result.y = bounds.y
  }
  return result
}

/**
 * Read the persisted window bounds from `path` (JSON {@link WindowBounds}),
 * sanitized against `defaults`. Returns `defaults` when the file is missing or
 * the JSON is malformed. fs-injected so it is unit-testable without disk.
 */
export function loadWindowState(
  fs: FsLike,
  path: string,
  defaults: WindowBounds,
): WindowBounds {
  if (!fs.existsSync(path)) return { ...defaults }
  try {
    const parsed = JSON.parse(fs.readFileSync(path)) as WindowBounds
    return sanitizeBounds(parsed, defaults)
  } catch {
    /* fall through to defaults on malformed JSON */
    return { ...defaults }
  }
}

/**
 * Persist the window bounds to `path` as JSON. fs-injected so it is
 * unit-testable without touching the real disk.
 */
export function saveWindowState(
  fs: FsLike,
  path: string,
  bounds: WindowBounds,
): void {
  fs.writeFileSync(path, JSON.stringify(bounds))
}
