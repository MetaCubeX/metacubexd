import { parse, stringify } from 'yaml'

// Directive keys consumed by an overlay to prepend/append into a base array
// (Clash Verge merge convention). They are never emitted to the output.
// Maps a directive key -> [target base array key, position].
const DIRECTIVES: Record<string, { target: string; at: 'prepend' | 'append' }> =
  {
    'prepend-rules': { target: 'rules', at: 'prepend' },
    'append-rules': { target: 'rules', at: 'append' },
    'prepend-proxies': { target: 'proxies', at: 'prepend' },
    'append-proxies': { target: 'proxies', at: 'append' },
    'prepend-proxy-groups': { target: 'proxy-groups', at: 'prepend' },
    'append-proxy-groups': { target: 'proxy-groups', at: 'append' },
  }

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// Deep-merge a single overlay object onto `acc` (mutating `acc`).
// - plain objects -> recurse
// - scalars / plain arrays -> overlay value REPLACES the base value
// - directive keys -> splice into the corresponding base array; never emitted
function mergeOne(acc: PlainObject, overlay: PlainObject): void {
  for (const [key, value] of Object.entries(overlay)) {
    const directive = DIRECTIVES[key]
    if (directive) {
      // Treat a missing/non-array base value as an empty array.
      const baseArr = asArray(acc[directive.target])
      const extra = asArray(value)
      acc[directive.target] =
        directive.at === 'prepend'
          ? [...extra, ...baseArr]
          : [...baseArr, ...extra]
      continue
    }
    const existing = acc[key]
    if (isPlainObject(existing) && isPlainObject(value)) {
      mergeOne(existing, value)
    } else {
      // scalars and plain (non-directive) arrays replace wholesale
      acc[key] = value
    }
  }
}

/**
 * Compose a base Clash/mihomo YAML config with zero or more YAML overlays.
 *
 * Parses `base` and each overlay (in order), deep-merges each overlay onto the
 * accumulator, then stringifies the result back to YAML. Pure function, no IO.
 *
 * @throws if the base or any overlay parses to a non-object (null/scalar/array)
 * at the top level.
 */
export function mergeConfigs(base: string, overlays: string[]): string {
  const acc = parse(base) as unknown
  if (!isPlainObject(acc)) {
    throw new Error('mergeConfigs: base config must be a YAML mapping')
  }
  overlays.forEach((overlay, i) => {
    const parsed = parse(overlay) as unknown
    if (!isPlainObject(parsed)) {
      throw new Error(`mergeConfigs: overlay #${i} must be a YAML mapping`)
    }
    mergeOne(acc, parsed)
  })
  return stringify(acc)
}
