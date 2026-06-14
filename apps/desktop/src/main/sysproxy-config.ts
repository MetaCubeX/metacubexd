import type { FsLike } from './paths'

/**
 * Default system-proxy bypass list. Keeps loopback, IPv6 loopback, the RFC1918
 * private ranges and the platform-native `<local>` token out of the proxy so
 * LAN + localhost traffic never round-trips through the managed mixed port.
 */
export const DEFAULT_SYSPROXY_BYPASS: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '::1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '<local>',
]

/**
 * Read the persisted bypass list from `userData/sysproxy.json` (shape:
 * `{ bypass: string[] }`). Falls back to {@link DEFAULT_SYSPROXY_BYPASS} when
 * the file is missing, malformed, or `bypass` is not a string array. Pure /
 * fs-injected so it is unit-testable without touching disk.
 */
export function readSysProxyBypass(path: string, fs: FsLike): string[] {
  if (!fs.existsSync(path)) return [...DEFAULT_SYSPROXY_BYPASS]
  try {
    const parsed = JSON.parse(fs.readFileSync(path)) as unknown
    const bypass = (parsed as { bypass?: unknown })?.bypass
    if (Array.isArray(bypass) && bypass.every((b) => typeof b === 'string')) {
      return bypass as string[]
    }
  } catch {
    /* fall through to defaults on malformed JSON */
  }
  return [...DEFAULT_SYSPROXY_BYPASS]
}
